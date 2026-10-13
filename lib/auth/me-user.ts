import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import type { Prisma } from '@prisma/client'
import { getEntitlements } from '@/lib/auth/entitlements'
import { getCheckUsage, isAdminUser } from '@/lib/auth/permissions'
import { refreshUserUsagePeriod } from '@/lib/billing/usage-period'

export const meUserSelect = {
  id: true,
  lifecycleStatus:true,
  email: true,
  name: true,
  plan: true,
  role: true,
  auditsUsed: true,
  auditsLimit: true,
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
  const effective = await loadEffectiveEntitlements(user.id)
  const entitled = effective ? {...currentUser,plan:effective.plan,auditsLimit:effective.scanLimit ?? -1} : currentUser
  const checks = await getCheckUsage(entitled)
  const internalEntitlements = getEntitlements(entitled)
  const entitlements = {
    canExportSummary: internalEntitlements.canExportSummary,
    canAccessPaidFeatures: internalEntitlements.canAccessPaidFeatures,
    canMonitor: internalEntitlements.canMonitor,
    canWatchProduct: internalEntitlements.canWatchProduct,
  }

  return {
    id: user.id,
    email: user.email ?? sessionUser?.email ?? '',
    name: user.name ?? sessionUser?.name ?? null,
    plan: entitled.plan ?? 'FREE',
    commercialPlan: currentUser.plan,
    effectiveEntitlements: effective,
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
    entitlements,
    vibecodingLevel: user.vibecodingLevel,
    preferredTools: user.preferredTools,
  }
}
