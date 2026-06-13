import Stripe from 'stripe'
import { Plan } from '@prisma/client'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' })
  }
  return _stripe
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export const PLAN_LIMITS: Record<Plan, { audits: number; label: string; price: string }> = {
  FREE: { audits: 3, label: 'Free', price: '$0' },
  BUILDER: { audits: 25, label: 'Builder', price: '$49/mo' },
  TEAM: { audits: 100, label: 'Team', price: '$199/mo' },
  STUDIO: { audits: 500, label: 'Studio', price: '$999/mo' },
}

export const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = {
  BUILDER: process.env.STRIPE_BUILDER_PRICE_ID,
  TEAM: process.env.STRIPE_TEAM_PRICE_ID,
  STUDIO: process.env.STRIPE_STUDIO_PRICE_ID,
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const [plan, pid] of Object.entries(STRIPE_PRICE_IDS)) {
    if (pid && pid === priceId) return plan as Plan
  }
  return null
}
