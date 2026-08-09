import type { User } from '@prisma/client'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'

export type CanvasActor = Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>

export type CanvasAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'AUTH_REQUIRED' | 'OWNER_REQUIRED' | 'PAID_PLAN_REQUIRED' }

/**
 * Canvas is private and paid in v1. This composes the canonical entitlement
 * helper rather than duplicating subscription-status or development rules.
 */
export function authorizeCanvasAccess(input: {
  actor: CanvasActor | null | undefined
  projectOwnerId: string
}): CanvasAccessDecision {
  if (!input.actor) return { allowed: false, reason: 'AUTH_REQUIRED' }
  if (input.actor.id !== input.projectOwnerId && input.actor.role !== 'admin') {
    return { allowed: false, reason: 'OWNER_REQUIRED' }
  }
  if (!canAccessPaidFeatures(input.actor)) {
    return { allowed: false, reason: 'PAID_PLAN_REQUIRED' }
  }
  return { allowed: true }
}

