import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
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
// paid-open is intentionally NOT mocked: the batch gate reads the real env
// (STRIPE_PAID_OPEN, WAITLIST_OPEN_BATCH) so this test exercises the true gate.
vi.mock('@/lib/billing/discount-tiers', () => ({ tierCheckoutDiscounts }))
vi.mock('@/lib/billing/plans', () => ({
  PLAN_DEFINITIONS: {
    FREE: { plan: 'FREE', label: 'Free', stripePriceId: null },
    BUILDER: { plan: 'BUILDER', label: 'Pro', stripePriceId: 'price_builder' },
    TEAM: { plan: 'TEAM', label: 'Studio', stripePriceId: 'price_team' },
  },
}))

import { POST as checkout } from '@/app/api/stripe/checkout/route'

function postCheckout(plan: string) {
  return checkout(
    new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    })
  )
}

describe('checkout batch gate (403 BATCH_ACCESS_REQUIRED)', () => {
  const stripe = { checkout: { sessions: { create: vi.fn() } } }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PAID_OPEN = 'true'
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
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tierCheckoutDiscounts.mockResolvedValue(null)
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.test/checkout' })
  })

  afterEach(() => {
    delete process.env.STRIPE_PAID_OPEN
    delete process.env.WAITLIST_OPEN_BATCH
  })

  it('blocks a waitlist member whose batch is not released (403 BATCH_ACCESS_REQUIRED)', async () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 2,
      accessGrantedAt: null,
    })
    const response = await postCheckout('BUILDER')
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('BATCH_ACCESS_REQUIRED')
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('lets an invited member through the gate (explicit accessGrantedAt)', async () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 2,
      accessGrantedAt: new Date(),
    })
    const response = await postCheckout('BUILDER')
    expect(response.status).toBe(200)
    expect((await response.json()).url).toBe('https://stripe.test/checkout')
  })

  it('lets a released-batch member through the gate', async () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 1,
      accessGrantedAt: null,
    })
    const response = await postCheckout('BUILDER')
    expect(response.status).toBe(200)
  })

  it('keeps the master switch authoritative: closed paid-open blocks even granted members', async () => {
    delete process.env.STRIPE_PAID_OPEN
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 1,
      accessGrantedAt: new Date(),
    })
    const response = await postCheckout('BUILDER')
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('PAID_CHECKOUT_CLOSED')
  })

  it('preserves legacy behavior for users with no waitlist row when paid is open', async () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    const response = await postCheckout('BUILDER')
    expect(response.status).toBe(200)
  })
})
