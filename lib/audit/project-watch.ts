import { assertAdminDomainActor } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy'
import { siteNotificationEmail } from '@/lib/email/site-notification'
import { watchEmailPayloadSchema } from '@/lib/email/watch-payload'
import { selectWatchEmailDelivery, watchEmailProviderBody, watchEmailSelection } from '@/lib/email/watch-delivery'
import { sendNotificationEmail } from '@/lib/email/notification-delivery'
import { systemClock, type Clock } from '@/lib/time/clock'
import { isCustomerFlag } from '@/lib/audit/attention'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { requestScheduledSiteRun } from '@/lib/sites/application/scheduled-runs'
import {
  calcWatchNextRun,
  fromStoredWatchInterval,
} from '@/lib/audit/watch-interval'
import { ensureDefaultMonitoring, initializeDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'

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

async function recordWatchFailure(where: Prisma.ProjectWhereInput, failures: number, error: string, now: Date) {
  await prisma.project.updateMany({
    where,
    data: {
      watchLeaseUntil: null,
      watchConsecutiveFailures: failures,
      watchLastError: error.slice(0, 1000),
      watchNextRunAt: retryAt(failures, now),
    },
  })
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
  let operatorOwnerId: string | undefined
  if (dependencies.operator) {
    if (!dependencies.onlyProjectId)
      throw new AdminActionError('Choose a Site for operator reconciliation.', 403, 'ADMIN_DOMAIN_SCOPE_DENIED')
    const project = await prisma.project.findFirst({ where: { id: dependencies.onlyProjectId, deletedAt: null }, select: { userId: true } })
    if (!project) throw new SiteRunRefusal('Site not found', 404)
    await assertAdminDomainActor(dependencies.operator, project.userId, dependencies.onlyProjectId)
    operatorOwnerId = project.userId
  }
  if(!dependencies.onlyProjectId)await initializeDefaultMonitoring(limit, clock)
  const selectedAt = clock.now()
  const due = await prisma.project.findMany({
    where: {
      ...(dependencies.onlyProjectId?{id:dependencies.onlyProjectId}:{}),
      ...(operatorOwnerId ? { userId: operatorOwnerId } : {}),
      deletedAt: null,
      user: { lifecycleStatus: 'ACTIVE' },
      watchInterval: { not: null },
      watchNextRunAt: { lte: selectedAt },
      OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: selectedAt } }],
    },
    take: limit,
    orderBy: [{ watchLastAttemptAt: { sort: 'asc', nulls: 'first' } }, { watchNextRunAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      watchInterval: true,
      watchEveryMinutes: true,
      watchNextRunAt: true,
      watchLastAttemptAt: true,
      watchConsecutiveFailures: true,
    },
  })

  let processed = 0
  let enqueued = 0
  let errors = 0

  for (const project of due) {
    const attemptedAt = clock.now()
    const interval = fromStoredWatchInterval(project.watchInterval)
    if (!interval) continue
    const unchangedSchedule = { id: project.id, userId: project.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' as const },
      watchInterval: project.watchInterval, watchEveryMinutes: project.watchEveryMinutes ?? null, watchNextRunAt: project.watchNextRunAt }
    const availableLease = { OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: attemptedAt } }] }
    let mutationScope: Prisma.ProjectWhereInput = { ...unchangedSchedule, ...availableLease,
      watchLastAttemptAt: project.watchLastAttemptAt ?? null }
    try {
      // Record admission effort before fallible policy reads and retry writes.
      // An interrupted Site retains its due intent while later Sites get a turn.
      const attempted = await prisma.project.updateMany({
        where: mutationScope,
        data: { watchLastAttemptAt: attemptedAt },
      })
      if (attempted.count !== 1) continue
      mutationScope = { ...mutationScope, watchLastAttemptAt: attemptedAt }
      const effective = await loadEffectiveEntitlements(project.userId, undefined, clock)
      if (!effective?.available) continue
      if (!effective.watchIntervals.length) {
        await prisma.project.updateMany({
          where: mutationScope,
          data: {
            watchInterval: null,
            watchEveryMinutes: null,
            watchNextRunAt: null,
            watchLeaseUntil: null,
            watchLastError: 'Watching is not available on this account.',
          },
        })
        continue
      }
      if (!effective.watchIntervals.includes(interval)) {
        await prisma.project.updateMany({
          where: mutationScope,
          data: { watchNextRunAt: null, watchLeaseUntil: null, watchLastError: 'This schedule is not available on your plan. Choose an available monitoring schedule.' },
        })
        continue
      }
      const claimedAt = clock.now()
      const leaseUntil = new Date(claimedAt.getTime() + LEASE_MS)
      const claimed = await prisma.project.updateMany({
        where: { ...mutationScope, OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: claimedAt } }] },
        data: {
          watchLeaseUntil: leaseUntil,
        },
      })
      if (claimed.count !== 1) continue
      mutationScope = { ...unchangedSchedule, watchLastAttemptAt: attemptedAt, watchLeaseUntil: leaseUntil }
      processed += 1

      await productTransaction(tx => ensureDefaultMonitoring(tx, project.id, project.userId, clock.now()))
      const active = await prisma.audit.findFirst({
        where: {
          projectId: project.id,
          recheckTrigger: 'WATCH',
          status: { notIn: ['COMPLETED', 'FAILED'] },
        },
        select: { id: true },
      })
      if (active) {
        await prisma.project.updateMany({
          where: mutationScope,
          data: { watchLeaseUntil: null, watchNextRunAt: retryAt(1, clock.now()) },
        })
        continue
      }

      const admissionAt = clock.now()
      if (admissionAt >= leaseUntil) continue
      await requestScheduledSiteRun({
        projectId: project.id, userId: project.userId, interval,
        everyMinutes: project.watchEveryMinutes, scheduledAt: project.watchNextRunAt ?? admissionAt, now: admissionAt,
        ...(dependencies.operator ? { operator: dependencies.operator } : {}),
      })
      enqueued += 1
      // A saved schedule can change while a check is being queued. Advance
      // only the schedule this worker claimed, preserving the owner's edit.
      await prisma.project.updateMany({
        where: mutationScope,
        data: {
          watchLeaseUntil: null,
          watchNextRunAt: calcWatchNextRun(interval, admissionAt, project.watchEveryMinutes),
          watchConsecutiveFailures: 0,
          watchLastError: null,
        },
      })
    } catch (error) {
      errors += 1
      try {
        const failedAt = clock.now()
        const usageLimit = (error && typeof error === 'object' ? error : {}) as {
          code?: string
          renewalAt?: Date
        }
        if (usageLimit.code === 'UPGRADE_REQUIRED' || usageLimit.code === 'TOKEN_LIMIT') {
          await prisma.project.updateMany({
            where: mutationScope,
            data: {
              watchLeaseUntil: null,
              watchNextRunAt:
                usageLimit.renewalAt && usageLimit.renewalAt > failedAt
                  ? usageLimit.renewalAt
                  : calcWatchNextRun(interval, failedAt, project.watchEveryMinutes),
              watchLastError:
                'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
            },
          })
          errors -= 1
          continue
        }
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Project watch tick failed', error instanceof Error ? error : new Error(message), {
          projectId: project.id,
        })
        await recordWatchFailure(
          mutationScope,
          project.watchConsecutiveFailures + 1,
          message,
          failedAt
        )
      } catch (persistenceError) {
        logger.error('Project watch retry could not be saved', persistenceError instanceof Error ? persistenceError : new Error(String(persistenceError)), {
          projectId: project.id,
        })
      }
    }
  }

  return { processed, enqueued, errors }
}

/** Read committed comparison facts and persist current alert eligibility. */
async function prepareWatchNotification(parentAuditId: string | null, childAuditId: string, delivery = false) {
  const child = await prisma.audit.findUnique({
    where: { id: childAuditId },
    select: {
      id: true,
      url: true,
      projectId: true,
      userId: true,
      status: true,
      recheckTrigger: true,
      completedAt: true,
      improvementProjectedAt: true,
      watchRegressionCount: true,
      watchRecoveryCount: true,
      watchNotificationStatus: true,
      watchNotificationAttempts: true,
      watchNotificationAttemptCeiling: true,
      watchNotificationLeaseUntil: true,
      watchNotificationPayload: true,
      user: { select: { email: true, name: true, lifecycleStatus: true } },
      project: { select: { userId: true, deletedAt: true, watchInterval: true, notificationLevel: true, notifyOnRecovery: true } },
    },
  })
  if (!child || child.status !== 'COMPLETED' || !child.completedAt || !child.userId ||
    child.user?.lifecycleStatus !== 'ACTIVE' || delivery && !child.improvementProjectedAt ||
    child.recheckTrigger !== 'WATCH' || !child.projectId || !child.project ||
    child.project.deletedAt != null || child.project.userId !== child.userId) return
  const completedSource = {
    id: child.id, userId: child.userId, projectId: child.projectId, status: 'COMPLETED' as const,
    recheckTrigger: 'WATCH' as const, completedAt: child.completedAt,
    ...(delivery ? { improvementProjectedAt: { not: null } } : {}),
  }
  const currentOwner = { userId: child.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' as const } }
  const currentEligibility: Prisma.AuditWhereInput = {
    ...completedSource,
    user: { lifecycleStatus: 'ACTIVE', email: child.user.email },
    project: { ...currentOwner, notificationLevel: child.project.notificationLevel, notifyOnRecovery: child.project.notifyOnRecovery },
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

  const summary = await getFlagDiffSummary(parentAuditId, childAuditId)
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
  if (child.watchNotificationStatus !== 'SENDING' &&
      (child.watchRegressionCount === null || child.watchRecoveryCount === null)) {
    await prisma.audit.updateMany({
      where: { ...currentEligibility, watchNotificationStatus: { notIn: ['SENT', 'SENDING'] },
        OR: [{ watchRegressionCount: null }, { watchRecoveryCount: null }] },
      data: {
        watchRegressionCount: regressCount,
        watchRecoveryCount: recoveryCount,
        watchNotificationStatus: regressCount > 0 || alertRecoveryCount > 0 ? 'PENDING' : 'NOT_APPLICABLE',
      },
    })
  }
  if (regressCount === 0 && alertRecoveryCount === 0) {
    // A later opt-out can cancel due work, including an expired claim. It
    // cannot cancel a live provider call or rewrite confirmed acceptance.
    await prisma.audit.updateMany({
      where: { ...currentEligibility, OR: [
        { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
        { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: new Date() } }] },
      ] },
      data: { watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationLeaseUntil: null },
    })
    return
  }

  return { child, currentEligibility, projectId: child.projectId, regressCount, recoveryCount, alertRegressions, alertRecoveries }
}

/** Persist alert eligibility before the monitoring completion receipt, without contacting the provider. */
export async function classifyWatchResult(parentAuditId: string | null, childAuditId: string): Promise<void> {
  await prepareWatchNotification(parentAuditId, childAuditId)
}

export async function notifyWatchRegression(parentAuditId: string | null, childAuditId: string): Promise<void> {
  const prepared = await prepareWatchNotification(parentAuditId, childAuditId, true)
  if (!prepared) return
  const { child, currentEligibility, projectId, regressCount, recoveryCount, alertRegressions, alertRecoveries } = prepared

  // Never overwrite a claim another worker still holds. Writing FAILED here
  // would both lose their delivery and mark the alert failed while it is still
  // legitimately in flight.
  const deliveryNow = new Date()
  const leaseHeld = child.watchNotificationStatus === 'SENDING'
    && child.watchNotificationLeaseUntil != null
    && child.watchNotificationLeaseUntil > deliveryNow
  if (leaseHeld) return

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
      },
    })
    return
  }

  // The claim is a lease, not a one-way flip. SENDING is claimable again once
  // the lease expires, so a worker that dies mid-delivery cannot suppress the
  // alert forever. A held lease is excluded, so a second worker never steals a
  // delivery that is still in flight.
  const claimNow = deliveryNow
  const claimLease = new Date(claimNow.getTime() + NOTIFICATION_LEASE_MS)
  const claimed = await prisma.audit.updateMany({
    where: {
      ...currentEligibility,
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
    },
  })
  if (claimed.count !== 1) return
  const ownedClaim = { id: childAuditId, watchNotificationStatus: 'SENDING' as const,
    watchNotificationAttempts: child.watchNotificationAttempts + 1, watchNotificationLeaseUntil: claimLease }

  try {
    if (!child.user?.email || !resend) throw new Error('Email delivery is not configured')
    const payload = selectWatchEmailDelivery({ auditId: child.id, recorded: child.watchNotificationPayload,
      broadLegacyPermission: child.project?.notificationLevel !== 'CRITICAL_ONLY' && child.project?.notifyOnRecovery !== false,
      fresh: watchEmailPayloadSchema.parse({ version: 1, from: FROM_EMAIL, to: child.user.email,
        ...siteNotificationEmail({ projectId, url: child.url, name: child.user.name,
          checkedAt: child.completedAt, regressions: alertRegressions, recoveries: alertRecoveries }),
        tags: [{ name: 'audit_id', value: child.id }, { name: 'purpose', value: 'watch' }],
        selection: watchEmailSelection(projectId, alertRegressions, alertRecoveries) }) })
    if (JSON.stringify(payload) !== JSON.stringify(child.watchNotificationPayload)) {
      const saved = await prisma.audit.updateMany({
        where: { ...ownedClaim, watchNotificationPayload: { equals: child.watchNotificationPayload == null ? Prisma.DbNull : child.watchNotificationPayload } },
        data: { watchNotificationPayload: payload },
      })
      if (saved.count !== 1) return
    }
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
      },
    })
    if (recorded.count !== 1) return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.audit.updateMany({
      where: ownedClaim,
      data: {
        watchNotificationStatus: 'FAILED',
        watchNotificationLastError: message.slice(0, 1000),
        watchNotificationLeaseUntil: null,
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
  const audits = await prisma.audit.findMany({
    where: {
      status: 'COMPLETED',
      recheckTrigger: 'WATCH',
      improvementProjectedAt: { not: null },
      user: { lifecycleStatus: 'ACTIVE' },
      project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
      // SENDING without a lease has no active owner. Claims below the
      // ceiling can be retried; an exhausted final claim is terminalized.
      OR: [
        {
          watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
          watchNotificationAttempts: { lt: prisma.audit.fields.watchNotificationAttemptCeiling },
        },
        { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: now } }] },
      ],
    },
    select: { id: true, parentId: true, watchNotificationAttempts: true },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  })
  for (const audit of audits) {
    try {
      await notifyWatchRegression(audit.parentId, audit.id)
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
          OR: [{ watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
            { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: now } }] }] },
          data: { updatedAt: new Date(), watchNotificationLastError: 'Notification classification could not complete' } })
      } catch (updateError) {
        logger.warn('Watch notification retry could not be deferred', { childAuditId: audit.id,
          error: updateError instanceof Error ? updateError.message : String(updateError) })
      }
    }
  }
  return audits.length
}
