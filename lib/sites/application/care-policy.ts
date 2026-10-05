import type { Plan, SubscriptionStatus } from '@prisma/client'
import { PLAN_DEFINITIONS, projectLimitForPlan } from '@/lib/billing/plans'

type CareUser = {
  role: string
  plan: Plan
  subscriptionStatus: SubscriptionStatus
}

export type SiteCarePolicy = {
  maxSites: number | null
  watchIntervals: Array<'weekly' | 'daily'>
  targetedVerify: boolean
}

export const OUTCOME_FRESHNESS_MINUTES = {
  daily: 36 * 60,
  weekly: 8 * 24 * 60,
  manual: 8 * 24 * 60,
} as const

export function outcomeFreshnessMinutes(interval: 'weekly' | 'daily' | null): number {
  return interval ? OUTCOME_FRESHNESS_MINUTES[interval] : OUTCOME_FRESHNESS_MINUTES.manual
}

/**
 * A Session identity can carry a null plan before the account row is read, so
 * the derived cap has to survive a plan that is not in the plan definitions.
 * An unknown plan is treated as Free, which fails closed: the customer keeps
 * the Free cap instead of inheriting a paid one they never bought.
 */
function siteCapForPlan(plan: Plan): number | null {
  return projectLimitForPlan(plan in PLAN_DEFINITIONS ? plan : 'FREE')
}

/**
 * Product-level care policy. Review-credit counters never decide whether Watch or
 * Verify are available: they only defer a scheduled run and surface as a quota
 * state on the Site. The Site cap is read from the plan definition instead of
 * restated here, so billing enforcement and this policy cannot drift apart.
 */
export function siteCarePolicy(user: CareUser): SiteCarePolicy {
  if (user.role === 'admin') {
    return { maxSites: null, watchIntervals: ['weekly', 'daily'], targetedVerify: true }
  }
  const revoked = ['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)
  const effectivePlan: Plan = revoked ? 'FREE' : user.plan
  return {
    maxSites: siteCapForPlan(effectivePlan),
    watchIntervals: effectivePlan === 'FREE' ? ['weekly'] : ['weekly', 'daily'],
    targetedVerify: true,
  }
}
