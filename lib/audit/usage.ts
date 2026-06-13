import { cookies } from 'next/headers'
import { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  getEffectiveScanLimit,
  getPendingScanCount,
  hasUnlimitedScans,
  isAdminUser,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'

const ANON_COOKIE = 'qos_anon_audits'
export const ANON_AUDIT_IDS_COOKIE = 'qos_anon_audit_ids'
export const ANON_AUDIT_LIMIT = 1

export type UsageLimitCode = 'ANON_LIMIT' | 'TOKEN_LIMIT' | 'UPGRADE_REQUIRED'
export type UsageLimitAction = 'signup' | 'upgrade'

export interface UsageLimitResult {
  allowed: boolean
  error?: string
  code?: UsageLimitCode
  action?: UsageLimitAction
}

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
      error: 'Free scan used. Create a free account to save this report and get 3 more scans.',
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

export async function checkUserAuditAllowed(
  user: Pick<User, 'id' | 'role' | 'plan' | 'auditsUsed' | 'auditsLimit'>
): Promise<UsageLimitResult> {
  if (isDevUnlimitedScans()) return { allowed: true }

  if (hasUnlimitedScans(user) || isAdminUser(user)) {
    return { allowed: true }
  }

  const limit = getEffectiveScanLimit(user)
  if (isUnlimitedScanLimit(limit)) {
    return { allowed: true }
  }

  const pending = await getPendingScanCount(user.id)

  if (user.auditsUsed + pending >= limit) {
    const isFree = user.plan === 'FREE'
    return {
      allowed: false,
      error: isFree
        ? 'Token limit reached. Upgrade to continue scanning.'
        : 'Token limit reached. Upgrade your plan to continue.',
      code: isFree ? 'UPGRADE_REQUIRED' : 'TOKEN_LIMIT',
      action: 'upgrade',
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

export async function markAnonymousAuditCompleted(): Promise<void> {
  if (isDevUnlimitedScans()) return

  const cookieStore = await cookies()
  const used = parseInt(cookieStore.get(ANON_COOKIE)?.value ?? '0', 10)
  cookieStore.set(ANON_COOKIE, String(used + 1), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
}

export async function incrementUsageOnComplete(userId: string): Promise<void> {
  if (isDevUnlimitedScans()) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user && hasUnlimitedScans(user)) return

  await prisma.user.update({
    where: { id: userId },
    data: { auditsUsed: { increment: 1 } },
  })
}
