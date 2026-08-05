import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  paidPlanWaitlistEntry: { findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const getStripe = vi.hoisted(() => vi.fn())
const getAppUrl = vi.hoisted(() => vi.fn())
const tierCheckoutDiscounts = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))
vi.mock('@/lib/stripe', () => ({ getStripe }))
vi.mock('@/lib/billing/paid-open', () => ({ isPaidOpenServer: () => true }))
vi.mock('@/lib/billing/discount-tiers', () => ({ tierCheckoutDiscounts }))
vi.mock('@/lib/billing/plans', () => ({
  PLAN_DEFINITIONS: {
    FREE: { plan: 'FREE', stripePriceId: null },
    BUILDER: { plan: 'BUILDER', stripePriceId: 'price_builder' },
    TEAM: { plan: 'TEAM', stripePriceId: 'price_team' },
  },
}))

import { POST as checkout } from '@/app/api/stripe/checkout/route'
import { POST as portal } from '@/app/api/stripe/portal/route'

describe('stripe checkout and portal routes', () => {
  const stripe = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@example.com' } })
    getStripe.mockReturnValue(stripe)
    getAppUrl.mockReturnValue('http://localhost:3000')
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'FREE',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
    })
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.test/checkout' })
    stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://stripe.test/portal' })
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tierCheckoutDiscounts.mockResolvedValue(null)
  })

  it('requires sign-in for checkout', async () => {
    getSession.mockResolvedValue(null)
    const response = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'BUILDER' }),
    }))
    expect(response.status).toBe(401)
  })

  it('rejects invalid plans and starts checkout for free users', async () => {
    const invalid = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'FREE' }),
    }))
    expect(invalid.status).toBe(400)

    const ok = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'BUILDER' }),
    }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ url: 'https://stripe.test/checkout' })
  })

  it('redirects active subscribers to the portal', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'ACTIVE',
    })
    const response = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'BUILDER' }),
    }))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('EXISTING_SUBSCRIPTION')
  })

  it('opens the billing portal for customers and rejects users without one', async () => {
    const missing = await portal()
    expect(missing.status).toBe(400)

    prismaMock.user.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'ACTIVE',
    })
    const ok = await portal()
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ url: 'https://stripe.test/portal' })
  })

  it('auto-applies the tier promotion and tags metadata for tier holders', async () => {
    tierCheckoutDiscounts.mockResolvedValue({
      tier: 1,
      promotion_code: 'promo_tier1_pro',
    })
    const response = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'BUILDER' }),
    }))
    expect(response.status).toBe(200)
    const createArgs = stripe.checkout.sessions.create.mock.calls[0][0]
    expect(createArgs.discounts).toEqual([{ promotion_code: 'promo_tier1_pro' }])
    expect(createArgs.allow_promotion_codes).toBeUndefined()
    expect(createArgs.metadata).toMatchObject({ discount_tier: '1' })
    expect(createArgs.subscription_data.metadata).toMatchObject({ discount_tier: '1' })
  })

  it('passes no promotion codes at all for non-tier users (not customer-enterable)', async () => {
    tierCheckoutDiscounts.mockResolvedValue(null)
    const response = await checkout(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'BUILDER' }),
    }))
    expect(response.status).toBe(200)
    const createArgs = stripe.checkout.sessions.create.mock.calls[0][0]
    expect(createArgs.discounts).toBeUndefined()
    expect(createArgs.allow_promotion_codes).toBeUndefined()
    expect(createArgs.metadata.discount_tier).toBeUndefined()
  })
})
