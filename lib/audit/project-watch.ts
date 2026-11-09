import { assertAdminDomainActor, lockAdminDomainActor } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { SiteNotFound } from '@/lib/sites/domain/site-errors'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { Prisma, type Audit } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy-barrel'
import { siteNotificationEmail } from '@/lib/email/site-notification'
import { loadEmailRepairFindings } from '@/lib/email/finding-repair'
import { notificationRecipientAllowed, projectEmailAcceptance } from '@/lib/email/delivery-events'
import { watchEmailPayloadSchema } from '@/lib/email/watch-payload'
import { hasRecordedWatchSelection, selectWatchEmailDelivery, watchEmailProviderBody, watchEmailSelection } from '@/lib/email/watch-delivery'
import { NOTIFICATION_REQUEST_TIMEOUT_MS, assertNotificationReplayWindow, deliverNotificationBatch, prepareNotificationReplay, notificationRetryAt, sendNotificationEmail } from '@/lib/email/notification-delivery'
import { nextAttemptTimestamp, systemClock, type Clock } from '@/lib/time/clock'
import { isCustomerFlag } from '@/lib/audit/attention'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { requestScheduledSiteRun, ScheduledRunCommitDeferred } from '@/lib/sites/application/scheduled-runs'
import {
  calcWatchNextRun,
  fromStoredWatchInterval,
} from '@/lib/audit/watch-interval'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { WATCH_MESSAGES } from '@/lib/sites/watch-state'
import { productTransaction } from '@/lib/billing/product-transaction'
import { reconcileScheduledCompletions } from '@/lib/sites/application/scheduled-completion'
import { ACTIVE_RUN_STATUSES } from '@/lib/sites/application/run-leases'
import { currentNativeWatchTargetSql, readScheduledContext, recordedWatchTargetRevision, sameSiteWatchParentSql, sharedWatchRunWhere,
  scheduledObservationAuditsSql, watchNotificationSourceReadySql } from '@/lib/sites/application/scheduled-observation'
import { selectDueWatchProjects, updateUnlockedWatchProject, type WatchWriteAuthority } from '@/lib/sites/application/scheduled-watch-storage'

export type { WatchInterval } from '@/lib/audit/watch-interval'
export {
  calcWatchNextRun,
  fromStoredWatchInterval,
  isWatchInterval,
  plannedWatchJobs,
  toStoredWatchInterval,
} from '@/lib/audit/watch-interval'
export type SiteWatchJobKind = 'pulse' | 'full'

const RETRY_MS = [15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000] as const
const LEASE_MS = 10 * 60 * 1000
const WATCH_ADMISSION_CONCURRENCY = 4
/**
 * How long one worker may hold a notification claim. Long enough that a slow
 * provider call is never stolen, short enough that a dead worker's alert is
 * re-attempted within a Watch interval rather than being lost.
 */
const NOTIFICATION_LEASE_MS = 10 * 60 * 1000
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export { setProjectWatch, productWatchReadiness } from '@/lib/sites/application/monitoring-settings'

function retryAt(failures: number, now: Date): Date {
  return new Date(now.getTime() + RETRY_MS[Math.min(Math.max(failures - 1, 0), RETRY_MS.length - 1)])
}

/** Claim due watches with a lease before enqueueing exactly one WATCH child. */
export async function processDueProjectWatches(
  limit = 20,
  dependencies: { clock?: Clock; onlyProjectId?: string; operator?: import('@/lib/admin/domain-actor').AdminDomainActor } = {}
): Promise<{
  processed: number
  enqueued: number
  errors: number
}> {
  const clock = dependencies.clock ?? systemClock
  let authority: WatchWriteAuthority | undefined
  if (dependencies.operator) {
    if (!dependencies.onlyProjectId)
      throw new AdminActionError('Choose a Site for operator reconciliation.', 403, 'ADMIN_DOMAIN_SCOPE_DENIED')
    const project = await prisma.project.findFirst({ where: { id: dependencies.onlyProjectId, deletedAt: null }, select: { userId: true } })
    if (!project) throw new SiteNotFound()
    await assertAdminDomainActor(dependencies.operator, project.userId, dependencies.onlyProjectId)
    authority = { actor: dependencies.operator, userId: project.userId }
  }
  const recover = () => reconcileScheduledCompletions(limit, clock, { projectId: dependencies.onlyProjectId, authority })
    .catch(error => {
      if (error instanceof AdminActionError) throw error
      logger.warn('Scheduled completion recovery deferred; due admissions will continue', { error })
      return 0
    })
  const writeSchedule = (id: string, where: Prisma.ProjectWhereInput, data: Prisma.ProjectUpdateManyMutationInput, admission = false) =>
    updateUnlockedWatchProject(id, where, data, { admission, authority })

  let processed = 0
  let enqueued = 0
  let errors = 0

  type DueSites = Awaited<ReturnType<typeof selectDueWatchProjects>>
  async function admitSite(project: DueSites[number]) {
    const eligibilityAt = clock.now()
    const attemptedAt = nextAttemptTimestamp(eligibilityAt, project.watchLastAttemptAt)
    const interval = fromStoredWatchInterval(project.watchInterval)
    if (!interval) return
    const unchangedSchedule = { id: project.id, userId: project.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' as const },
      watchPausedAt: null, url: project.url, watchTargetRevision: project.watchTargetRevision,
      watchInterval: project.watchInterval, watchEveryMinutes: project.watchEveryMinutes ?? null, watchNextRunAt: project.watchNextRunAt,
      watchConsecutiveFailures: project.watchConsecutiveFailures }
    const availableLease = { OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: eligibilityAt } }] }
    const attemptScope: Prisma.ProjectWhereInput = { ...unchangedSchedule, ...availableLease,
      watchLastAttemptAt: project.watchLastAttemptAt ?? null }
    try {
      // Record admission effort before fallible policy reads and retry writes.
      // An interrupted Site retains its due intent while later Sites get a turn.
      const attempted = await writeSchedule(project.id, attemptScope, { watchLastAttemptAt: attemptedAt }, true)
      if (attempted.count !== 1) return
    } catch (error) {
      if (error instanceof AdminActionError) throw error
      // An unacknowledged attempt grants no authority to replace the Site clock.
      errors += 1
      logger.error('Project watch attempt could not be recorded', error instanceof Error ? error : new Error(String(error)), { projectId: project.id })
      return
    }
    let mutationScope: Prisma.ProjectWhereInput = { ...attemptScope, watchLastAttemptAt: attemptedAt }
    try {
      const effective = await loadEffectiveEntitlements(project.userId, undefined, clock)
      if (!effective?.available) return
      if (!effective.watchIntervals.length) {
        await writeSchedule(project.id, mutationScope, {
          watchInterval: null,
          watchEveryMinutes: null,
          watchNextRunAt: null,
          watchLeaseUntil: null,
          watchLastError: WATCH_MESSAGES.accountUnavailable,
        })
        return
      }
      if (!effective.watchIntervals.includes(interval)) {
        await writeSchedule(project.id, mutationScope,
          { watchNextRunAt: null, watchLeaseUntil: null, watchLastError: WATCH_MESSAGES.scheduleUnavailable })
        return
      }
      const claimedAt = clock.now()
      const leaseUntil = new Date(claimedAt.getTime() + LEASE_MS)
      const claimed = await writeSchedule(project.id,
        { ...mutationScope, OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: claimedAt } }] }, { watchLeaseUntil: leaseUntil }, true)
      if (claimed.count !== 1) return
      mutationScope = { ...unchangedSchedule, watchLastAttemptAt: attemptedAt, watchLeaseUntil: leaseUntil }
      processed += 1

      await productTransaction(async tx => {
        if (authority) await lockAdminDomainActor(authority.actor, project.userId, project.id, tx)
        await ensureDefaultMonitoring(tx, project.id, project.userId, clock.now())
      })
      // Current admissions own their overlap and replay decision. Only older
      // executions without active request ownership need this compatibility guard.
      const physicalNow = clock.now()
      const active = await prisma.audit.findFirst({
        where: {
          projectId: project.id,
          recheckTrigger: 'WATCH',
          status: { notIn: ['COMPLETED', 'FAILED'] },
          runRequests: { none: { status: { in: [...ACTIVE_RUN_STATUSES] } } },
          OR: [{ executionLeaseUntil: { gt: physicalNow } }, {
            executionSpec: { path: ['engine'], equals: 'progressive-v1' }, recoveryUntil: { gt: physicalNow },
          }],
        },
        select: { id: true },
      })
      if (active) {
        await writeSchedule(project.id, mutationScope, { watchLeaseUntil: null, watchNextRunAt: retryAt(1, clock.now()) })
        return
      }

      const admissionAt = clock.now()
      if (admissionAt >= leaseUntil) return
      const scheduled = await requestScheduledSiteRun({
        projectId: project.id, userId: project.userId, interval,
        everyMinutes: project.watchEveryMinutes, scheduledAt: project.watchNextRunAt ?? admissionAt, now: admissionAt,
        claim: { attemptedAt, leaseUntil, targetUrl: project.url, targetRevision: project.watchTargetRevision },
        ...(dependencies.operator ? { operator: dependencies.operator } : {}),
      })
      if (scheduled.runId) enqueued += 1
    } catch (error) {
      if (error instanceof AdminActionError) throw error
      if (error instanceof SiteRunRefusal && error.code === 'WATCH_CLAIM_CHANGED') return
      errors += 1
      if (error instanceof ScheduledRunCommitDeferred) {
        // Keep the due slot and its receipt key. The current lease bounds
        // retries and the next claim will attach the same admitted run.
        logger.error('Scheduled run admitted; schedule commit deferred', error, { projectId: project.id, runId: error.runId })
        return
      }
      try {
        const failedAt = clock.now()
        if (error instanceof SiteRunRefusal && error.code === 'SITE_RUN_IN_PROGRESS') {
          await writeSchedule(project.id, mutationScope, { watchLeaseUntil: null, watchNextRunAt: retryAt(1, failedAt) })
          errors -= 1
          return
        }
        const usageLimit = (error && typeof error === 'object' ? error : {}) as {
          code?: string
          renewalAt?: Date
        }
        if (usageLimit.code === 'UPGRADE_REQUIRED' || usageLimit.code === 'TOKEN_LIMIT') {
          await writeSchedule(project.id, mutationScope, {
            watchLeaseUntil: null,
            watchNextRunAt:
              usageLimit.renewalAt && usageLimit.renewalAt > failedAt
                ? usageLimit.renewalAt
                : calcWatchNextRun(interval, failedAt, project.watchEveryMinutes),
            watchLastError: WATCH_MESSAGES.allowanceUsed,
          })
          errors -= 1
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Project watch tick failed', error instanceof Error ? error : new Error(message), {
          projectId: project.id,
        })
        const failures = project.watchConsecutiveFailures + 1
        await writeSchedule(project.id, mutationScope, { watchLeaseUntil: null, watchConsecutiveFailures: failures,
          watchLastError: WATCH_MESSAGES.retryPending, watchNextRunAt: retryAt(failures, failedAt) })
      } catch (persistenceError) {
        if (persistenceError instanceof AdminActionError) throw persistenceError
        logger.error('Project watch retry could not be saved', persistenceError instanceof Error ? persistenceError : new Error(String(persistenceError)), {
          projectId: project.id,
        })
      }
    }
  }

  async function admitDue(take: number, excludeProjectIds?: readonly string[]) {
    const due = await selectDueWatchProjects(clock.now(), take, {
      projectId: dependencies.onlyProjectId, userId: authority?.userId, excludeProjectIds,
    })
    // A slow admission holds only its owner's lane. Within this sweep, preserve
    // due order for that owner's Sites sharing analysis allowances.
    const byOwner = new Map<string, DueSites>()
    for (const project of due) {
      const owned = byOwner.get(project.userId)
      if (owned) owned.push(project)
      else byOwner.set(project.userId, [project])
    }
    const pending = byOwner.values()
    const lanes = await Promise.allSettled(Array.from({ length: Math.min(WATCH_ADMISSION_CONCURRENCY, byOwner.size) }, async () => {
      for (const owned of pending) for (const project of owned) await admitSite(project)
    }))
    const failed = lanes.find(result => result.status === 'rejected')
    if (failed) throw failed.reason
    return due.map(project => project.id)
  }

  if (dependencies.onlyProjectId) {
    await recover()
    await admitDue(limit)
  } else {
    // Due selection excludes each Site whose own receipt still needs recovery.
    const [recovery, admission] = await Promise.allSettled([recover(), admitDue(limit)])
    if (recovery.status === 'rejected') throw recovery.reason
    if (admission.status === 'rejected') throw admission.reason
    if (recovery.value > 0 && admission.value.length < limit)
      await admitDue(limit - admission.value.length, admission.value)
  }
  return { processed, enqueued, errors }
}

/** Read committed comparison facts and persist current alert eligibility. */
async function prepareWatchNotification(childAuditId: string, delivery = false) {
  const child = await prisma.audit.findUnique({
    where: { id: childAuditId },
    select: {
      id: true,
      url: true,
      projectId: true,
      parentId: true,
      parent: { select: { projectId: true } },
      userId: true,
      status: true,
      recheckTrigger: true,
      completedAt: true,
      improvementProjectedAt: true,
      watchRegressionCount: true,
      watchRecoveryCount: true,
      watchNotificationStatus: true,
      watchNotificationAttempts: true,
      watchNotificationLastError: true,
      watchNotificationNextAttemptAt: true,
      watchNotificationAttemptCeiling: true,
      watchNotificationLeaseUntil: true,
      watchNotificationPayload: true,
      runRequests: { where: { source: 'WATCH' }, select: { id: true, projectId: true, context: true } },
      user: { select: { email: true, emailVerified: true, name: true, lifecycleStatus: true } },
      project: { select: { userId: true, deletedAt: true, watchInterval: true, watchPausedAt: true, watchTargetRevision: true, notificationLevel: true, notifyOnRecovery: true } },
    },
  })
  if (!child || child.status !== 'COMPLETED' || !child.completedAt || !child.userId ||
    child.user?.lifecycleStatus !== 'ACTIVE' || delivery && !child.improvementProjectedAt ||
    !child.projectId || !child.project ||
    child.project.deletedAt != null || child.project.userId !== child.userId) return
  const revision = child.project.watchTargetRevision ?? 1
  const proof = (runs: Array<{ id: string; context: Prisma.JsonValue | null }>) =>
    runs.map(run => ({ id: run.id, context: { equals: run.context ?? Prisma.AnyNull } }))
  let monitoringSource: Prisma.AuditWhereInput
  if (child.recheckTrigger === 'WATCH') {
    const native = (child.runRequests ?? []).filter(run => run.projectId === child.projectId)
    const current = native.filter(run => recordedWatchTargetRevision(run.context) === revision)
    if (!current.length && (revision !== 1 || native.length)) return
    const duty = { source: 'WATCH' as const, projectId: child.projectId }
    monitoringSource = { recheckTrigger: 'WATCH', runRequests: current.length
      ? { some: { ...duty, OR: proof(current) } } : { none: duty } }
  } else {
    const committed = await prisma.runRequest.findMany({ where: { auditId: child.id, ...sharedWatchRunWhere(child.projectId) },
      select: { id: true, context: true } })
    const decoded = committed.flatMap(run => {
      const scheduled = readScheduledContext(run.context)
      return scheduled.success ? [{ run, revision: scheduled.data.targetRevision ?? 1 }] : []
    })
    if (!decoded.length) {
      if (committed.length) throw new Error('Committed monitoring schedule is unavailable')
      return
    }
    const valid = decoded.filter(item => item.revision === revision && recordedWatchTargetRevision(item.run.context) === revision).map(item => item.run)
    if (!valid.length) return
    // The validated schedule and its server-owned Watch key must still exist
    // at classification and provider admission, not just at this earlier read.
    monitoringSource = { runRequests: { some: { ...sharedWatchRunWhere(child.projectId),
      OR: proof(valid) } } }
  }
  const completedSource = {
    id: child.id, userId: child.userId, projectId: child.projectId, status: 'COMPLETED' as const,
    ...monitoringSource, completedAt: child.completedAt,
    ...(delivery ? { improvementProjectedAt: { not: null } } : {}),
  }
  const currentOwner = { userId: child.userId, deletedAt: null, watchTargetRevision: revision, user: { lifecycleStatus: 'ACTIVE' as const } }
  const currentEligibility: Prisma.AuditWhereInput = {
    ...completedSource,
    parentId: child.parentId,
    ...(child.parentId ? { parent: { projectId: child.projectId } } : {}),
    user: { lifecycleStatus: 'ACTIVE', email: child.user.email, emailVerified: child.user.emailVerified },
    project: { ...currentOwner, watchPausedAt: child.project.watchPausedAt ?? null,
      notificationLevel: child.project.notificationLevel, notifyOnRecovery: child.project.notifyOnRecovery },
  }
  await prisma.project.updateMany({
    where: { id: child.projectId, ...currentOwner, audits: { some: completedSource },
      OR: [{ watchLastRunAt: null }, { watchLastRunAt: { lt: child.completedAt } }] },
    // Completion belongs to a dated observation of the current owner's Site.
    // Delivery retries cannot fabricate a check time, rewind it or clear a lease.
    data: { watchLastRunAt: child.completedAt },
  })
  // Provider acceptance is already confirmed. Historical rows may not have the newer
  // recovery classification, but rewriting SENT to PENDING while backfilling
  // would make the same alert eligible for delivery again.
  if (child.watchNotificationStatus === 'SENT') return
  if (child.parentId && child.parent?.projectId !== child.projectId) return

  const summary = await getFlagDiffSummary(child.parentId, childAuditId)
  // Apply today's preferences on every retry, including the destination. A
  // queued alert is not permission to ignore a customer's later opt-out.
  const alertRegressions = [...summary.regressed, ...summary.newIssues].filter((flag) =>
    isCustomerFlag(flag) && child.project?.notificationLevel !== 'OFF' &&
    (child.project?.notificationLevel !== 'CRITICAL_ONLY' || flag.severity === 'CRITICAL')
  )
  const recoveries = summary.fixed.filter((flag) => isCustomerFlag({ ...flag, status: 'OPEN' }))
  const alertRecoveries = child.project?.notificationLevel !== 'OFF' && child.project?.notifyOnRecovery
    ? recoveries : []
  const regressCount = alertRegressions.length
  const recoveryCount = recoveries.length
  const alertRecoveryCount = alertRecoveries.length
  let priorStatus = child.watchNotificationStatus
  if (child.watchNotificationStatus !== 'SENDING' &&
      (child.watchRegressionCount === null || child.watchRecoveryCount === null)) {
    const status = regressCount > 0 || alertRecoveryCount > 0 ? 'PENDING' : 'NOT_APPLICABLE'
    const classified = await prisma.audit.updateMany({
      where: { ...currentEligibility, watchNotificationStatus: { notIn: ['SENT', 'SENDING'] },
        OR: [{ watchRegressionCount: null }, { watchRecoveryCount: null }] },
      data: {
        watchRegressionCount: regressCount,
        watchRecoveryCount: recoveryCount,
        watchNotificationStatus: status,
      },
    })
    if (classified.count === 1) priorStatus = status
  }
  if (child.project.watchPausedAt || regressCount === 0 && alertRecoveryCount === 0) {
    // A later opt-out can cancel due work, including an expired claim. It
    // cannot cancel a live provider call or rewrite confirmed acceptance.
    await prisma.audit.updateMany({
      where: { ...currentEligibility, OR: [
        { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
        { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: new Date() } }] },
      ] },
      data: { watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationLeaseUntil: null, watchNotificationNextAttemptAt: null },
    })
    return
  }

  return { child, currentEligibility, priorStatus, projectId: child.projectId, regressCount, recoveryCount, alertRegressions, alertRecoveries }
}

/** Persist alert eligibility before the monitoring completion receipt, without contacting the provider. */
export async function classifyWatchResult(childAuditId: string): Promise<void> {
  await prepareWatchNotification(childAuditId)
}

export async function notifyWatchRegression(childAuditId: string): Promise<void> {
  const prepared = await prepareWatchNotification(childAuditId, true)
  if (!prepared) return
  const { child, currentEligibility, priorStatus, projectId, regressCount, recoveryCount, alertRegressions, alertRecoveries } = prepared
  // Classification and monitoring remain available while address ownership is
  // unconfirmed. Keep the delivery intent for a later verified recipient read.
  if (!child.user?.emailVerified) return

  // Never overwrite a claim another worker still holds. Writing FAILED here
  // would both lose their delivery and mark the alert failed while it is still
  // legitimately in flight.
  const deliveryNow = new Date()
  const leaseHeld = child.watchNotificationStatus === 'SENDING'
    && child.watchNotificationLeaseUntil != null
    && child.watchNotificationLeaseUntil > deliveryNow
  if (leaseHeld) return
  if (!await notificationRecipientAllowed(child.user!.email)) {
    await prisma.audit.updateMany({ where: { ...currentEligibility, watchNotificationStatus: { not: 'SENT' },
      OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: deliveryNow } }] },
    data: { watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationLeaseUntil: null } })
    return
  }

  // A worker may die after the provider call on the final allowed claim. Once
  // that lease expires, another send could duplicate an accepted email, while
  // leaving SENDING forever falsely tells the customer delivery is in progress.
  // Terminalize the uncertainty without making an unbounded sixth attempt.
  if (
    child.watchNotificationStatus === 'SENDING'
    && child.watchNotificationAttempts >= child.watchNotificationAttemptCeiling
    && (child.watchNotificationLeaseUntil == null || child.watchNotificationLeaseUntil <= deliveryNow)
  ) {
    await prisma.audit.updateMany({
      where: {
        id: childAuditId,
        watchNotificationStatus: 'SENDING',
        watchNotificationAttemptCeiling: child.watchNotificationAttemptCeiling,
        watchNotificationAttempts: { gte: child.watchNotificationAttemptCeiling },
        OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: deliveryNow } }],
      },
      data: {
        watchNotificationStatus: 'FAILED',
        watchNotificationLastError: 'Delivery confirmation expired after the final attempt',
        watchNotificationLeaseUntil: null,
        watchNotificationNextAttemptAt: null,
      },
    })
    return
  }

  if (child.watchNotificationNextAttemptAt && child.watchNotificationNextAttemptAt > deliveryNow) return

  let preparation: { payload: ReturnType<typeof selectWatchEmailDelivery> } | { error: unknown }
  try {
    if (!child.user?.email || !resend) throw new Error('Email delivery is not configured')
    const selection = watchEmailSelection(projectId, alertRegressions, alertRecoveries)
    const broadLegacyPermission = child.project?.notificationLevel !== 'CRITICAL_ONLY' && child.project?.notifyOnRecovery !== false
    const emailRegressions = hasRecordedWatchSelection(child.watchNotificationPayload, selection, broadLegacyPermission)
      ? alertRegressions : await loadEmailRepairFindings(projectId, child.userId!, alertRegressions)
    const selected = selectWatchEmailDelivery({ auditId: child.id, recorded: child.watchNotificationPayload,
      broadLegacyPermission,
      receiptOwnerId: child.watchNotificationPayload || child.watchNotificationAttempts === 0 ? child.userId! : undefined,
      fresh: watchEmailPayloadSchema.parse({ version: 1, from: FROM_EMAIL, to: child.user.email,
        firstAttemptAt: !child.watchNotificationPayload && child.watchNotificationAttempts > 0 ? child.completedAt!.toISOString() : new Date().toISOString(),
        ...siteNotificationEmail({ projectId, url: child.url, name: child.user.name,
          checkedAt: child.completedAt, regressions: emailRegressions, recoveries: alertRecoveries }),
        tags: [{ name: 'audit_id', value: child.id }, { name: 'purpose', value: 'watch' }],
        selection }) })
    preparation = { payload: prepareNotificationReplay(selected, new Date(), child.completedAt!) }
  } catch (error) { preparation = { error } }

  // The claim is a lease, not a one-way flip. SENDING is claimable again once
  // the lease expires, so a worker that dies mid-delivery cannot suppress the
  // alert forever. A held lease is excluded, so a second worker never steals a
  // delivery that is still in flight.
  const claimNow = new Date()
  const claimLease = new Date(claimNow.getTime() + NOTIFICATION_LEASE_MS)
  const claimed = await prisma.audit.updateMany({
    where: {
      ...currentEligibility,
      watchNotificationStatus: priorStatus,
      watchNotificationPayload: { equals: child.watchNotificationPayload ?? Prisma.DbNull },
      watchNotificationNextAttemptAt: child.watchNotificationNextAttemptAt ?? null,
      // Eligibility can change after classification. The claim is the last
      // admission boundary before the external provider operation.
      watchNotificationAttemptCeiling: child.watchNotificationAttemptCeiling,
      watchNotificationAttempts: { equals: child.watchNotificationAttempts, lt: child.watchNotificationAttemptCeiling },
      OR: [
        { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
        {
          watchNotificationStatus: 'SENDING',
          OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: claimNow } }],
        },
      ],
    },
    data: {
      watchNotificationStatus: 'SENDING',
      watchNotificationAttempts: { increment: 1 },
      watchNotificationLastError: null,
      watchNotificationLeaseUntil: claimLease,
      watchNotificationNextAttemptAt: null,
      ...('payload' in preparation ? { watchNotificationPayload: preparation.payload } : {}),
    },
  })
  if (claimed.count !== 1) return
  const ownedClaim = { id: childAuditId, watchNotificationStatus: 'SENDING' as const,
    watchNotificationAttempts: child.watchNotificationAttempts + 1, watchNotificationLeaseUntil: claimLease }

  try {
    const recipientAllowed = 'payload' in preparation ? await notificationRecipientAllowed(preparation.payload.to) : true
    // A claim can wait on the audit row while its permission snapshot grows stale.
    // Check the committed authority and lease again before starting delivery.
    if (!await prisma.audit.findFirst({ where: { ...currentEligibility, ...ownedClaim }, select: { id: true } })) {
      await prisma.audit.updateMany({ where: ownedClaim, data: {
        watchNotificationStatus: priorStatus,
        watchNotificationAttempts: { decrement: 1 },
        watchNotificationLastError: child.watchNotificationLastError,
        watchNotificationLeaseUntil: child.watchNotificationLeaseUntil,
        watchNotificationNextAttemptAt: child.watchNotificationNextAttemptAt,
        watchNotificationPayload: (child.watchNotificationPayload as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      } })
      return
    }
    if ('error' in preparation) throw preparation.error
    if (!child.user?.email || !resend) throw new Error('Email delivery is not configured')
    const { payload } = preparation
    if (!recipientAllowed) {
      await prisma.audit.updateMany({ where: ownedClaim, data: {
        watchNotificationStatus: 'NOT_APPLICABLE',
        watchNotificationAttempts: { decrement: 1 },
        watchNotificationLeaseUntil: null,
      } })
      return
    }
    if (claimLease.getTime() - Date.now() <= NOTIFICATION_REQUEST_TIMEOUT_MS)
      throw new Error('Notification claim has insufficient time for provider delivery')
    assertNotificationReplayWindow(payload.firstAttemptAt, new Date())
    const message = watchEmailProviderBody(payload)
    const providerId = await sendNotificationEmail(resend, message, payload.deliveryKey!)
    const recorded = await prisma.audit.updateMany({
      where: ownedClaim,
      data: {
        watchNotificationStatus: 'SENT',
        watchNotificationProviderId: providerId,
        watchNotifiedAt: new Date(),
        watchNotificationLastError: null,
        watchNotificationLeaseUntil: null,
        watchNotificationNextAttemptAt: null,
      },
    })
    if (recorded.count !== 1) return
    await projectEmailAcceptance({ providerId, userId: child.userId!, email: message.to,
      channel: 'watch', sourceId: childAuditId, acceptedAt: new Date(), firstAttemptAt: new Date(payload.firstAttemptAt!) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.audit.updateMany({
      where: ownedClaim,
      data: {
        watchNotificationStatus: 'FAILED',
        watchNotificationLastError: message.slice(0, 1000),
        watchNotificationLeaseUntil: null,
        watchNotificationNextAttemptAt: notificationRetryAt(child.watchNotificationAttempts + 1, new Date()),
      },
    })
    logger.warn('Watch regression email failed', { childAuditId, error: message })
    return
  }

  // Analytics failure must not undo confirmed delivery or schedule another email.
  try {
    await recordSiteLifecycleEvent({
      name: 'notification_sent',
      idempotencyKey: `watch-notification:${child.id}`,
      projectId,
      properties: { regressionCount: regressCount, recoveryCount },
    })
  } catch (error) {
    logger.warn('Watch notification telemetry failed', {
      childAuditId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function retryPendingWatchNotifications(limit = 20): Promise<number> {
  const now = new Date()
  const retryable = Prisma.sql`((due."watchNotificationStatus" IN ('PENDING', 'FAILED')
      AND due."watchNotificationAttempts" < due."watchNotificationAttemptCeiling")
    OR (due."watchNotificationStatus" = 'SENDING'
      AND (due."watchNotificationLeaseUntil" IS NULL OR due."watchNotificationLeaseUntil" <= ${now})))`
  // Ownership equality must be checked before LIMIT. Otherwise historical
  // observations from transferred Sites can permanently occupy the retry batch.
  // Expired SENDING claims remain selectable at their ceiling so the sender can
  // terminalize abandoned final attempts without making another provider call.
  const audits = await prisma.$queryRaw<Array<Pick<Audit, 'id' | 'watchNotificationAttempts' |
    'watchNotificationStatus' | 'watchNotificationLeaseUntil' | 'watchNotificationNextAttemptAt'> & { projectId: string }>>(Prisma.sql`
    WITH shared AS MATERIALIZED (${scheduledObservationAuditsSql}),
    due AS NOT MATERIALIZED (
      SELECT a.id, a."parentId", a."projectId", a."userId", a."updatedAt", a."recheckTrigger",
        a."watchNotificationAttempts", a."watchNotificationAttemptCeiling", a."watchNotificationStatus",
        a."watchRegressionCount", a."watchRecoveryCount", a."watchNotificationLeaseUntil", a."watchNotificationNextAttemptAt"
      FROM audits a WHERE ${watchNotificationSourceReadySql}
        AND (a."watchNotificationNextAttemptAt" IS NULL OR a."watchNotificationNextAttemptAt" <= ${now})
    )
    SELECT a.id, a."projectId", a."watchNotificationAttempts", a."watchNotificationStatus",
      a."watchNotificationLeaseUntil", a."watchNotificationNextAttemptAt"
    FROM (
      SELECT due.* FROM due WHERE due."recheckTrigger" = 'WATCH' AND ${retryable}
      UNION ALL
      SELECT due.* FROM shared JOIN due ON due.id = shared."auditId" AND due."projectId" = shared."projectId"
      WHERE due."recheckTrigger" IS DISTINCT FROM 'WATCH' AND (${retryable}
        OR (due."watchNotificationStatus" = 'NOT_APPLICABLE' AND due."watchRegressionCount" IS NULL AND due."watchRecoveryCount" IS NULL))
    ) a
    JOIN projects p ON p.id = a."projectId" AND p."userId" = a."userId"
    JOIN users u ON u.id = a."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND u."emailVerified" = true
      AND (a."recheckTrigger" IS DISTINCT FROM 'WATCH' OR ${currentNativeWatchTargetSql})
      AND ${sameSiteWatchParentSql}
    ORDER BY ROW_NUMBER() OVER (PARTITION BY a."projectId" ORDER BY a."updatedAt", a.id),
      a."updatedAt" ASC, a.id ASC
    LIMIT ${limit}
  `)
  async function deliver(audit: (typeof audits)[number]) {
    try {
      await notifyWatchRegression(audit.id)
    } catch (error) {
      // A broken audit must not prevent alerts for the rest of the batch.
      logger.warn('Watch notification retry failed', {
        childAuditId: audit.id,
        error: error instanceof Error ? error.message : String(error),
      })
      // Move unreadable classification behind other due rows without consuming
      // a provider attempt or changing another sender's delivery state.
      try {
        await prisma.audit.updateMany({ where: { id: audit.id,
          watchNotificationAttempts: audit.watchNotificationAttempts,
          watchNotificationStatus: audit.watchNotificationStatus,
          watchNotificationLeaseUntil: audit.watchNotificationLeaseUntil,
          watchNotificationNextAttemptAt: audit.watchNotificationNextAttemptAt,
          OR: [{ watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
            { watchNotificationStatus: 'NOT_APPLICABLE', watchRegressionCount: null, watchRecoveryCount: null },
            { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: now } }] }] },
          data: { watchNotificationNextAttemptAt: new Date(Date.now() + 30_000),
            watchNotificationLastError: 'Notification classification could not complete' } })
      } catch (updateError) {
        logger.warn('Watch notification retry could not be deferred', { childAuditId: audit.id,
          error: updateError instanceof Error ? updateError.message : String(updateError) })
      }
    }
  }
  await deliverNotificationBatch(audits, audit => audit.projectId, deliver)
  return audits.length
}
