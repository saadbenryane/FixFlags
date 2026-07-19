import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'

export type UsageLimitCode = 'ANON_LIMIT' | 'AUTH_REQUIRED' | 'TOKEN_LIMIT' | 'UPGRADE_REQUIRED'
export type UsageLimitAction = 'signup' | 'upgrade' | 'buy_credits'

export interface UsageLimitResult {
  allowed: boolean
  error?: string
  code?: UsageLimitCode
  action?: UsageLimitAction
}

/** Matches create-audit enforcement: used + pending counts against limit. */
export function isAtCheckLimit(
  used: number,
  pending: number,
  limit: number | null
): boolean {
  if (limit === null || limit === Infinity || isUnlimitedScanLimit(limit)) {
    return false
  }
  return used + pending >= limit
}

export function checkUsageProgress(
  used: number,
  pending: number,
  limit: number | null
): { atLimit: boolean; pct: number; reserved: number } {
  if (limit === null || limit === Infinity || isUnlimitedScanLimit(limit)) {
    return { atLimit: false, pct: 0, reserved: used + pending }
  }
  const reserved = used + pending
  return {
    atLimit: reserved >= limit,
    pct: Math.min(100, Math.round((reserved / limit) * 100)),
    reserved,
  }
}

export function limitErrorCodeForPlan(plan: string): UsageLimitCode {
  return plan === 'FREE' ? 'UPGRADE_REQUIRED' : 'TOKEN_LIMIT'
}

/** Mirrors create-audit transaction limit check for tests and client UI. */
export function wouldBlockNewCheck(
  user: Pick<
    { id: string; plan: string; role: string; auditsUsed: number; auditsLimit: number },
    'id' | 'plan' | 'role' | 'auditsUsed' | 'auditsLimit'
  >,
  pending: number
): UsageLimitResult {
  if (isDevUnlimitedScans()) return { allowed: true }
  if (hasUnlimitedScans(user) || isAdminUser(user)) return { allowed: true }

  const limit = getEffectiveScanLimit(user)
  if (isUnlimitedScanLimit(limit)) return { allowed: true }

  if (isAtCheckLimit(user.auditsUsed, pending, limit)) {
    const code = limitErrorCodeForPlan(user.plan)
    return {
      allowed: false,
      error:
        code === 'UPGRADE_REQUIRED'
          ? 'New URL check limit reached. Upgrade to continue.'
          : 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
      code,
      action: code === 'UPGRADE_REQUIRED' ? 'upgrade' : 'buy_credits',
    }
  }
  return { allowed: true }
}
