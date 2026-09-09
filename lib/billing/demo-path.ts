import type { CheckoutPlan } from '@/lib/billing/client-checkout'

/** Paid intent goes to a demo request, not waitlist or Stripe, while checkout is closed. */
export function demoPathForPlan(plan: CheckoutPlan): string {
  return plan === 'TEAM' ? '/request-demo?plan=studio' : '/request-demo?plan=pro'
}
