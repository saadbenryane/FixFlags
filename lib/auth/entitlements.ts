import { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  isAdminUser,
  isDevUnlimitedScans,
} from '@/lib/auth/permissions'

export type ReportTier = 'free' | 'paid'

/** @deprecated Trial re-check model removed; column may remain in schema. */
export function hasUsedFreeRecheck(
  user: Pick<User, 'freeRecheckUsedAt'>
): boolean {
  return user.freeRecheckUsedAt !== null && user.freeRecheckUsedAt !== undefined
}

/** When true, plan gates (share, compare) behave like production. */
export function shouldEnforcePlanGates(): boolean {
  if (process.env.DEV_SIMULATE_BILLING === 'true') return true
  return !isDevUnlimitedScans()
}

export function getReportTierForUser(
  user: Pick<User, 'id' | 'plan' | 'role'> | null | undefined
): ReportTier {
  if (!user) return 'free'
  if (isAdminUser(user)) return 'paid'
  return user.plan !== 'FREE' ? 'paid' : 'free'
}

export function canAccessPaidFeatures(
  user: Pick<User, 'id' | 'role' | 'plan'>
): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  return user.plan !== 'FREE'
}

/** @deprecated Use canAccessRecheck; always false under unlimited owned re-check contract. */
export function canUseFreeRecheck(
  _user: Pick<User, 'plan' | 'freeRecheckUsedAt'>
): boolean {
  return false
}

export function canSharePublicly(user: Pick<User, 'id' | 'role' | 'plan'>): boolean {
  if (!shouldEnforcePlanGates()) return true
  if (user.role === 'admin' || isAdminUser(user)) return true
  return user.plan === 'TEAM' || user.plan === 'STUDIO'
}

/** Proof export (copy summary) - Agency and Studio plans. */
export function canExportSummary(user: Pick<User, 'id' | 'role' | 'plan'>): boolean {
  return canSharePublicly(user)
}

export function canUseApiKeys(user: Pick<User, 'id' | 'role' | 'plan'>): boolean {
  return canAccessPaidFeatures(user)
}

/** Authenticated users can re-check reports they own; quota is not consumed. */
export function canAccessRecheck(
  _user: Pick<User, 'id' | 'role' | 'plan' | 'freeRecheckUsedAt'>
): boolean {
  return true
}

export function canAccessCompare(
  user: Pick<User, 'id' | 'role' | 'plan' | 'freeRecheckUsedAt'>,
  _recheckAudit: { parentId: string | null; userId: string | null }
): boolean {
  return canAccessPaidFeatures(user)
}

export interface UserEntitlements {
  reportTier: ReportTier
  canUseFreeRecheck: boolean
  hasUsedFreeRecheck: boolean
  canSharePublicly: boolean
  canExportSummary: boolean
  canAccessPaidFeatures: boolean
  canRecheck: boolean
  canUseMcp: boolean
}

export function getEntitlements(
  user: Pick<User, 'id' | 'role' | 'plan' | 'freeRecheckUsedAt'>
): UserEntitlements {
  const reportTier = getReportTierForUser(user)
  const paid = canAccessPaidFeatures(user)
  return {
    reportTier,
    canUseFreeRecheck: false,
    hasUsedFreeRecheck: hasUsedFreeRecheck(user),
    canSharePublicly: canSharePublicly(user),
    canExportSummary: canExportSummary(user),
    canAccessPaidFeatures: paid,
    canRecheck: canAccessRecheck(user),
    canUseMcp: canUseApiKeys(user),
  }
}

/** Which report tier applies when rendering this audit (owner plan for public shares). */
export async function resolveReportTierForAudit(
  audit: { userId: string | null; isPublic: boolean },
  _sessionUser?: { id: string } | null
): Promise<ReportTier> {
  void _sessionUser
  if (!audit.userId) return 'free'

  const owner = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, plan: true, role: true },
  })
  if (!owner) return 'free'

  return getReportTierForUser(owner)
}
