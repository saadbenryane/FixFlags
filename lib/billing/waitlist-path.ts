import type { CheckoutPlan } from '@/lib/billing/client-checkout'

/** Paid intent goes to the waitlist while Stripe checkout is closed. */
export function waitlistPathForPlan(plan: CheckoutPlan): string {
  return plan === 'TEAM' ? '/waitlist/studio' : '/waitlist/pro'
}
