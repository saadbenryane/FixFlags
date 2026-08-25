import type { User } from '@prisma/client'

export type CanvasActor = Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>

export type CanvasAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'AUTH_REQUIRED' | 'OWNER_REQUIRED' }

/**
 * Canvas is private to the Product owner, but is not a plan differentiator.
 */
export function authorizeCanvasAccess(input: {
  actor: CanvasActor | null | undefined
  projectOwnerId: string
}): CanvasAccessDecision {
  if (!input.actor) return { allowed: false, reason: 'AUTH_REQUIRED' }
  if (input.actor.id !== input.projectOwnerId && input.actor.role !== 'admin') {
    return { allowed: false, reason: 'OWNER_REQUIRED' }
  }
  return { allowed: true }
}
