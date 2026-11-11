/** Public launch policy, shared by server and client without billing secrets.
 * Changing this policy is an explicit commercial release, not a Stripe toggle.
 * Stored subscriptions and purchased allowances remain independent of beta access.
 */
export const OPEN_BETA_ACCESS = true

/**
 * Planned paid pricing (owner decision 2026-11-11), the one source every
 * pricing surface reads. Plans are priced per account and include a number of
 * websites; each additional website has its own monthly fee. Paid plans are
 * waitlist-only. Internal plan TEAM displays as Team (it displayed as Studio
 * before 2026-11-11). Agency has no internal plan yet; its waitlist records TEAM.
 */
export const PLANNED_PAID_PRICING = {
  BUILDER: { price: '$49', period: '/month', websites: 1 },
  TEAM: { price: '$149', period: '/month', websites: 5 },
  AGENCY: { price: '$399', period: '/month', websites: 25 },
} as const

export const PLANNED_ADD_ON_PRICING = {
  extraWebsite: { price: '$19', unit: 'a month each' },
  extraChecks: { price: '$29', unit: 'per 1,000' },
} as const

/** Call only with a resolved account. Anonymous visitors retain claim boundaries. */
export function hasOpenBetaAccess(account: { role: string } | null | undefined): boolean {
  return OPEN_BETA_ACCESS && account != null
}
