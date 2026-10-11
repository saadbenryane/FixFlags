/** Public launch policy, shared by server and client without billing secrets.
 * Changing this policy is an explicit commercial release, not a Stripe toggle.
 * Stored subscriptions and purchased allowances remain independent of beta access.
 */
export const OPEN_BETA_ACCESS = true

export const PLANNED_PAID_PRICING = {
  BUILDER: { price: '$49', period: '/website/mo' },
  TEAM: { price: '$99', period: '/website/mo' },
} as const

/** Call only with a resolved account. Anonymous visitors retain claim boundaries. */
export function hasOpenBetaAccess(account: { role: string } | null | undefined): boolean {
  return OPEN_BETA_ACCESS && account != null
}
