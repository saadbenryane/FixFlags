import { Plan } from '@prisma/client'

export {
  PLAN_LIMITS,
  STRIPE_PRICE_IDS,
  scanLimitForPlan,
  projectLimitForPlan,
  planFromPriceId,
  getMarketingPlans,
  getExpertReviewStripePriceId,
  EXPERT_REVIEW_PRICE_USD,
  PLAN_DEFINITIONS,
} from '@/lib/billing/plans'

export type { PaidPlan, PlanDefinition } from '@/lib/billing/plans'

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(key, { apiVersion: (process.env.STRIPE_API_VERSION || '2025-02-24.acacia') as Stripe.StripeConfig['apiVersion'] })
  }
  return _stripe
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// Re-export Plan for convenience in checkout routes
export type { Plan }
