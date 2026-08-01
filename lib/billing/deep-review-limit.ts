import { hasUnlimitedScans, isDevUnlimitedScans } from '@/lib/auth/permissions'
import { deepReviewLimitForPlan } from '@/lib/billing/plans'
import type { Plan } from '@prisma/client'

type DeepLimitUser = {
  id: string
  plan: Plan | string
  role: string
  deepReviewsUsed: number
  deepReviewsLimit: number
}

export function getEffectiveDeepReviewLimit(
  user: Pick<DeepLimitUser, 'plan' | 'role' | 'deepReviewsLimit'>
): number {
  if (user.role === 'admin' || hasUnlimitedScans(user)) return Number.POSITIVE_INFINITY
  return user.deepReviewsLimit ?? deepReviewLimitForPlan(user.plan as Plan)
}

export function isAtDeepReviewLimit(used: number, limit: number): boolean {
  if (!Number.isFinite(limit)) return false
  return used >= limit
}

export function wouldBlockDeepReview(user: DeepLimitUser): boolean {
  if (isDevUnlimitedScans()) return false
  if (hasUnlimitedScans(user) || user.role === 'admin') return false
  const limit = getEffectiveDeepReviewLimit(user)
  if (!Number.isFinite(limit)) return false
  return isAtDeepReviewLimit(user.deepReviewsUsed, limit)
}
