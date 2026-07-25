import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isDevUnlimitedScans,
} from '@/lib/auth/permissions'

import {
  isUnlimitedScanLimit,
  isAtCheckLimit,
  limitErrorCodeForPlan,
} from './check-limit-utils'

export type { UsageLimitCode, UsageLimitAction } from './check-limit-utils'
export {
  isUnlimitedScanLimit,
  isAtCheckLimit,
  checkUsageProgress,
  limitErrorCodeForPlan,
  UNLIMITED_SCAN_LIMIT,
} from './check-limit-utils'

export interface UsageLimitResult {
  allowed: boolean
  error?: string
  code?: import('./check-limit-utils').UsageLimitCode
  action?: import('./check-limit-utils').UsageLimitAction
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
