export type UsageLimitCode = 'AUTH_REQUIRED' | 'TOKEN_LIMIT' | 'UPGRADE_REQUIRED'
export type UsageLimitAction = 'signup' | 'upgrade' | 'buy_credits'

export const UNLIMITED_SCAN_LIMIT = -1

export function isUnlimitedScanLimit(limit: number): boolean {
  return limit === UNLIMITED_SCAN_LIMIT
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
