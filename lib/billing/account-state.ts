import type { SubscriptionStatus } from '@prisma/client'

/**
 * Billing has one explicit state. Navigation and query parameters are not inputs:
 * pending activation is only a persisted checkout that has not become a subscription.
 */
export type BillingAccountState =
  | 'free'
  | 'waitlisted'
  | 'checkout_available'
  | 'pending_activation'
  | 'active'
  | 'past_due'
  | 'canceled'

export function billingAccountState(input: {
  plan: string
  subscriptionStatus: SubscriptionStatus
  paidCheckoutOpen: boolean
  waitlisted: boolean
  activationPending?: boolean
}): BillingAccountState {
  if (input.subscriptionStatus === 'PAST_DUE' || input.subscriptionStatus === 'UNPAID') return 'past_due'
  if (input.subscriptionStatus === 'CANCELED') return 'canceled'
  if (input.plan !== 'FREE' && (input.subscriptionStatus === 'ACTIVE' || input.subscriptionStatus === 'TRIALING')) {
    return 'active'
  }
  if (input.activationPending) return 'pending_activation'
  if (input.waitlisted && !input.paidCheckoutOpen) return 'waitlisted'
  if (input.paidCheckoutOpen) return 'checkout_available'
  return 'free'
}
