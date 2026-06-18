import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { hasUnlimitedScans, isDevUnlimitedScans } from '@/lib/auth/permissions'
import type { UsageLimitResult } from '@/lib/audit/check-limit'

export {
  isAtCheckLimit,
  checkUsageProgress,
  limitErrorCodeForPlan,
  wouldBlockNewCheck,
  type UsageLimitAction,
  type UsageLimitCode,
  type UsageLimitResult,
} from '@/lib/audit/check-limit'

const ANON_COOKIE = 'ff_anon_checks'
export const ANON_AUDIT_IDS_COOKIE = 'ff_anon_report_ids'
export const ANON_AUDIT_LIMIT = 1

export async function getAnonymousAuditCount(): Promise<number> {
  const cookieStore = await cookies()
  return parseInt(cookieStore.get(ANON_COOKIE)?.value ?? '0', 10)
}

function readAnonAuditIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export async function checkAnonymousAuditAllowed(): Promise<UsageLimitResult> {
  if (isDevUnlimitedScans()) return { allowed: true }

  const used = await getAnonymousAuditCount()
  if (used >= ANON_AUDIT_LIMIT) {
    return {
      allowed: false,
      error: 'Free scan used. Create a free account to save this report and run up to 3 audits total.',
      code: 'ANON_LIMIT',
      action: 'signup',
    }
  }

  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length > 0) {
    const pending = await prisma.audit.count({
      where: {
        id: { in: ids },
        userId: null,
        status: { notIn: ['COMPLETED', 'FAILED'] },
      },
    })
    if (pending > 0) {
      return {
        allowed: false,
        error: 'An audit is already in progress. Wait for it to finish or create a free account.',
        code: 'ANON_LIMIT',
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

export async function markAnonymousAuditCompletedOnce(auditId: string): Promise<void> {
  if (isDevUnlimitedScans()) return

  const cookieStore = await cookies()
  const countedKey = 'ff_anon_counted_ids'
  const counted = readAnonAuditIds(cookieStore.get(countedKey)?.value)
  if (counted.includes(auditId)) return

  const used = parseInt(cookieStore.get(ANON_COOKIE)?.value ?? '0', 10)
  cookieStore.set(ANON_COOKIE, String(used + 1), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
  cookieStore.set(countedKey, JSON.stringify([...counted, auditId].slice(-20)), {
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

    await tx.audit.update({
      where: { id: auditId },
      data: { usageCountedAt: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: { auditsUsed: { increment: 1 } },
    })
  })
}
