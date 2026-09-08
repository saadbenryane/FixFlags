import { User } from '@prisma/client'
import {
  isAdminUser,
  isDevUnlimitedScans,
} from '@/lib/auth/permissions'

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

export function canAccessPaidFeatures(
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return false
  return user.plan !== 'FREE'
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

export interface UserEntitlements {
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
  const paid = canAccessPaidFeatures(user)
  return {
    canExportSummary: canExportSummary(user),
    canAccessPaidFeatures: paid,
    canMonitor: canAccessMonitoring(),
    canWatchProduct: canAccessProductWatch(user),
    canUseMcp: canUseApiKeys(user),
    canAccessBasicMcp: canAccessBasicMcp(user),
    canScanRepositories: canScanRepositories(user),
  }
}
