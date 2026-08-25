import type { Prisma } from '@prisma/client'
import { getEntitlements } from '@/lib/auth/entitlements'
import { getCheckUsage, isAdminUser } from '@/lib/auth/permissions'
import { refreshUserUsagePeriod } from '@/lib/billing/usage-period'

export const meUserSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  role: true,
  auditsUsed: true,
  auditsLimit: true,
  deepReviewsUsed: true,
  deepReviewsLimit: true,
  usagePeriodStart: true,
  usagePeriodEnd: true,
  subscriptionStatus: true,
  vibecodingLevel: true,
  preferredTools: true,
} satisfies Prisma.UserSelect

export type MeUserRecord = Prisma.UserGetPayload<{ select: typeof meUserSelect }>

export async function serializeMeUser(
  user: MeUserRecord,
  sessionUser?: { email?: string | null; name?: string | null }
) {
  const currentUser = (await refreshUserUsagePeriod(user.id)) ?? user
  const checks = await getCheckUsage(currentUser)
  const internalEntitlements = getEntitlements(currentUser)
  const entitlements = {
    reportTier: internalEntitlements.reportTier,
    canSharePublicly: internalEntitlements.canSharePublicly,
    canExportSummary: internalEntitlements.canExportSummary,
    canAccessPaidFeatures: internalEntitlements.canAccessPaidFeatures,
    canMonitor: internalEntitlements.canMonitor,
    canWatchProduct: internalEntitlements.canWatchProduct,
  }

  return {
    id: user.id,
    email: user.email ?? sessionUser?.email ?? '',
    name: user.name ?? sessionUser?.name ?? null,
    plan: currentUser.plan ?? 'FREE',
    role: currentUser.role,
    isAdmin: isAdminUser(currentUser),
    checks: {
      ...checks,
      periodStart: currentUser.usagePeriodStart.toISOString(),
      periodEnd: currentUser.usagePeriodEnd.toISOString(),
      remaining:
        checks.totalAvailable ??
        (checks.limit === null ? null : Math.max(0, checks.limit - checks.used - checks.pending)),
    },
    deepReviews: {
      used: currentUser.deepReviewsUsed,
      limit: currentUser.deepReviewsLimit,
      remaining:
        currentUser.deepReviewsLimit < 0
          ? null
          : Math.max(0, currentUser.deepReviewsLimit - currentUser.deepReviewsUsed),
      periodStart: currentUser.usagePeriodStart.toISOString(),
      periodEnd: currentUser.usagePeriodEnd.toISOString(),
    },
    entitlements,
    vibecodingLevel: user.vibecodingLevel,
    preferredTools: user.preferredTools,
  }
}
