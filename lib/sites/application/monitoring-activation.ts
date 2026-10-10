import { prisma } from '@/lib/db'
import { allowedWatchIntervals } from '@/lib/auth/entitlements'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestOutcomeRun } from '@/lib/sites/application/run-requests'
import { MONITORING_COPY as C } from '@/lib/marketing/copy/monitoring'

export async function monitoringOptions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, plan: true, subscriptionStatus: true } })
  return user ? allowedWatchIntervals(user) : []
}

/** Coordinate existing commands. A saved schedule is never a verification result. */
export async function activateSiteMonitoring(input: { siteId: string; userId: string; interval: 'weekly' | 'daily' }) {
  const site = await loadSiteRecord(input.siteId)
  if (!site?.projectId || site.userId !== input.userId) return { ok: false as const, stage: 'coverage' as const, message: C.coverageFailed }
  const allowed = await monitoringOptions(input.userId)
  if (!allowed.includes(input.interval)) return { ok: false as const, stage: 'schedule' as const, message: C.cadenceUnavailable }
  // Keep existing confirmation, name and bindings intact on repeat activation.
  const existing = await prisma.siteOutcome.findFirst({
    where: { projectId: site.projectId, slug: 'page-loads', kind: 'AVAILABILITY', enabled: true, confirmedAt: { not: null }, bindings: { some: { enabled: true, required: true, mechanism: 'HTTP_AVAILABILITY' } } },
    select: { id: true },
  })
  let outcome = existing
  if (!outcome) {
    const confirmed = await executeSiteCommand({ type: 'CONFIRM_PAGE_AVAILABILITY', siteId: site.siteId })
    if (!confirmed.ok || !('outcome' in confirmed) || !confirmed.outcome) return { ok: false as const, stage: 'coverage' as const, message: C.coverageFailed }
    outcome = confirmed.outcome
  }
  // Repeated activation must not move the next check or clear a live worker lease.
  if (site.watchInterval !== input.interval || !site.watchNextRunAt) {
    const scheduled = await executeSiteCommand({ type: 'SET_WATCH', siteId: site.siteId, userId: input.userId, interval: input.interval })
    if (!scheduled.ok) return { ok: false as const, stage: 'schedule' as const, message: 'code' in scheduled && scheduled.code === 'WATCH_UNAVAILABLE' ? C.serviceUnavailable : C.scheduleFailed }
  }
  const persisted = await loadSiteRecord(site.siteId)
  if (!persisted?.watchInterval || !persisted.watchNextRunAt) return { ok: false as const, stage: 'schedule' as const, message: C.scheduleFailed }
  const schedule = { interval: persisted.watchInterval, nextRunAt: persisted.watchNextRunAt.toISOString(), outcomeId: outcome.id }
  // Scope the first check to this confirmed public page. Failed enqueue attempts
  // get a new retry key; repeated clicks reuse the same pending/completed run.
  const prefix = `monitoring-start:${outcome.id}`
  try {
    const prior = await prisma.runRequest.findFirst({
      where: { projectId: site.projectId, source: 'WEB', requestedByUserId: input.userId, idempotencyKey: { startsWith: prefix }, selections: { some: { outcomeId: outcome.id } } },
      orderBy: { requestedAt: 'desc' }, select: { id: true, status: true, idempotencyKey: true, leaseUntil: true, auditId: true },
    })
    const interrupted = prior && prior.status !== 'COMPLETED' && !prior.auditId && (!prior.leaseUntil || prior.leaseUntil.getTime() <= Date.now())
    const resuming = prior?.status === 'COMPLETED' && !site.watchInterval
    const key = !prior ? prefix : prior.status === 'FAILED' || interrupted ? `${prefix}:retry:${prior.id}` : resuming ? `${prefix}:resume:${prior.id}` : prior.idempotencyKey
    const run = await requestOutcomeRun({ projectId: site.projectId, outcomeId: outcome.id, userId: input.userId, source: 'WEB', idempotencyKey: key })
    return { ok: true as const, ...schedule, firstCheck: 'requested' as const, reused: run.reused }
  } catch {
    // A due Watch may already be checking this page alongside other confirmed
    // coverage. Reuse that work instead of describing an active check as failed.
    const covering = await prisma.runRequest.findFirst({
      where: { projectId: site.projectId, status: { in: ['QUEUED', 'RUNNING'] }, leaseUntil: { gt: new Date() }, auditId: { not: null }, selections: { some: { outcomeId: outcome.id } } },
      select: { id: true },
    }).catch(() => null)
    if (covering) return { ok: true as const, ...schedule, firstCheck: 'requested' as const, reused: true }
    return { ok: true as const, ...schedule, firstCheck: 'unavailable' as const, reused: false }
  }
}
