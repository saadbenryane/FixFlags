import { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { getPurchasedCreditsRemaining } from '@/lib/billing/credits'

export const UNLIMITED_SCAN_LIMIT = -1

/** Local `npm run dev`, disables scan usage limits only (not plan feature gates). */
export function isDevUnlimitedScans(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEV_SIMULATE_BILLING !== 'true'
}

type AdminUser = Pick<User, 'id' | 'role'>

export function isAdminUser(user: AdminUser): boolean {
  if (user.role === 'admin') return true
  return getEnv().ADMIN_USER_IDS.includes(user.id)
}

export function hasUnlimitedScans(user: Pick<User, 'role'>): boolean {
  if (isDevUnlimitedScans()) return true
  return user.role === 'admin'
}

export function getEffectiveScanLimit(user: Pick<User, 'role' | 'auditsLimit'>): number {
  if (hasUnlimitedScans(user)) return UNLIMITED_SCAN_LIMIT
  return user.auditsLimit
}

export function isUnlimitedScanLimit(limit: number): boolean {
  return limit === UNLIMITED_SCAN_LIMIT
}

export async function getPendingCheckCount(userId: string): Promise<number> {
  return prisma.audit.count({
    where: {
      userId,
      status: { notIn: ['COMPLETED', 'FAILED'] },
    },
  })
}

export async function getCheckUsage(
  user: Pick<User, 'id' | 'role' | 'auditsUsed' | 'auditsLimit'>
) {
  if (isDevUnlimitedScans()) {
    const pending = await getPendingCheckCount(user.id)
    return {
      used: user.auditsUsed,
      pending,
      limit: null,
      isUnlimited: true,
      purchasedCredits: 0,
      totalAvailable: null,
    }
  }

  const pending = await getPendingCheckCount(user.id)
  const limit = getEffectiveScanLimit(user)
  const isUnlimited = isUnlimitedScanLimit(limit)
  const purchasedCredits = await getPurchasedCreditsRemaining(user.id)
  const planRemaining = isUnlimited ? null : Math.max(0, user.auditsLimit - user.auditsUsed)
  const totalAvailable = isUnlimited ? null : (planRemaining ?? 0) + purchasedCredits

  return {
    used: user.auditsUsed,
    pending,
    limit: isUnlimited ? null : limit,
    isUnlimited,
    purchasedCredits,
    totalAvailable,
  }
}

export {
  canAccessPaidFeatures,
  canUseApiKeys,
  canAccessMonitoring,
  canAccessCompare,
  canSharePublicly,
  canExportSummary,
  getEntitlements,
  shouldEnforcePlanGates,
} from '@/lib/auth/entitlements'
