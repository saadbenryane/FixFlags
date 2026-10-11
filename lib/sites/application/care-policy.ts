import { watchIntervalMinutes, type WatchInterval } from '@/lib/sites/watch-schedule'
import type { Plan, SubscriptionStatus } from '@prisma/client'
import { PLAN_DEFINITIONS, projectLimitForPlan } from '@/lib/billing/plans'
import { hasOpenBetaAccess } from '@/lib/billing/beta-policy'

type CareUser = {
  role: string
  plan: Plan
  subscriptionStatus: SubscriptionStatus
}

export type SiteCarePolicy = {
  maxSites: number | null
  watchIntervals: Array<WatchInterval>
  targetedVerify: boolean
}

export const OUTCOME_FRESHNESS_MINUTES = {
  daily: 36 * 60,
  weekly: 8 * 24 * 60,
  manual: 8 * 24 * 60,
} as const

export function outcomeFreshnessMinutes(interval: WatchInterval | null, everyMinutes?: number | null): number {
  if (interval === 'hourly' || interval === 'custom') return watchIntervalMinutes(interval, everyMinutes) + 12 * 60
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
 * Product-level care policy. Beta grants every supported schedule without
 * changing stored subscriptions. The Site cap remains plan-backed so existing
 * subscribers retain their purchased capacity and Free keeps one website.
 */
export function siteCarePolicy(user: CareUser): SiteCarePolicy {
  if (user.role === 'admin') {
    return { maxSites: null, watchIntervals: ['weekly', 'daily', 'hourly', 'custom'], targetedVerify: true }
  }
  const revoked = ['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)
  const effectivePlan: Plan = revoked ? 'FREE' : user.plan
  return {
    maxSites: siteCapForPlan(effectivePlan),
    watchIntervals: hasOpenBetaAccess(user) || effectivePlan !== 'FREE' ? ['weekly', 'daily', 'hourly', 'custom'] : ['weekly'],
    targetedVerify: true,
  }
}
