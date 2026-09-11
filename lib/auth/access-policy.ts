import type { User } from '@prisma/client'
import { canAccessProductWatch } from '@/lib/auth/entitlements'
export {
  resolveReviewCapabilities,
  type ReviewCapabilities,
  type ReviewVisibility,
} from '@/lib/auth/review-access-policy'

export interface ProductCapabilities {
  canView: boolean
  canEditContract: boolean
  canRecordImprovement: boolean
  canRunUpdateReview: boolean
  canUseWatch: boolean
  canViewMemory: boolean
}

export function resolveProductCapabilities(
  user: Pick<User, 'role' | 'plan' | 'subscriptionStatus'> | null | undefined
): ProductCapabilities {
  if (!user) {
    return {
      canView: false,
      canEditContract: false,
      canRecordImprovement: false,
      canRunUpdateReview: false,
      canUseWatch: false,
      canViewMemory: false,
    }
  }
  return {
    canView: true,
    canEditContract: true,
    canRecordImprovement: true,
    canRunUpdateReview: true,
    canUseWatch: canAccessProductWatch({
      id: 'access-policy',
      role: user.role,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
    }),
    canViewMemory: true,
  }
}
