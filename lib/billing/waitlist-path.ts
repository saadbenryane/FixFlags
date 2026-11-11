import type { CheckoutPlan } from '@/lib/billing/client-checkout'

/** Public waitlist addresses: /waitlist/pro, /waitlist/team and /waitlist/agency. */
export type WaitlistPlanSegment = 'pro' | 'team' | 'agency'

/**
 * Each address records an internal checkout plan. Agency has no internal plan
 * yet, so it records TEAM with its own join source.
 */
export const WAITLIST_PLAN_BY_SEGMENT: Record<WaitlistPlanSegment, CheckoutPlan> = {
  pro: 'BUILDER',
  team: 'TEAM',
  agency: 'TEAM',
}

/** Retired addresses that still resolve. /waitlist/studio predates the Team name. */
export const RETIRED_WAITLIST_SEGMENTS: Record<string, WaitlistPlanSegment> = {
  studio: 'team',
}

export function isWaitlistPlanSegment(value: string): value is WaitlistPlanSegment {
  return Object.hasOwn(WAITLIST_PLAN_BY_SEGMENT, value)
}

export function waitlistPathForSegment(segment: WaitlistPlanSegment): string {
  return `/waitlist/${segment}`
}

/** Paid intent goes to the waitlist while Stripe checkout is closed. */
export function waitlistPathForPlan(plan: CheckoutPlan): string {
  return waitlistPathForSegment(plan === 'TEAM' ? 'team' : 'pro')
}
