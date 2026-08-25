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
  return 'paid'
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
  void user
  return true
}

/** Proof export is part of the authenticated web product on every plan. */
export function canExportSummary(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  void user
  return true
}

export function canUseApiKeys(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  return canAccessPaidFeatures(user)
}

/** Basic MCP access is available to all authenticated users. Plan gates for
 *  premium features (compare, repo scan, deep journeys) are enforced per tool. */
export function canAccessBasicMcp(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return true
}

/** Codebase (GitHub repo) scanning - Studio plan only, same tier as public sharing. */
export function canScanRepositories(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return user.plan === 'TEAM'
}

/** Scheduled Product Reviews are a Studio capability. */
export function canAccessProductWatch(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return user.plan === 'TEAM'
}

/** Manual re-check is always available to the report owner; not a plan gate. */
export function canAccessMonitoring(): boolean {
  return true
}

export function canAccessCompare(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  void user
  return true
}

export interface UserEntitlements {
  reportTier: ReportTier
  canSharePublicly: boolean
  canExportSummary: boolean
  canAccessPaidFeatures: boolean
  canMonitor: boolean
  canWatchProduct: boolean
  canUseMcp: boolean
  canAccessBasicMcp: boolean
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
    canWatchProduct: canAccessProductWatch(user),
    canUseMcp: canUseApiKeys(user),
    canAccessBasicMcp: canAccessBasicMcp(user),
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
