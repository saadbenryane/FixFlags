import { ProjectWatchInterval, type User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
import { canAccessProductWatch, canSharePublicly } from '@/lib/auth/entitlements'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resend } from '@/lib/email/client'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'

export type WatchInterval = 'weekly' | 'daily'

const INTERVAL_MS: Record<WatchInterval, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
}
const RETRY_MS = [15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000] as const
const LEASE_MS = 10 * 60 * 1000
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export function toStoredWatchInterval(interval: WatchInterval): ProjectWatchInterval {
  return interval === 'daily' ? 'DAILY' : 'WEEKLY'
}

export function fromStoredWatchInterval(interval: ProjectWatchInterval | null): WatchInterval | null {
  return interval === 'DAILY' ? 'daily' : interval === 'WEEKLY' ? 'weekly' : null
}

export function calcWatchNextRun(interval: WatchInterval, from = new Date()): Date {
  return new Date(from.getTime() + INTERVAL_MS[interval])
}

export function isWatchInterval(value: unknown): value is WatchInterval {
  return value === 'weekly' || value === 'daily'
}

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
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  })
  if (!project) return { ok: false, error: 'Product not found' }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!user) return { ok: false, error: 'User not found' }
  if (input.interval && !canAccessProductWatch(user)) {
    return { ok: false, error: 'Product watch requires Pro or Studio' }
  }
  if (input.interval === 'daily' && !canSharePublicly(user)) {
    return { ok: false, error: 'Daily watch requires Studio' }
  }
  if (input.interval) {
    const readiness = productWatchReadiness()
    if (!readiness.available) {
      return { ok: false, error: readiness.error!, code: 'WATCH_UNAVAILABLE' }
    }
  }

  await prisma.project.update({
    where: { id: project.id },
    data: input.interval
      ? {
          watchInterval: toStoredWatchInterval(input.interval),
          watchNextRunAt: calcWatchNextRun(input.interval),
          watchLeaseUntil: null,
          watchConsecutiveFailures: 0,
          watchLastError: null,
        }
      : {
          watchInterval: null,
          watchNextRunAt: null,
          watchLeaseUntil: null,
          watchConsecutiveFailures: 0,
          watchLastError: null,
        },
  })
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
export async function processDueProjectWatches(limit = 20): Promise<{
  processed: number
  enqueued: number
  errors: number
}> {
  const now = new Date()
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
      if (!canAccessProductWatch(project.user)) {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            watchInterval: null,
            watchNextRunAt: null,
            watchLeaseUntil: null,
            watchLastError: 'Product Watch disabled after entitlement loss',
          },
        })
        continue
      }

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

      const parent = await prisma.audit.findFirst({
        where: { projectId: project.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      })
      if (!parent) {
        errors += 1
        await recordWatchFailure(
          project.id,
          project.watchConsecutiveFailures + 1,
          'No completed report exists for this Product',
          now
        )
        continue
      }

      const outcome = await startMonitoringAudit(parent.id, project.user as User, { trigger: 'WATCH' })
      if (!outcome.ok) throw new Error(outcome.error)
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
export async function notifyWatchRegression(parentAuditId: string, childAuditId: string): Promise<void> {
  const child = await prisma.audit.findUnique({
    where: { id: childAuditId },
    select: {
      id: true,
      url: true,
      projectId: true,
      recheckTrigger: true,
      completedAt: true,
      watchRegressionCount: true,
      watchNotificationStatus: true,
      watchNotificationAttempts: true,
      user: { select: { email: true, name: true } },
      project: { select: { watchInterval: true } },
    },
  })
  if (!child || child.recheckTrigger !== 'WATCH' || !child.projectId) return
  await markWatchCompleted(child.projectId, child.completedAt ?? new Date())

  let regressCount = child.watchRegressionCount
  let summary: Awaited<ReturnType<typeof getFlagDiffSummary>> | null = null
  if (regressCount === null) {
    summary = await getFlagDiffSummary(parentAuditId, childAuditId)
    regressCount = summary.regressed.length + summary.newIssues.length
    await prisma.audit.update({
      where: { id: childAuditId },
      data: {
        watchRegressionCount: regressCount,
        watchNotificationStatus: regressCount > 0 ? 'PENDING' : 'NOT_APPLICABLE',
      },
    })
  }
  if (regressCount === 0 || child.watchNotificationStatus === 'SENT') return

  if (!child.user?.email || !resend) {
    await prisma.audit.update({
      where: { id: childAuditId },
      data: {
        watchNotificationStatus: 'FAILED',
        watchNotificationLastError: 'Email delivery is not configured',
      },
    })
    return
  }

  const claimed = await prisma.audit.updateMany({
    where: {
      id: childAuditId,
      watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
      watchNotificationAttempts: { lt: 5 },
    },
    data: {
      watchNotificationStatus: 'SENDING',
      watchNotificationAttempts: { increment: 1 },
      watchNotificationLastError: null,
    },
  })
  if (claimed.count !== 1) return

  summary ??= await getFlagDiffSummary(parentAuditId, childAuditId)
  const host = (() => {
    try { return new URL(child.url).hostname } catch { return child.url }
  })()

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: child.user.email,
      subject: `Regression on ${host}: ${regressCount} issue${regressCount === 1 ? '' : 's'}`,
      html: `<p>Hi${child.user.name ? ` ${child.user.name}` : ''},</p><p>Your FixFlags product watch found <strong>${regressCount}</strong> new or regressed issue${regressCount === 1 ? '' : 's'} on <strong>${host}</strong>.</p><p><a href="${SITE_URL}/report/${child.id}">Open the update review report</a></p><p>Cleared: ${summary.fixed.length} · Inconclusive: ${summary.inconclusive.length} · Remaining: ${summary.unchanged.length} · New: ${summary.newIssues.length} · Regressed: ${summary.regressed.length}</p>`,
    }, { idempotencyKey: `fixflags-watch-${child.id}-v1` })
    await prisma.audit.update({
      where: { id: childAuditId },
      data: {
        watchNotificationStatus: 'SENT',
        watchNotifiedAt: new Date(),
        watchNotificationLastError: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.audit.update({
      where: { id: childAuditId },
      data: { watchNotificationStatus: 'FAILED', watchNotificationLastError: message.slice(0, 1000) },
    })
    logger.warn('Watch regression email failed', { childAuditId, error: message })
  }
}

export async function retryPendingWatchNotifications(limit = 20): Promise<number> {
  const audits = await prisma.audit.findMany({
    where: {
      status: 'COMPLETED',
      recheckTrigger: 'WATCH',
      watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
      watchNotificationAttempts: { lt: 5 },
      parentId: { not: null },
    },
    select: { id: true, parentId: true },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  })
  for (const audit of audits) {
    await notifyWatchRegression(audit.parentId!, audit.id)
  }
  return audits.length
}
