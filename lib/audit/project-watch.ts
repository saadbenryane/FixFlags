import { type User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resend } from '@/lib/email/client'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { canAccessProductWatch, allowedWatchIntervals } from '@/lib/auth/entitlements'
import { systemClock, type Clock } from '@/lib/time/clock'
import { isCustomerFlag } from '@/lib/audit/attention'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import {
  calcWatchNextRun,
  fromStoredWatchInterval,
  toStoredWatchInterval,
  type WatchInterval,
} from '@/lib/audit/watch-interval'
import { WATCH_NOTIFICATION_ATTEMPT_LIMIT } from '@/lib/audit/watch-notification'
import { outcomeFreshnessMinutes } from '@/lib/sites/application/care-policy'

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

export function productWatchReadiness(): { available: boolean; error: string | null } {
  if (!process.env.REDIS_URL) {
    return { available: false, error: 'WATCH_UNAVAILABLE: Redis is not configured' }
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { available: false, error: 'WATCH_UNAVAILABLE: email delivery is not configured' }
  }
  return { available: true, error: null }
}

export async function setProjectWatch(input: {
  projectId: string
  userId: string
  interval: WatchInterval | null
}, dependencies: { clock?: Clock } = {}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const clock = dependencies.clock ?? systemClock
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true, user: true, watchInterval: true },
  })
  if (!project) return { ok: false, error: 'Site not found' }

  if (input.interval) {
    if (!canAccessProductWatch(project.user)) {
      return {
        ok: false,
        error: 'Watching is not available on this account.',
        code: 'WATCH_UNAVAILABLE',
      }
    }
    const allowed = allowedWatchIntervals(project.user)
    if (!allowed.includes(input.interval)) {
      return {
        ok: false,
        error:
          input.interval === 'daily'
            ? 'Daily watching is available on Pro and Studio. Free Sites watch weekly.'
            : 'That watch interval is not available on your plan.',
        code: 'INTERVAL_NOT_ALLOWED',
      }
    }
    const readiness = productWatchReadiness()
    if (!readiness.available) {
      return { ok: false, error: readiness.error!, code: 'WATCH_UNAVAILABLE' }
    }
  }

  const now = clock.now()
  const previous = fromStoredWatchInterval(project.watchInterval)
  const tightened = input.interval === 'daily' && previous !== 'daily'
  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: input.interval
        ? {
            watchInterval: toStoredWatchInterval(input.interval),
            // Tightening the promise cannot wait a whole daily cycle before its
            // first evidence. The scheduler claims this due row normally.
            watchNextRunAt: tightened ? now : calcWatchNextRun(input.interval, now),
            watchLeaseUntil: null,
            watchConsecutiveFailures: 0,
            watchLastError: null,
          }
        : {
            watchInterval: null,
            watchNextRunAt: null,
            watchLeaseUntil: null,
            watchLastError: 'Paused. This Site is not on a check schedule.',
          },
    }),
    prisma.siteOutcome.updateMany({
      where: { projectId: project.id },
      data: { staleAfterMinutes: outcomeFreshnessMinutes(input.interval) },
    }),
  ])
  return { ok: true }
}

function retryAt(failures: number, now: Date): Date {
  return new Date(now.getTime() + RETRY_MS[Math.min(Math.max(failures - 1, 0), RETRY_MS.length - 1)])
}

async function recordWatchFailure(projectId: string, failures: number, error: string, now: Date) {
  await prisma.project.update({
    where: { id: projectId },
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
  dependencies: { clock?: Clock } = {}
): Promise<{
  processed: number
  enqueued: number
  errors: number
}> {
  const now = (dependencies.clock ?? systemClock).now()
  const due = await prisma.project.findMany({
    where: {
      watchInterval: { not: null },
      watchNextRunAt: { lte: now },
      OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: now } }],
    },
    take: limit,
    orderBy: { watchNextRunAt: 'asc' },
    select: {
      id: true,
      userId: true,
      watchInterval: true,
      watchNextRunAt: true,
      watchConsecutiveFailures: true,
      user: true,
    },
  })

  let processed = 0
  let enqueued = 0
  let errors = 0

  for (const project of due) {
    const interval = fromStoredWatchInterval(project.watchInterval)
    if (!interval) continue
    if (!canAccessProductWatch(project.user as User)) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          watchInterval: null,
          watchNextRunAt: null,
          watchLeaseUntil: null,
          watchLastError: 'Watching is not available on this account.',
        },
      })
      continue
    }
    const claimed = await prisma.project.updateMany({
      where: {
        id: project.id,
        watchInterval: project.watchInterval,
        watchNextRunAt: project.watchNextRunAt,
        OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lt: now } }],
      },
      data: {
        watchLeaseUntil: new Date(now.getTime() + LEASE_MS),
        watchLastAttemptAt: now,
      },
    })
    if (claimed.count !== 1) continue
    processed += 1

    try {
      const active = await prisma.audit.findFirst({
        where: {
          projectId: project.id,
          recheckTrigger: 'WATCH',
          status: { notIn: ['COMPLETED', 'FAILED'] },
        },
        select: { id: true },
      })
      if (active) {
        await prisma.project.update({
          where: { id: project.id },
          data: { watchLeaseUntil: null, watchNextRunAt: retryAt(1, now) },
        })
        continue
      }

      const outcomes = await prisma.siteOutcome.findMany({
        where: { projectId: project.id, enabled: true },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      if (outcomes.length === 0) {
        errors += 1
        await recordWatchFailure(
          project.id,
          project.watchConsecutiveFailures + 1,
          'Confirm an Outcome before Watch can verify this Site.',
          now,
        )
        continue
      }
      const outcomeIds = outcomes.map((outcome) => outcome.id)
      const tick = project.watchNextRunAt?.toISOString() ?? now.toISOString()
      await requestSiteRun({
        projectId: project.id,
        outcomeIds,
        userId: project.userId,
        source: 'WATCH',
        idempotencyKey: `watch:${project.id}:${tick}:${outcomeIds.join(',')}`,
        context: { cadence: interval },
      })
      enqueued += 1
      await prisma.project.update({
        where: { id: project.id },
        data: {
          watchLeaseUntil: null,
          watchNextRunAt: calcWatchNextRun(interval, now),
          watchConsecutiveFailures: 0,
          watchLastError: null,
        },
      })
    } catch (error) {
      const usageLimit = error as {
        code?: string
        renewalAt?: Date
      }
      if (usageLimit.code === 'UPGRADE_REQUIRED' || usageLimit.code === 'TOKEN_LIMIT') {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            watchLeaseUntil: null,
            watchNextRunAt:
              usageLimit.renewalAt && usageLimit.renewalAt > now
                ? usageLimit.renewalAt
                : calcWatchNextRun(interval, now),
            watchLastError:
              'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
          },
        })
        continue
      }
      errors += 1
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Project watch tick failed', error instanceof Error ? error : new Error(message), {
        projectId: project.id,
      })
      await recordWatchFailure(
        project.id,
        project.watchConsecutiveFailures + 1,
        message,
        now
      )
    }
  }

  return { processed, enqueued, errors }
}

async function markWatchCompleted(projectId: string, completedAt: Date) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      watchLastRunAt: completedAt,
      watchLeaseUntil: null,
      watchConsecutiveFailures: 0,
      watchLastError: null,
    },
  })
}

/** Persist regression state and deliver at most once for a WATCH child. */
export async function notifyWatchRegression(parentAuditId: string | null, childAuditId: string): Promise<void> {
  const child = await prisma.audit.findUnique({
    where: { id: childAuditId },
    select: {
      id: true,
      url: true,
      projectId: true,
      recheckTrigger: true,
      completedAt: true,
      watchRegressionCount: true,
      watchRecoveryCount: true,
      watchNotificationStatus: true,
      watchNotificationAttempts: true,
      watchNotificationLeaseUntil: true,
      user: { select: { email: true, name: true } },
      project: { select: { watchInterval: true, notificationLevel: true, notifyOnRecovery: true } },
    },
  })
  if (!child || child.recheckTrigger !== 'WATCH' || !child.projectId) return
  await markWatchCompleted(child.projectId, child.completedAt ?? new Date())
  // Delivery is already confirmed. Historical rows may not have the newer
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
    await prisma.audit.update({
      where: { id: childAuditId },
      data: {
        watchRegressionCount: regressCount,
        watchRecoveryCount: recoveryCount,
        watchNotificationStatus: regressCount > 0 || alertRecoveryCount > 0 ? 'PENDING' : 'NOT_APPLICABLE',
      },
    })
  }
  if (regressCount === 0 && alertRecoveryCount === 0) {
    if (child.watchNotificationStatus === 'PENDING' || child.watchNotificationStatus === 'FAILED') {
      await prisma.audit.updateMany({
        where: { id: childAuditId, watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
        data: { watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationLeaseUntil: null },
      })
    }
    return
  }

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
    && child.watchNotificationAttempts >= WATCH_NOTIFICATION_ATTEMPT_LIMIT
    && child.watchNotificationLeaseUntil != null
    && child.watchNotificationLeaseUntil <= deliveryNow
  ) {
    await prisma.audit.updateMany({
      where: {
        id: childAuditId,
        watchNotificationStatus: 'SENDING',
        watchNotificationAttempts: { gte: WATCH_NOTIFICATION_ATTEMPT_LIMIT },
        watchNotificationLeaseUntil: { lte: deliveryNow },
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
  const claimed = await prisma.audit.updateMany({
    where: {
      id: childAuditId,
      watchNotificationAttempts: { lt: WATCH_NOTIFICATION_ATTEMPT_LIMIT },
      OR: [
        { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
        {
          watchNotificationStatus: 'SENDING',
          watchNotificationLeaseUntil: { lt: claimNow },
        },
      ],
    },
    data: {
      watchNotificationStatus: 'SENDING',
      watchNotificationAttempts: { increment: 1 },
      watchNotificationLastError: null,
      watchNotificationLeaseUntil: new Date(claimNow.getTime() + NOTIFICATION_LEASE_MS),
    },
  })
  if (claimed.count !== 1) return

  const host = (() => {
    try { return new URL(child.url).hostname } catch { return child.url }
  })()

  const subject = regressCount > 0
    ? `Needs attention on ${host}: ${regressCount} Flag${regressCount === 1 ? '' : 's'}`
    : `Recovery verified on ${host}`
  const lead = regressCount > 0
    ? `FixFlags found <strong>${regressCount}</strong> problem${regressCount === 1 ? '' : 's'} that need${regressCount === 1 ? 's' : ''} attention on <strong>${escapeEmailHtml(host)}</strong>.`
    : `An independent check verified ${alertRecoveryCount === 1 ? 'a recovery' : `<strong>${alertRecoveryCount}</strong> recoveries`} on <strong>${escapeEmailHtml(host)}</strong>.`
  // Recovered rows live on the parent. Use the same eligible items for counts,
  // problem text and the exact Flag link; never link a filtered-out finding.
  const leadFlag = [...alertRegressions, ...alertRecoveries].find((flag) => flag.id)
  const destination = leadFlag?.id
    ? `${SITE_URL}/sites/${encodeURIComponent(child.projectId)}/flags/${encodeURIComponent(leadFlag.id)}?source=watch-email`
    : `${SITE_URL}/sites/${encodeURIComponent(child.projectId)}/flags?source=watch-email`
  const problem = leadFlag?.problem ? `<p><strong>${escapeEmailHtml(leadFlag.problem)}</strong></p>` : ''
  const checked = child.completedAt
    ? `<p>Checked ${escapeEmailHtml(child.completedAt.toISOString())}.</p>` : ''

  try {
    if (!child.user?.email || !resend) throw new Error('Email delivery is not configured')
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: child.user.email,
      subject,
      html: `<p>Hi${child.user.name ? ` ${escapeEmailHtml(child.user.name)}` : ''},</p><p>${lead}</p>${problem}${checked}<p><a href="${escapeEmailHtml(destination)}">${leadFlag?.id ? 'See evidence and next steps' : 'Open this Site’s Flags'}</a></p>`,
      text: `Hi${child.user.name ? ` ${child.user.name}` : ''},\n\n${regressCount > 0 ? `FixFlags found ${regressCount} problem${regressCount === 1 ? '' : 's'} that need${regressCount === 1 ? 's' : ''} attention on ${host}.` : `An independent check verified recovery on ${host}.`}\n\n${leadFlag?.problem ?? ''}\n${child.completedAt ? `Checked ${child.completedAt.toISOString()}.\n` : ''}\nSee evidence and next steps: ${destination}`,
    }, { idempotencyKey: `fixflags-watch-${child.id}-v1` })
    // The provider SDK resolves rejected requests with an error, rather than throwing.
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    await prisma.audit.update({
      where: { id: childAuditId },
      data: {
        watchNotificationStatus: 'SENT',
        watchNotifiedAt: new Date(),
        watchNotificationLastError: null,
        watchNotificationLeaseUntil: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.audit.update({
      where: { id: childAuditId },
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
      projectId: child.projectId,
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
      // SENDING is included only when its lease has expired. Claims below the
      // ceiling can be retried; an exhausted final claim is terminalized.
      OR: [
        {
          watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
          watchNotificationAttempts: { lt: WATCH_NOTIFICATION_ATTEMPT_LIMIT },
        },
        { watchNotificationStatus: 'SENDING', watchNotificationLeaseUntil: { lt: now } },
      ],
    },
    select: { id: true, parentId: true },
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
    }
  }
  return audits.length
}

function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}
