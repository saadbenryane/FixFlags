import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isPaidOpenServer } from '@/lib/billing/paid-open'

/**
 * Launch discount tiers. Replaces the retired 40% founder offer.
 *
 * Tiers are a snapshot AT JOIN TIME, assigned by join order per plan:
 * - positions 1..500   -> tier 1 (25% off)
 * - positions 501..1000 -> tier 2 (15% off)
 * - positions 1001+    -> no tier (list price)
 *
 * Assignment is burst-safe (see lib/billing/waitlist.ts): a Postgres advisory
 * lock per plan serializes concurrent joins so a Product Hunt burst can never
 * overshoot the 500/500 caps.
 *
 * The discount window is "12 months from plan release", configured with
 * PLAN_RELEASE_DATE (unset or invalid -> no discount window). Stripe promotion
 * codes get `redeem_by = PLAN_RELEASE_DATE + 12 months`; see docs/stripe-setup.md.
 */

export type DiscountTier = 1 | 2

export type TierCheckoutPlan = 'BUILDER' | 'TEAM'

export const TIER_1_CAP = 500

export const TIER_2_CAP = 1000

/** Percent off per tier. */
export const TIER_PERCENT: Record<DiscountTier, number> = { 1: 25, 2: 15 }

export const TIER_DURATION_MONTHS = 12

export const DEFAULT_WAITLIST_CAMPAIGN = 'waitlist_launch_2026'

/** Tier for a 1-indexed join position per plan, or null when past both caps. */
export function discountTierForPosition(position: number): DiscountTier | null {
  if (position <= TIER_1_CAP) return 1
  if (position <= TIER_2_CAP) return 2
  return null
}

const TIER_PROMOTION_ENV: Record<DiscountTier, Record<TierCheckoutPlan, string>> = {
  1: {
    BUILDER: 'STRIPE_TIER1_PRO_PROMOTION_ID',
    TEAM: 'STRIPE_TIER1_STUDIO_PROMOTION_ID',
  },
  2: {
    BUILDER: 'STRIPE_TIER2_PRO_PROMOTION_ID',
    TEAM: 'STRIPE_TIER2_STUDIO_PROMOTION_ID',
  },
}

export function tierPromotionIdForPlan(
  tier: DiscountTier,
  plan: TierCheckoutPlan
): string | undefined {
  const key = TIER_PROMOTION_ENV[tier][plan]
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

export function isTierConfigured(plan: TierCheckoutPlan): boolean {
  return Boolean(tierPromotionIdForPlan(1, plan) || tierPromotionIdForPlan(2, plan))
}

/**
 * PLAN_RELEASE_DATE as an ISO date (e.g. "2026-09-01"). Unset or invalid
 * values yield null, which disables the discount window entirely.
 */
export function getPlanReleaseDate(): Date | null {
  const raw = process.env.PLAN_RELEASE_DATE
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * The discount window is active when PLAN_RELEASE_DATE is set and `now` is
 * between release and release + 12 months. The same window is enforced on the
 * Stripe side with `redeem_by` on each tier promotion code; this check is the
 * app-side guard so a misconfigured code never discounts after the window.
 */
export function isDiscountWindowActive(now: Date = new Date()): boolean {
  const release = getPlanReleaseDate()
  if (!release) return false
  if (now < release) return false
  return now < addMonths(release, TIER_DURATION_MONTHS)
}

/** Unix seconds for Stripe `redeem_by`: release + 12 months. */
export function tierPromoRedeemBy(): number | null {
  const release = getPlanReleaseDate()
  if (!release) return null
  return Math.floor(addMonths(release, TIER_DURATION_MONTHS).getTime() / 1000)
}

export function tierLabel(tier: DiscountTier): string {
  return `${TIER_PERCENT[tier]}% off`
}

/**
 * Auto-apply the tier discount at checkout. Eligibility:
 * paid is open, the discount window is active, the user has a waitlist entry
 * for the plan with a tier, and the tier's Stripe promotion is configured.
 */
export async function tierCheckoutDiscounts(
  plan: TierCheckoutPlan,
  userId: string
): Promise<{ tier: DiscountTier; promotion_code: string } | null> {
  if (!isPaidOpenServer()) return null
  if (!isDiscountWindowActive()) return null
  const entry = await prisma.paidPlanWaitlistEntry.findUnique({
    where: { userId_plan: { userId, plan } },
    select: { discountTier: true },
  })
  const tier = entry?.discountTier
  if (tier !== 1 && tier !== 2) return null
  const promotionId = tierPromotionIdForPlan(tier, plan)
  if (!promotionId) return null
  return { tier, promotion_code: promotionId }
}

export function planFromTierCheckout(plan: TierCheckoutPlan): Plan {
  return plan
}
