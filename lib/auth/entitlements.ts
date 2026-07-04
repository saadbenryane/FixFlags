import { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  isAdminUser,
  isDevUnlimitedScans,
} from '@/lib/auth/permissions'

export type ReportTier = 'free' | 'paid'

/** When true, plan gates (share, compare) behave like production. */
export function shouldEnforcePlanGates(): boolean {
  if (process.env.DEV_SIMULATE_BILLING === 'true') return true
  return !isDevUnlimitedScans()
}

export function hasRevokedSubscriptionStatus(subscriptionStatus: string): boolean {
  return (
    subscriptionStatus === 'PAST_DUE' ||
    subscriptionStatus === 'CANCELED' ||
    subscriptionStatus === 'UNPAID'
  )
}

export function getReportTierForUser(
  user: Pick<User, 'id' | 'plan' | 'role' | 'subscriptionStatus'> | null | undefined
): ReportTier {
  if (!user) return 'free'
  if (isAdminUser(user)) return 'paid'
  if (user.plan === 'FREE') return 'free'
  if (!shouldEnforcePlanGates()) return 'paid'
  return hasRevokedSubscriptionStatus(user.subscriptionStatus) ? 'free' : 'paid'
}

export function canAccessPaidFeatures(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return user.plan !== 'FREE'
}

export function canSharePublicly(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return user.plan === 'TEAM'
}

/** Proof export (copy summary) - Max plan only. */
export function canExportSummary(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  return canSharePublicly(user)
}

export function canUseApiKeys(user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>): boolean {
  return canAccessPaidFeatures(user)
}

/** Codebase (GitHub repo) scanning - Max plan only, same tier as public sharing. */
export function canScanRepositories(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  return canSharePublicly(user)
}

/** Authenticated users can monitor reports they own; quota is not consumed. */
export function canAccessMonitoring(): boolean {
  return true
}

export function canAccessCompare(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  return canAccessPaidFeatures(user)
}

export interface UserEntitlements {
  reportTier: ReportTier
  canSharePublicly: boolean
  canExportSummary: boolean
  canAccessPaidFeatures: boolean
  canMonitor: boolean
  canUseMcp: boolean
  canScanRepositories: boolean
}

export function getEntitlements(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): UserEntitlements {
  const reportTier = getReportTierForUser(user)
  const paid = canAccessPaidFeatures(user)
  return {
    reportTier,
    canSharePublicly: canSharePublicly(user),
    canExportSummary: canExportSummary(user),
    canAccessPaidFeatures: paid,
    canMonitor: canAccessMonitoring(),
    canUseMcp: canUseApiKeys(user),
    canScanRepositories: canScanRepositories(user),
  }
}

/** Which report tier applies when rendering this audit (owner plan for public shares). */
export async function resolveReportTierForAudit(
  audit: { userId: string | null; isPublic: boolean }
): Promise<ReportTier> {
  if (!audit.userId) return 'free'

  const owner = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!owner) return 'free'

  return getReportTierForUser(owner)
}
