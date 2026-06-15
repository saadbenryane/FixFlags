import { User } from '@prisma/client'
import { prisma } from '@/lib/db'

export const UNLIMITED_SCAN_LIMIT = -1

/** Local `npm run dev`, disables scan usage limits only (not plan feature gates). */
export function isDevUnlimitedScans(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEV_SIMULATE_BILLING !== 'true'
}

type AdminUser = Pick<User, 'id' | 'role'>

export function isAdminUser(user: AdminUser): boolean {
  if (user.role === 'admin') return true
  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return adminIds.includes(user.id)
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

export async function getPendingScanCount(userId: string): Promise<number> {
  return prisma.audit.count({
    where: {
      userId,
      status: { notIn: ['COMPLETED', 'FAILED'] },
    },
  })
}

export async function getScanUsage(
  user: Pick<User, 'id' | 'role' | 'auditsUsed' | 'auditsLimit'>
) {
  if (isDevUnlimitedScans()) {
    const pending = await getPendingScanCount(user.id)
    return {
      used: user.auditsUsed,
      pending,
      limit: null,
      isUnlimited: true,
    }
  }

  const pending = await getPendingScanCount(user.id)
  const limit = getEffectiveScanLimit(user)
  const isUnlimited = isUnlimitedScanLimit(limit)

  return {
    used: user.auditsUsed,
    pending,
    limit: isUnlimited ? null : limit,
    isUnlimited,
  }
}

export {
  canAccessPaidFeatures,
  canUseApiKeys,
  canUseFreeRecheck,
  canAccessRecheck,
  canAccessCompare,
  canSharePublicly,
  getEntitlements,
  shouldEnforcePlanGates,
} from '@/lib/auth/entitlements'
