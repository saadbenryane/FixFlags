import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { systemClock, type Clock } from '@/lib/time/clock'
import { fromStoredWatchInterval, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { watchScheduleSchema, type WatchInterval } from '../watch-schedule'
import { outcomeFreshnessMinutes } from '../evidence-freshness'

export type MonitoringChange = { interval: WatchInterval | null; everyMinutes?: number } | { action: 'pause' | 'resume' }
type MonitoringResult = { ok: true; interval?: WatchInterval | null; everyMinutes?: number | null }
  | { ok: false; error: string; code?: string }

export function productWatchReadiness(): { available: boolean; error: string | null } {
  return process.env.REDIS_URL ? { available: true, error: null }
    : { available: false, error: 'WATCH_UNAVAILABLE: Redis is not configured' }
}

/** Schedule and derived freshness commit under the same current owner and state. */
export async function setProjectWatch(input: { projectId: string; userId: string } & MonitoringChange,
  dependencies: { clock?: Clock; tx?: Prisma.TransactionClient } = {}): Promise<MonitoringResult> {
  const clock = dependencies.clock ?? systemClock
  const action = 'action' in input ? input.action : null
  if (action && (!['pause', 'resume'].includes(action) || 'interval' in input))
    return { ok: false, error: 'Choose a valid monitoring action.', code: 'INVALID_INTERVAL' }
  const requested = !action && 'interval' in input ? watchScheduleSchema.safeParse(input) : null
  if (!action && !requested?.success)
    return { ok: false, error: 'Choose a valid monitoring schedule.', code: 'INVALID_INTERVAL' }

  const apply = async (tx: Prisma.TransactionClient): Promise<MonitoringResult> => {
    const owner = { id: input.projectId, userId: input.userId, deletedAt: null }
    const project = await tx.project.findFirst({ where: owner,
      select: { id: true, watchInterval: true, watchEveryMinutes: true, watchNextRunAt: true } })
    if (!project) return { ok: false, error: 'Site not found' }
    const previous = fromStoredWatchInterval(project.watchInterval)
    if (action && !previous)
      return { ok: false, error: 'Choose a monitoring schedule first.', code: 'SCHEDULE_REQUIRED' }
    const selected = action ? watchScheduleSchema.safeParse({ interval: previous,
      ...(previous === 'custom' ? { everyMinutes: project.watchEveryMinutes } : {}) }) : requested!
    if (!selected.success)
      return { ok: false, error: 'Choose a monitoring schedule first.', code: 'SCHEDULE_REQUIRED' }
    const { interval, everyMinutes } = selected.data
    const enabling = action !== 'pause' && interval !== null
    if (enabling) {
      const effective = await loadEffectiveEntitlements(input.userId, tx, clock)
      if (!effective?.available)
        return { ok: false, error: 'Watching is not available on this account.', code: 'WATCH_UNAVAILABLE' }
      if (!effective.watchIntervals.includes(interval)) return { ok: false,
        error: interval === 'daily' ? 'Daily watching is available on Pro and Studio. Free Sites watch weekly.'
          : 'That watch interval is not available on your plan.', code: 'INTERVAL_NOT_ALLOWED' }
      const readiness = productWatchReadiness()
      if (!readiness.available) return { ok: false, error: readiness.error!, code: 'WATCH_UNAVAILABLE' }
    }

    const now = clock.now()
    const sameCadence = previous === interval && (interval !== 'custom' || project.watchEveryMinutes === everyMinutes)
    let data: Prisma.ProjectUpdateManyMutationInput
    if (action === 'pause') {
      data = { watchNextRunAt: null, watchLeaseUntil: null,
        watchLastError: 'Paused. This Site is not on a check schedule.' }
    } else if (interval) {
      data = { watchInterval: toStoredWatchInterval(interval), watchEveryMinutes: interval === 'custom' ? everyMinutes : null }
      // Changed cadence establishes fresh evidence under its new policy.
      // Repeated saves preserve both due intent and a live scheduler lease.
      if (!sameCadence || !project.watchNextRunAt) Object.assign(data, {
        watchNextRunAt: now,
        watchLeaseUntil: null, watchConsecutiveFailures: 0, watchLastError: null,
      })
    } else {
      data = { watchInterval: null, watchEveryMinutes: null, watchNextRunAt: null, watchLeaseUntil: null,
        watchLastError: 'Paused. This Site is not on a check schedule.' }
    }
    const changed = await tx.project.updateMany({
      where: { ...owner, watchInterval: project.watchInterval, watchEveryMinutes: project.watchEveryMinutes ?? null,
        watchNextRunAt: project.watchNextRunAt ?? null, ...(enabling ? { user: { lifecycleStatus: 'ACTIVE' } } : {}) },
      data,
    })
    if (changed.count !== 1) {
      const current = await tx.project.findFirst({ where: { ...owner, ...(enabling ? { user: { lifecycleStatus: 'ACTIVE' } } : {}) }, select: { id: true } })
      return current ? { ok: false, error: 'Monitoring settings changed. Refresh and try again.', code: 'WATCH_CHANGED' }
        : { ok: false, error: 'Site not found' }
    }
    if (action !== 'pause') await tx.siteOutcome.updateMany({ where: { projectId: project.id },
      data: { staleAfterMinutes: outcomeFreshnessMinutes(interval, everyMinutes) } })
    return action ? { ok: true, interval, everyMinutes: everyMinutes ?? null } : { ok: true }
  }
  return dependencies.tx ? apply(dependencies.tx) : prisma.$transaction(apply)
}
