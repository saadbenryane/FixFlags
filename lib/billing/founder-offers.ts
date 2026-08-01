import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { envPriceUsd } from '@/lib/billing/env'
import { isPaidOpenServer } from '@/lib/billing/paid-open'

export const FOUNDER_OFFER_ID = 'founder_40_12m'

export const FOUNDER_OFFER_DISPLAY_NAME = '40% Founder Discount'

export const FOUNDER_OFFER_PERCENT = 40

export const FOUNDER_OFFER_DURATION_MONTHS = 12

export const DEFAULT_WAITLIST_CAMPAIGN = 'founder_40_ph_2026'

export type FounderCheckoutPlan = 'BUILDER' | 'TEAM'

const FOUNDER_PROMOTION_ENV: Record<FounderCheckoutPlan, string> = {
  BUILDER: 'STRIPE_FOUNDER_PRO_PROMOTION_ID',
  TEAM: 'STRIPE_FOUNDER_STUDIO_PROMOTION_ID',
}

export function founderPromotionIdForPlan(plan: FounderCheckoutPlan): string | undefined {
  const key = FOUNDER_PROMOTION_ENV[plan]
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

export function isFounderOfferConfigured(plan: FounderCheckoutPlan): boolean {
  return Boolean(founderPromotionIdForPlan(plan))
}

export interface FounderEligibilityInput {
  id: string
  founderOfferRedeemedAt: Date | null
}

/** One founder redemption per account; waitlist membership required for the target plan. */
export async function isFounderOfferEligible(
  user: FounderEligibilityInput,
  plan: FounderCheckoutPlan
): Promise<boolean> {
  if (!isPaidOpenServer()) return false
  if (user.founderOfferRedeemedAt) return false
  const entry = await prisma.paidPlanWaitlistEntry.findUnique({
    where: { userId_plan: { userId: user.id, plan } },
    select: { id: true },
  })
  return Boolean(entry)
}

export async function founderCheckoutDiscounts(
  plan: FounderCheckoutPlan,
  user: FounderEligibilityInput
): Promise<{ promotion_code: string }[] | undefined> {
  if (!(await isFounderOfferEligible(user, plan))) return undefined
  const promotionId = founderPromotionIdForPlan(plan)
  if (!promotionId) return undefined
  return [{ promotion_code: promotionId }]
}

export function planFromFounderCheckout(plan: FounderCheckoutPlan): Plan {
  return plan
}

export function listPriceUsdForPlan(plan: FounderCheckoutPlan): number {
  if (plan === 'BUILDER') return envPriceUsd('STRIPE_BUILDER_PRICE_USD', 69)
  return envPriceUsd('STRIPE_TEAM_PRICE_USD', 199)
}
