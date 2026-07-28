import { prisma } from '@/lib/db'
import type { User, Prisma } from '@prisma/client'
import { envPriceId } from '@/lib/billing/env'

export interface CreditPack {
  id: string
  credits: number
  priceUsdCents: number
  stripePriceId?: string
  label: string
  popular?: boolean
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_10', credits: 10, priceUsdCents: 1500, stripePriceId: envPriceId('STRIPE_CREDIT_PACK_10_ID'), label: '+10 audits', popular: true },
  { id: 'pack_25', credits: 25, priceUsdCents: 3000, stripePriceId: envPriceId('STRIPE_CREDIT_PACK_25_ID'), label: '+25 audits' },
  { id: 'pack_50', credits: 50, priceUsdCents: 5000, stripePriceId: envPriceId('STRIPE_CREDIT_PACK_50_ID'), label: '+50 audits' },
]

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId)
}

export function getCreditPackStripePriceId(packId: string): string | undefined {
  const pack = getCreditPack(packId)
  return pack?.stripePriceId
}

export async function getPurchasedCreditsRemaining(userId: string): Promise<number> {
  const result = await prisma.creditPurchase.aggregate({
    where: { userId, status: 'PAID' },
    _sum: { creditsRemaining: true },
  })
  return result._sum.creditsRemaining ?? 0
}

export async function getTotalAvailableCredits(user: Pick<User, 'id' | 'auditsUsed' | 'auditsLimit' | 'role'>): Promise<number> {
  const planRemaining = Math.max(0, user.auditsLimit - user.auditsUsed)
  const purchased = await getPurchasedCreditsRemaining(user.id)
  return planRemaining + purchased
}

export async function consumePurchasedCredit(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const oldestPack = await tx.creditPurchase.findFirst({
    where: { userId, status: 'PAID', creditsRemaining: { gt: 0 } },
    orderBy: { paidAt: 'asc' },
  })
  if (!oldestPack) return false

  await tx.creditPurchase.update({
    where: { id: oldestPack.id },
    data: { creditsRemaining: { decrement: 1 } },
  })
  return true
}

export async function refundPurchasedCredit(
  tx: Prisma.TransactionClient,
  stripePaymentIntentId: string
): Promise<boolean> {
  const purchase = await tx.creditPurchase.findFirst({
    where: { stripePaymentIntentId, status: 'PAID', creditsRemaining: { gt: 0 } },
  })
  if (!purchase) return false

  await tx.creditPurchase.update({
    where: { id: purchase.id },
    data: { status: 'REFUNDED', creditsRemaining: 0 },
  })
  return true
}

export async function wouldBlockNewCheckWithCredits(
  user: Pick<User, 'id' | 'plan' | 'role' | 'auditsUsed' | 'auditsLimit'>,
  pending: number
): Promise<{
  allowed: boolean
  code?: 'UPGRADE_REQUIRED' | 'TOKEN_LIMIT'
  action?: 'upgrade' | 'buy_credits'
  error?: string
}> {
  const limit = user.auditsLimit
  const planAvailable = limit - user.auditsUsed
  if (planAvailable > pending) return { allowed: true }

  const purchased = await getPurchasedCreditsRemaining(user.id)
  if (purchased > pending) return { allowed: true }

  if (user.plan === 'FREE') {
    return {
      allowed: false,
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
      error: 'New URL check limit reached. Upgrade to continue.',
    }
  }

  return {
    allowed: false,
    code: user.plan === 'FREE' ? 'UPGRADE_REQUIRED' : 'TOKEN_LIMIT',
    action: user.plan === 'FREE' ? 'upgrade' : 'buy_credits',
    error: user.plan === 'FREE'
      ? 'New URL check limit reached. Upgrade to continue.'
      : 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
  }
}
