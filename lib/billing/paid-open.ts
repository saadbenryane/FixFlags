/**
 * Paid checkout gate. When false, Pro/Studio CTAs route to waitlist instead of Stripe.
 */

export function isPaidOpenServer(): boolean {
  return process.env.STRIPE_PAID_OPEN === 'true'
}

/** Client bundle: must match STRIPE_PAID_OPEN on the server. */
export function isPaidOpenClient(): boolean {
  return process.env.NEXT_PUBLIC_PAID_OPEN === 'true'
}

export function isPaidCheckoutGatedClient(): boolean {
  return !isPaidOpenClient()
}
