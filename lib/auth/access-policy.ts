import type { User } from '@prisma/client'
import { canAccessProductWatch } from '@/lib/auth/entitlements'

export type ReviewVisibility =
  | 'owner'
  | 'anonymous_teaser'
  | 'public_viewer'
  | 'share_grant'
  | 'curated_sample'
  | 'denied'

export interface ReviewCapabilities {
  visibility: ReviewVisibility
  canViewEvidence: boolean
  canViewPromptBodies: boolean
  canUseAgent: boolean
  canClaim: boolean
  canRunUpdateReview: boolean
  canMutateLifecycle: boolean
  canViewPrivateProductContext: boolean
  canExport: boolean
}

export interface ProductCapabilities {
  canView: boolean
  canEditContract: boolean
  canRecordImprovement: boolean
  canRunUpdateReview: boolean
  canUseWatch: boolean
  canViewMemory: boolean
}

export function resolveReviewCapabilities(input: {
  visibility: ReviewVisibility
  isAuthenticated: boolean
}): ReviewCapabilities {
  const owner = input.visibility === 'owner'
  const curatedSample = input.visibility === 'curated_sample'
  const denied = input.visibility === 'denied'
  return {
    visibility: input.visibility,
    canViewEvidence: !denied,
    canViewPromptBodies: owner || curatedSample,
    canUseAgent: owner,
    canClaim:
      !input.isAuthenticated &&
      (input.visibility === 'anonymous_teaser' ||
        input.visibility === 'public_viewer' ||
        curatedSample),
    canRunUpdateReview: owner,
    canMutateLifecycle: owner,
    canViewPrivateProductContext: owner,
    canExport: owner,
  }
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
