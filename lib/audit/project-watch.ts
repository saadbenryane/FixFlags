import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
import { canAccessProductWatch } from '@/lib/auth/entitlements'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resend } from '@/lib/email/client'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import type { User } from '@prisma/client'

export type WatchInterval = 'weekly' | 'daily'

const INTERVAL_MS: Record<WatchInterval, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export function calcWatchNextRun(interval: WatchInterval, from = new Date()): Date {
  return new Date(from.getTime() + INTERVAL_MS[interval])
}

export function isWatchInterval(value: unknown): value is WatchInterval {
  return value === 'weekly' || value === 'daily'
}

/**
 * Enable or update Project-scoped recurring FULL re-check.
 */
export async function setProjectWatch(input: {
  projectId: string
  userId: string
  interval: WatchInterval | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  })
  if (!project) return { ok: false, error: 'Project not found' }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!user) return { ok: false, error: 'User not found' }
  if (input.interval && !canAccessProductWatch(user)) {
    return { ok: false, error: 'Product watch requires Pro or Agency' }
  }

  if (!input.interval) {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        watchInterval: null,
        watchNextRunAt: null,
      },
    })
    return { ok: true }
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      watchInterval: input.interval,
      watchNextRunAt: calcWatchNextRun(input.interval),
    },
  })
  return { ok: true }
}

/**
 * Process due Project watches: enqueue FULL re-check of latest completed audit for the URL.
 */
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
    },
    take: limit,
    orderBy: { watchNextRunAt: 'asc' },
    select: {
      id: true,
      userId: true,
      url: true,
      watchInterval: true,
      user: true,
    },
  })

  let enqueued = 0
  let errors = 0

  for (const project of due) {
    const interval = isWatchInterval(project.watchInterval) ? project.watchInterval : 'weekly'
    try {
      if (!canAccessProductWatch(project.user)) {
        await prisma.project.update({
          where: { id: project.id },
          data: { watchInterval: null, watchNextRunAt: null },
        })
        continue
      }

      const parent = await prisma.audit.findFirst({
        where: {
          userId: project.userId,
          status: 'COMPLETED',
          OR: [{ projectId: project.id }, { url: { startsWith: project.url } }],
        },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      })

      if (!parent) {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            watchLastRunAt: now,
            watchNextRunAt: calcWatchNextRun(interval, now),
          },
        })
        continue
      }

      const active = await prisma.audit.findFirst({
        where: {
          projectId: project.id,
          skipUsageCount: true,
          status: { notIn: ['COMPLETED', 'FAILED'] },
        },
        select: { id: true },
      })
      if (active) {
        await prisma.project.update({
          where: { id: project.id },
          data: { watchNextRunAt: calcWatchNextRun(interval, now) },
        })
        continue
      }

      const outcome = await startMonitoringAudit(parent.id, project.user as User)
      if (!outcome.ok) {
        errors += 1
        logger.warn('Project watch enqueue failed', {
          projectId: project.id,
          error: outcome.error,
        })
      } else {
        enqueued += 1
      }

      await prisma.project.update({
        where: { id: project.id },
        data: {
          watchLastRunAt: now,
          watchNextRunAt: calcWatchNextRun(interval, now),
        },
      })
    } catch (err) {
      errors += 1
      logger.error(
        'Project watch tick failed',
        err instanceof Error ? err : new Error(String(err)),
        { projectId: project.id }
      )
      await prisma.project.update({
        where: { id: project.id },
        data: { watchNextRunAt: calcWatchNextRun(interval, now) },
      })
    }
  }

  return { processed: due.length, enqueued, errors }
}

/** Email owner when a watched re-check shows regressions or new issues. */
export async function notifyWatchRegression(
  parentAuditId: string,
  childAuditId: string
): Promise<void> {
  const child = await prisma.audit.findUnique({
    where: { id: childAuditId },
    select: {
      id: true,
      url: true,
      projectId: true,
      user: { select: { email: true, name: true } },
      project: { select: { watchInterval: true } },
    },
  })
  if (!child?.project?.watchInterval || !child.user?.email) return
  if (!resend) return

  const summary = await getFlagDiffSummary(parentAuditId, childAuditId)
  const regressCount = summary.regressed.length + summary.newIssues.length
  if (regressCount === 0) return

  const claimed = await prisma.audit.updateMany({
    where: { id: childAuditId, watchNotifiedAt: null },
    data: { watchNotifiedAt: new Date() },
  })
  if (claimed.count === 0) return

  const host = (() => {
    try {
      return new URL(child.url).hostname
    } catch {
      return child.url
    }
  })()

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: child.user.email,
      subject: `Regression on ${host}: ${regressCount} issue${regressCount === 1 ? '' : 's'}`,
      html: `
        <p>Hi${child.user.name ? ` ${child.user.name}` : ''},</p>
        <p>Your FixFlags product watch found <strong>${regressCount}</strong> new or regressed issue${regressCount === 1 ? '' : 's'} on <strong>${host}</strong>.</p>
        <p><a href="${SITE_URL}/report/${child.id}">Open the re-check report</a></p>
        <p>Cleared: ${summary.fixed.length} · Remaining: ${summary.unchanged.length} · New: ${summary.newIssues.length} · Regressed: ${summary.regressed.length}</p>
      `,
    })
  } catch (err) {
    await prisma.audit.updateMany({
      where: { id: childAuditId },
      data: { watchNotifiedAt: null },
    })
    logger.warn('Watch regression email failed', {
      childAuditId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
