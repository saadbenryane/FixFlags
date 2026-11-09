import { Prisma } from '@prisma/client'
import { productTransaction } from '@/lib/billing/product-transaction'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { lockAdminDomainActor, type AdminDomainActor } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { logger } from '@/lib/logger'
import { systemClock, type Clock } from '@/lib/time/clock'
import { assertScheduledClaim, staleScheduledClaim, type ScheduledRunClaim, type ScheduledClaimProject } from './scheduled-admission'
import { readExecutionSpec } from '../domain/execution-spec'
import { SiteRunRefusal } from './run-refusal'
import { incompleteScheduledAnalysisWhere } from '@/lib/audit/progressive/recorded-completeness'
import { scheduledContextSchema, readScheduledContext, watchRunTargetsSite, watchTargetHash, type ScheduledContext } from './scheduled-observation'

import { loadFreshScheduledBroadSource, scheduledOutcomesWhere } from './scheduled-scope'
import { recordCompletionAttempt, selectScheduledCompletionCandidates, updateUnlockedWatchProject, type WatchWriteAuthority } from './scheduled-watch-storage'
import { WATCH_MESSAGES } from '../watch-state'

type ScheduledOwner = { projectId: string; userId: string; interval: ScheduledRunClaim['interval']; operator?: AdminDomainActor }
async function lockScheduledSite(tx: Prisma.TransactionClient, input: ScheduledOwner) {
  const [site] = await tx.$queryRaw<Array<ScheduledClaimProject & { watchConsecutiveFailures: number }>>`
    SELECT p.url, p."watchTargetRevision", p."watchInterval", p."watchEveryMinutes", p."watchNextRunAt", p."watchLastAttemptAt", p."watchLeaseUntil", p."watchPausedAt", p."watchConsecutiveFailures"
    FROM projects p JOIN users u ON u.id = p."userId" WHERE p.id = ${input.projectId} AND p."userId" = ${input.userId}
      AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' FOR UPDATE OF p`
  if (!site) throw staleScheduledClaim()
  if (input.operator) await lockAdminDomainActor(input.operator, input.userId, input.projectId, tx)
  const policy = await loadEffectiveEntitlements(input.userId, tx)
  if (!policy?.available || !policy.watchIntervals.includes(input.interval)) throw staleScheduledClaim()
  return site
}

/** Empty selection is a scheduling decision, never a completed website check.
 * Recheck the scope under the same authority lock as normal advancement. */
export async function settleIdleScheduledCare(input: ScheduledOwner & { targetUrl: string; everyMinutes?: number | null;
  admittedAt: Date; claim?: ScheduledRunClaim }) {
  return productTransaction(async tx => {
    const site = await lockScheduledSite(tx, input)
    if (site.url !== input.targetUrl) throw staleScheduledClaim()
    if (input.claim) assertScheduledClaim(site, input.claim)
    const retained = await loadFreshScheduledBroadSource(tx, { ...input, targetRevision: site.watchTargetRevision, now: input.admittedAt })
    if (!retained) return { scope: 'SITE' as const, outcomes: [] }
    const outcomes = await tx.siteOutcome.findMany({ where: scheduledOutcomesWhere(input.projectId), select: { id: true }, orderBy: { id: 'asc' } })
    if (outcomes.length) return { scope: 'OUTCOMES' as const, outcomes }
    if (input.claim) {
      const nextRunAt = new Date(Math.min(calcWatchNextRun(input.interval, input.admittedAt, input.everyMinutes).getTime(), retained.renewAt.getTime()))
      const changed = await tx.project.updateMany({ where: { id: input.projectId, userId: input.userId, deletedAt: null, watchPausedAt: null,
        watchNextRunAt: input.claim.scheduledAt, watchLastAttemptAt: input.claim.attemptedAt, watchLeaseUntil: input.claim.leaseUntil },
        data: { watchNextRunAt: nextRunAt, watchLeaseUntil: null, watchConsecutiveFailures: 0, watchLastError: null } })
      if (changed.count !== 1) throw staleScheduledClaim()
    }
    return { scope: 'NONE' as const, retainedAuditId: retained.id }
  })
}

/** The receipt's schedule context and the Site clock commit together, after
 * normal execution admission. No raw URL or claim lease enters that context. */
export async function commitScheduledRun(input: { projectId: string; userId: string; runId: string; admittedAt: Date;
  claim: ScheduledRunClaim; operator?: AdminDomainActor }) {
  const complete = await productTransaction(async tx => {
    const site = await lockScheduledSite(tx, { ...input, interval: input.claim.interval })
    const run = await tx.runRequest.findFirst({ where: { id: input.runId, projectId: input.projectId, environment: 'production',
      status: { not: 'FAILED' }, audit: { projectId: input.projectId, userId: input.userId, status: { not: 'FAILED' } } },
      select: { context: true, executionSpec: true, status: true, audit: { select: { status: true } } } })
    const spec = readExecutionSpec(run?.executionSpec)
    if (!run || !spec || !['SITE', 'OUTCOMES'].includes(spec.scope) || spec.environment !== 'production' || spec.verificationTarget)
      throw new SiteRunRefusal(WATCH_MESSAGES.retryPending, 409, 'SCHEDULED_RUN_UNAVAILABLE')
    if (!watchRunTargetsSite(spec.targetUrl, run.context, site)) throw staleScheduledClaim()
    const old = readScheduledContext(run.context)
    if (!old.success && run.context && typeof run.context === 'object' && 'scheduled' in run.context)
      throw new SiteRunRefusal('The recorded monitoring context is unavailable.', 409, 'SCHEDULE_CONTEXT_UNAVAILABLE')
    if (old.success) {
      if (old.data.targetHash !== watchTargetHash(site.url) || (old.data.targetRevision ?? 1) !== site.watchTargetRevision) throw staleScheduledClaim()
      if (old.data.scheduledAt !== input.claim.scheduledAt.getTime() || old.data.interval !== input.claim.interval || old.data.everyMinutes !== input.claim.everyMinutes)
        throw new SiteRunRefusal('Another scheduled check still owns this execution.', 409, 'SITE_RUN_IN_PROGRESS')
      return false
    }
    assertScheduledClaim(site, input.claim)
    const nextCadenceAt = calcWatchNextRun(input.claim.interval, input.admittedAt, input.claim.everyMinutes)
    const retainedBroad = spec.scope === 'OUTCOMES' ? await loadFreshScheduledBroadSource(tx, {
      projectId: input.projectId, targetUrl: site.url, targetRevision: site.watchTargetRevision, interval: input.claim.interval,
      everyMinutes: input.claim.everyMinutes, now: input.admittedAt,
    }) : null
    // A narrow check cannot renew the broad evidence it skipped. If that
    // source disappeared, leave broad work due rather than adding a new period.
    const nextRunAt = spec.scope === 'OUTCOMES'
      ? Math.min(nextCadenceAt.getTime(), retainedBroad?.renewAt.getTime() ?? input.admittedAt.getTime())
      : nextCadenceAt.getTime()
    const scheduled = scheduledContextSchema.parse({ version: 1, targetHash: watchTargetHash(site.url),
      ...(site.watchTargetRevision > 1 ? { targetRevision: site.watchTargetRevision } : {}), interval: input.claim.interval,
      everyMinutes: input.claim.everyMinutes, scheduledAt: input.claim.scheduledAt.getTime(), attemptedAt: input.claim.attemptedAt.getTime(),
      nextRunAt, failures: site.watchConsecutiveFailures })
    const context = run.context && typeof run.context === 'object' && !Array.isArray(run.context) ? run.context : {}
    await tx.runRequest.update({ where: { id: input.runId }, data: { context: { ...context, scheduled } } })
    const changed = await tx.project.updateMany({ where: { id: input.projectId, userId: input.userId, deletedAt: null, watchPausedAt: null,
      watchNextRunAt: input.claim.scheduledAt, watchLastAttemptAt: input.claim.attemptedAt, watchLeaseUntil: input.claim.leaseUntil },
      data: { watchNextRunAt: new Date(scheduled.nextRunAt), watchLeaseUntil: null } })
    if (changed.count !== 1) throw staleScheduledClaim()
    return run.status === 'COMPLETED' && run.audit?.status === 'COMPLETED'
  })
  if (complete) await reconcileScheduledCompletions(1, systemClock, { runId: input.runId, projectId: input.projectId,
    authority: input.operator ? { actor: input.operator, userId: input.userId } : undefined })
    .catch(error => logger.warn('Scheduled completion deferred after admission', { runId: input.runId, error }))
}

/** One cohort serves normal completion and bounded recovery. JSON comparisons
 * avoid trusting timestamp casts or interpreting malformed historical context. */
export async function reconcileScheduledCompletions(limit = 20, clock: Clock = systemClock,
  scope: { projectId?: string; runId?: string; authority?: WatchWriteAuthority } = {}): Promise<number> {
  const { projectId, runId, authority } = scope
  const rows = await selectScheduledCompletionCandidates(clock.now(), limit, { projectId, runId, userId: authority?.userId })
  let changed = 0
  for (const row of rows) {
    try {
      // Reuse the run-recovery activity clock. Persist effort before parsing or
      // projecting so a failed oldest cohort yields across bounded sweeps.
      // This timestamp never advances a Site clock or an execution lease.
      const attempted = await recordCompletionAttempt(row, clock, authority)
      if (attempted.count !== 1) continue
      const parsed = readScheduledContext(row.context)
      if (!parsed.success) continue
      const saved: ScheduledContext = parsed.data
      const failed = row.status === 'FAILED' || row.incomplete
      const delay = [15, 60, 360][Math.min(saved.failures, 2)] * 60_000
      const result = await updateUnlockedWatchProject(row.projectId, { userId: row.userId, url: row.targetUrl, deletedAt: null, watchPausedAt: null,
        watchTargetRevision: saved.targetRevision ?? 1,
        user: { lifecycleStatus: 'ACTIVE' }, watchInterval: toStoredWatchInterval(saved.interval), watchEveryMinutes: saved.everyMinutes,
        watchNextRunAt: new Date(saved.nextRunAt), watchLastAttemptAt: new Date(saved.attemptedAt), watchLeaseUntil: null,
        watchConsecutiveFailures: saved.failures, watchLastError: row.watchLastError,
        audits: { some: { id: row.auditId, userId: row.userId, status: row.status as 'FAILED' | 'COMPLETED', completedAt: row.completedAt,
          ...(row.incomplete ? incompleteScheduledAnalysisWhere : { NOT: incompleteScheduledAnalysisWhere }),
          runRequests: { some: { id: row.id, status: row.status as 'FAILED' | 'COMPLETED', context: { equals: row.context as Prisma.InputJsonValue } } } } },
      }, failed ? { watchNextRunAt: new Date(Math.min(saved.nextRunAt, row.completedAt.getTime() + delay)),
        watchConsecutiveFailures: saved.failures + 1, watchLastError: WATCH_MESSAGES.retryPending }
        : { watchConsecutiveFailures: 0, watchLastError: null }, { authority })
      changed += result.count
    } catch (error) {
      if (error instanceof AdminActionError) throw error
      logger.warn('Scheduled completion deferred; other Sites will continue', { runId: row.id, error })
    }
  }
  return changed
}
