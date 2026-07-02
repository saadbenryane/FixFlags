import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { hasUnlimitedScans, isDevUnlimitedScans } from '@/lib/auth/permissions'
import type { UsageLimitResult } from '@/lib/audit/check-limit'
import { consumePurchasedCredit } from '@/lib/billing/credits'

export {
  isAtCheckLimit,
  checkUsageProgress,
  limitErrorCodeForPlan,
  wouldBlockNewCheck,
  type UsageLimitAction,
  type UsageLimitCode,
  type UsageLimitResult,
} from '@/lib/audit/check-limit'

export const ANON_AUDIT_IDS_COOKIE = 'ff_anon_report_ids'

function readAnonAuditIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Anonymous users get one free scan (the "teaser"). After they've used it, any
 * further scan requires a free account, which also unlocks the AI fix prompts.
 */
export async function checkAnonymousAuditAllowed(): Promise<UsageLimitResult> {
  if (isDevUnlimitedScans()) return { allowed: true }

  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length > 0) {
    // Confirm at least one tracked audit still exists so a stale/garbage cookie
    // can't permanently lock a first-time visitor.
    const used = await prisma.audit.count({
      where: {
        id: { in: ids },
        userId: null,
      },
    })
    if (used > 0) {
      return {
        allowed: false,
        error: 'You’ve used your free scan. Create a free account to unlock fix prompts and keep scanning.',
        code: 'AUTH_REQUIRED',
        action: 'signup',
      }
    }
  }

  return { allowed: true }
}

export async function trackAnonymousAuditId(auditId: string): Promise<void> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value
  let ids: string[] = []
  try {
    ids = existing ? (JSON.parse(existing) as string[]) : []
  } catch {
    ids = []
  }
  if (!ids.includes(auditId)) {
    ids.push(auditId)
  }
  const trimmed = ids.slice(-10)
  cookieStore.set(ANON_AUDIT_IDS_COOKIE, JSON.stringify(trimmed), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
}

export async function incrementUsageOnCompleteForAudit(
  auditId: string,
  userId: string
): Promise<void> {
  if (isDevUnlimitedScans()) return

  await prisma.$transaction(async (tx) => {
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      select: { usageCountedAt: true, userId: true, skipUsageCount: true, aiReviewAt: true },
    })
    if (!audit || audit.userId !== userId || audit.usageCountedAt) return
    if (!audit.aiReviewAt) return

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (user && hasUnlimitedScans(user)) {
      await tx.audit.update({
        where: { id: auditId },
        data: { usageCountedAt: new Date() },
      })
      return
    }

    if (audit.skipUsageCount) {
      await tx.audit.update({
        where: { id: auditId },
        data: { usageCountedAt: new Date() },
      })
      return
    }

    const userForLimit = await tx.user.findUnique({
      where: { id: userId },
      select: { auditsUsed: true, auditsLimit: true },
    })
    if (userForLimit && userForLimit.auditsUsed < userForLimit.auditsLimit) {
      await tx.user.update({
        where: { id: userId },
        data: { auditsUsed: { increment: 1 } },
      })
    } else {
      const consumed = await consumePurchasedCredit(tx, userId)
      if (!consumed) {
        await tx.user.update({
          where: { id: userId },
          data: { auditsUsed: { increment: 1 } },
        })
      }
    }
  })
}
