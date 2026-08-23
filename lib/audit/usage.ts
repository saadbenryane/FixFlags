import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { hasUnlimitedScans, isDevUnlimitedScans } from '@/lib/auth/permissions'
import type { UsageLimitResult } from '@/lib/audit/check-limit'
import { consumePurchasedCredit } from '@/lib/billing/credits'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { createAnonymousClaim, verifyAnonymousClaim } from '@/lib/security/anonymous-claim'
import { sharedCookieDomain } from '@/lib/http/site-host'

type CookieReader = {
  get: (name: string) => { value: string } | undefined
  getAll?: () => Array<{ name: string; value: string }>
}

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

/** Soft ceiling: clearing cookies must not unlock unlimited free triage. */
export const ANON_IP_SOFT_LIMIT = 1
export const ANON_IP_SOFT_WINDOW_SECONDS = 60 * 60 * 24

export function readAnonAuditIds(raw: string | undefined): string[] {
  const claim = verifyAnonymousClaim(raw)
  return claim ? [claim.auditId] : []
}

/** Prefer a valid signed claim when www/apex left both a host-only and Domain cookie. */
export function readAnonAuditIdsFromStore(store: CookieReader): string[] {
  const values: string[] = []
  const listed = typeof store.getAll === 'function' ? store.getAll() ?? [] : []
  for (const cookie of listed) {
    if (cookie.name === ANON_AUDIT_IDS_COOKIE && cookie.value) values.push(cookie.value)
  }
  if (values.length === 0) {
    const one = store.get(ANON_AUDIT_IDS_COOKIE)?.value
    if (one) values.push(one)
  }
  for (const value of values) {
    const ids = readAnonAuditIds(value)
    if (ids.length > 0) return ids
  }
  return []
}

export async function readClaimedAnonymousIds(): Promise<string[]> {
  return readAnonAuditIdsFromStore(await cookies())
}

export function claimsAnonymousReport(
  claimedIds: string[],
  reportId: string,
  parentId?: string | null
): boolean {
  return claimedIds.includes(reportId) || (parentId != null && claimedIds.includes(parentId))
}

async function requestHostname(): Promise<string | null> {
  try {
    const headerStore = await headers()
    const raw = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    return raw?.split(',')[0]?.trim().split(':')[0] ?? null
  } catch {
    return null
  }
}

/**
 * Anonymous users get one free scan (the "teaser"). After they've used it, any
 * further scan requires a free account, which also provides the AI fix prompts.
 */
export async function checkAnonymousAuditAllowed(): Promise<UsageLimitResult> {
  if (isDevUnlimitedScans()) return { allowed: true }

  const ids = await readClaimedAnonymousIds()
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
        error: 'You’ve used your free scan. Create a free account for fix prompts and more checks.',
        code: 'AUTH_REQUIRED',
        action: 'signup',
      }
    }
  }

  return { allowed: true }
}

/**
 * Soft IP ceiling for anonymous creates. Cookie is the product gate; this limits
 * cookie-clearing abuse. Throws RateLimitError when exceeded.
 */
export async function enforceAnonymousIpSoftCeiling(clientId: string): Promise<void> {
  if (isDevUnlimitedScans()) return
  await enforceRateLimit({
    scope: 'anon-teaser-ip',
    identifier: clientId,
    limit: ANON_IP_SOFT_LIMIT,
    windowSeconds: ANON_IP_SOFT_WINDOW_SECONDS,
  })
}

/** Track the single anon teaser audit id (product gate is binary). */
export async function trackAnonymousAuditId(auditId: string): Promise<void> {
  const cookieStore = await cookies()
  const domain = sharedCookieDomain(undefined, await requestHostname())
  const secure = process.env.NODE_ENV === 'production'
  const value = createAnonymousClaim(auditId)
  const base = {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax' as const,
    path: '/',
    secure,
  }
  // Drop a leftover host-only cookie so it cannot shadow the shared Domain claim.
  if (domain) {
    cookieStore.set(ANON_AUDIT_IDS_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      sameSite: 'lax',
      path: '/',
      secure,
    })
  }
  cookieStore.set(ANON_AUDIT_IDS_COOKIE, value, {
    ...base,
    ...(domain ? { domain } : {}),
  })
}

export async function clearAnonymousAuditCookie(): Promise<void> {
  const cookieStore = await cookies()
  const domain = sharedCookieDomain(undefined, await requestHostname())
  cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
  if (domain) {
    cookieStore.set(ANON_AUDIT_IDS_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      sameSite: 'lax',
      path: '/',
      domain,
    })
  }
}

/**
 * Count a completed new-URL or update review against the user's product-review quota.
 * Idempotent via usageCountedAt. Watch-triggered re-checks (skipUsageCount) are marked
 * counted but never increment.
 */
export async function incrementUsageOnCompleteForAudit(
  auditId: string,
  userId: string
): Promise<void> {
  if (isDevUnlimitedScans()) return

  await prisma.$transaction(async (tx) => {
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      select: { usageCountedAt: true, userId: true, skipUsageCount: true },
    })
    if (!audit || audit.userId !== userId || audit.usageCountedAt) return

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

    await tx.audit.update({
      where: { id: auditId },
      data: { usageCountedAt: new Date() },
    })
  })
}

/**
 * Count a completed deep review (journey exploration) against the user's deep-review quota.
 * Idempotent via deepReviewUsageCountedAt on the audit.
 */
export async function incrementDeepReviewOnCompleteForAudit(
  auditId: string,
  userId: string
): Promise<void> {
  if (isDevUnlimitedScans()) return

  await prisma.$transaction(async (tx) => {
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      select: {
        userId: true,
        journeyReviewIncluded: true,
        deepReviewUsageCountedAt: true,
      },
    })
    if (
      !audit ||
      audit.userId !== userId ||
      !audit.journeyReviewIncluded ||
      audit.deepReviewUsageCountedAt
    ) {
      return
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, deepReviewsUsed: true, deepReviewsLimit: true },
    })
    if (!user) return

    if (hasUnlimitedScans(user)) {
      await tx.audit.update({
        where: { id: auditId },
        data: { deepReviewUsageCountedAt: new Date() },
      })
      return
    }

    const limit = user.deepReviewsLimit
    if (user.deepReviewsUsed < limit) {
      await tx.user.update({
        where: { id: userId },
        data: { deepReviewsUsed: { increment: 1 } },
      })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: { deepReviewUsageCountedAt: new Date() },
    })
  })
}
