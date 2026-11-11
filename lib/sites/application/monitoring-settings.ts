import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { systemClock, type Clock } from '@/lib/time/clock'
import { fromStoredWatchInterval, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { watchScheduleSchema, type WatchInterval } from '../watch-schedule'
import { outcomeFreshnessMinutes } from '../evidence-freshness'
import { SITE_ERRORS } from '@/lib/marketing/copy/errors'
import { WATCH_MESSAGES } from '../watch-state'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { enableUptimeMonitor } from '@/lib/uptime/monitor-target'

export type MonitoringChange = { interval: WatchInterval | null; everyMinutes?: number } | { action: 'pause' | 'resume' }
type MonitoringResult = { ok: true; interval?: WatchInterval | null; everyMinutes?: number | null }
  | { ok: false; error: string; code?: string }

export function productWatchReadiness(): { available: boolean; error: string | null } {
  return process.env.REDIS_URL ? { available: true, error: null }
    : { available: false, error: 'WATCH_UNAVAILABLE: Redis is not configured' }
}

/** Schedule, uptime and derived freshness commit under the same current owner and state. */
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
      select: { id: true, url: true, watchInterval: true, watchEveryMinutes: true, watchNextRunAt: true, watchPausedAt: true } })
    if (!project) return { ok: false, error: SITE_ERRORS.notFound, code: 'SITE_NOT_FOUND' }
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
        return { ok: false, error: WATCH_MESSAGES.accountUnavailable, code: 'WATCH_UNAVAILABLE' }
      if (!effective.watchIntervals.includes(interval)) return { ok: false,
        error: interval === 'daily' ? 'Daily watching is available on paid plans. Free Sites watch weekly.'
          : 'That watch interval is not available on your plan.', code: 'INTERVAL_NOT_ALLOWED' }
      const readiness = productWatchReadiness()
      if (!readiness.available) return { ok: false, error: readiness.error!, code: 'WATCH_UNAVAILABLE' }
    }

    const now = clock.now()
    const uptimeTarget = enabling ? normalizeAuditUrl(project.url) : null
    const sameCadence = previous === interval && (interval !== 'custom' || project.watchEveryMinutes === everyMinutes)
    let data: Prisma.ProjectUpdateManyMutationInput
    if (action === 'pause') {
      data = { watchPausedAt: project.watchPausedAt ?? now, watchNextRunAt: null, watchLeaseUntil: null,
        watchLastError: WATCH_MESSAGES.paused }
    } else if (interval) {
      data = { watchPausedAt: null, watchInterval: toStoredWatchInterval(interval), watchEveryMinutes: interval === 'custom' ? everyMinutes : null }
      // Changed cadence establishes fresh evidence under its new policy.
      // Repeated saves preserve both due intent and a live scheduler lease.
      if (!sameCadence || !project.watchNextRunAt) Object.assign(data, {
        watchNextRunAt: now,
        watchLeaseUntil: null, watchConsecutiveFailures: 0, watchLastError: null,
      })
    } else {
      data = { watchPausedAt: project.watchPausedAt ?? now, watchInterval: null, watchEveryMinutes: null, watchNextRunAt: null, watchLeaseUntil: null,
        watchLastError: WATCH_MESSAGES.paused }
    }
    const changed = await tx.project.updateMany({
      where: { ...owner, watchInterval: project.watchInterval, watchEveryMinutes: project.watchEveryMinutes ?? null,
        watchNextRunAt: project.watchNextRunAt ?? null, watchPausedAt: project.watchPausedAt ?? null,
        ...(enabling ? { url: project.url, user: { lifecycleStatus: 'ACTIVE' } } : {}) },
      data: uptimeTarget?.ok ? { ...data, uptimeSetupRetryAt: null } : data,
    })
    if (changed.count !== 1) {
      const current = await tx.project.findFirst({ where: { ...owner, ...(enabling ? { user: { lifecycleStatus: 'ACTIVE' } } : {}) }, select: { id: true } })
      return current ? { ok: false, error: 'Monitoring settings changed. Refresh and try again.', code: 'WATCH_CHANGED' }
        : { ok: false, error: 'Site not found' }
    }
    if (!enabling) await tx.uptimeMonitor.updateMany({ where: { projectId: project.id }, data: {
      enabled: false, state: 'paused', leaseUntil: null, leaseToken: null,
      pendingFailureAt: null, pendingSlotAt: null, confirmationDueAt: null,
    } })
    else if (uptimeTarget?.ok) await enableUptimeMonitor(tx, project.id, uptimeTarget.url, now)
    if (action !== 'pause') await tx.siteOutcome.updateMany({ where: { projectId: project.id },
      data: { staleAfterMinutes: outcomeFreshnessMinutes(interval, everyMinutes) } })
    return action ? { ok: true, interval, everyMinutes: everyMinutes ?? null } : { ok: true }
  }
  return dependencies.tx ? apply(dependencies.tx) : prisma.$transaction(apply)
}
