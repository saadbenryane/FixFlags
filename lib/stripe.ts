import Stripe from 'stripe'
import { Plan } from '@prisma/client'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export const PLAN_LIMITS: Record<Plan, { audits: number; label: string; price: string }> = {
  FREE: { audits: 3, label: 'Free', price: '$0' },
  BUILDER: { audits: 25, label: 'Builder', price: '$49/mo' },
  TEAM: { audits: 100, label: 'Team', price: '$199/mo' },
  STUDIO: { audits: 500, label: 'Studio', price: '$999/mo' },
}

export const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = {
  BUILDER: process.env.STRIPE_BUILDER_PRICE_ID!,
  TEAM: process.env.STRIPE_TEAM_PRICE_ID!,
  STUDIO: process.env.STRIPE_STUDIO_PRICE_ID!,
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const [plan, pid] of Object.entries(STRIPE_PRICE_IDS)) {
    if (pid === priceId) return plan as Plan
  }
  return null
}
