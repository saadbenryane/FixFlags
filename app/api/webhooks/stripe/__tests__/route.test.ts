import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const {
  mockFindUniqueProcessed,
  mockCreateProcessed,
  mockUserFindUnique,
  mockUserFindFirst,
  mockUserUpdate,
  mockApplyPlanLimits,
  mockCreditFindUnique,
  mockCreditUpdate,
  mockCreditDeleteMany,
  mockRefundPurchasedCredit,
  mockNotify,
  mockSubscriptionsRetrieve,
  mockConstructEvent,
  mockCreateLifecycle,
  mockWaitlistUpdateMany,
} = vi.hoisted(() => ({
  mockFindUniqueProcessed: vi.fn(),
  mockCreateProcessed: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockApplyPlanLimits: vi.fn(),
  mockCreditFindUnique: vi.fn(),
  mockCreditUpdate: vi.fn(),
  mockCreditDeleteMany: vi.fn(),
  mockRefundPurchasedCredit: vi.fn(),
  mockNotify: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockCreateLifecycle: vi.fn(),
  mockWaitlistUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    processedStripeEvent: {
      findUnique: mockFindUniqueProcessed,
      create: mockCreateProcessed,
    },
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      update: mockUserUpdate,
    },
    creditPurchase: {
      findUnique: mockCreditFindUnique,
      update: mockCreditUpdate,
      deleteMany: mockCreditDeleteMany,
    },
    subscriptionLifecycleEvent: {
      create: mockCreateLifecycle,
    },
    paidPlanWaitlistEntry: {
      updateMany: mockWaitlistUpdateMany,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        processedStripeEvent: {
          findUnique: mockFindUniqueProcessed,
          create: mockCreateProcessed,
        },
        user: {
          findUnique: mockUserFindUnique,
          findFirst: mockUserFindFirst,
          update: mockUserUpdate,
        },
        creditPurchase: {
          findUnique: mockCreditFindUnique,
          update: mockCreditUpdate,
          deleteMany: mockCreditDeleteMany,
        },
        subscriptionLifecycleEvent: {
          create: mockCreateLifecycle,
        },
        paidPlanWaitlistEntry: {
          updateMany: mockWaitlistUpdateMany,
        },
      })
    ),
  },
}))

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  }),
  planFromPriceId: (id: string) => {
    if (id === 'price_builder') return 'BUILDER'
    if (id === 'price_team') return 'TEAM'
    return null
  },
}))

vi.mock('@/lib/billing/limits', () => ({
  applyPlanLimits: mockApplyPlanLimits,
}))

vi.mock('@/lib/billing/credits', () => ({
  refundPurchasedCredit: mockRefundPurchasedCredit,
}))

vi.mock('@/lib/billing/notify', () => ({
  notifyAdminPaymentFailed: mockNotify,
  notifyUserPaymentFailed: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { POST } from '../route'

const WEBHOOK_SECRET = 'whsec_test_secret'

function signBody(body: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const payload = `${timestamp}.${body}`
  const sig = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
  return `t=${timestamp},v1=${sig}`
}

function makeRequest(body: string, signature?: string) {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  })
}

const baseUser = {
  id: 'user_1',
  email: 'a@example.com',
  plan: 'FREE',
  stripeCurrentPeriodEnd: null,
}

function subscriptionObject(status: string = 'active') {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status,
    metadata: { userId: 'user_1' },
    items: { data: [{ price: { id: 'price_builder' } }] },
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  mockFindUniqueProcessed.mockResolvedValue(null)
  mockCreateProcessed.mockResolvedValue({})
  mockCreateLifecycle.mockResolvedValue({})
  mockUserFindUnique.mockResolvedValue(baseUser)
  mockUserFindFirst.mockResolvedValue(baseUser)
  mockUserUpdate.mockResolvedValue({})
  mockApplyPlanLimits.mockResolvedValue(undefined)
  mockNotify.mockResolvedValue(undefined)
})

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET
  delete process.env.STRIPE_SECRET_KEY
})

describe('POST /api/webhooks/stripe', () => {
  it('rejects missing signature', async () => {
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('rejects bad signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })
    const res = await POST(makeRequest('{}', 't=1,v1=bad'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toBe('Webhook signature verification failed')
    expect(JSON.stringify(body)).not.toContain('bad sig')
  })

  it('is idempotent on replay with same payload', async () => {
    const body = JSON.stringify({ id: 'evt_1' })
    const hash = await import('node:crypto').then((c) =>
      c.createHash('sha256').update(body).digest('hex')
    )
    mockFindUniqueProcessed.mockResolvedValue({ id: 'evt_1', payloadHash: hash })
    mockConstructEvent.mockReturnValue({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } })
    const res = await POST(makeRequest(body, signBody(body)))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.replay).toBe(true)
    expect(mockApplyPlanLimits).not.toHaveBeenCalled()
  })

  it('syncs subscription created to BUILDER', async () => {
    const event = {
      id: 'evt_sub',
      created: Math.floor(Date.now() / 1000),
      type: 'customer.subscription.created',
      data: { object: subscriptionObject('active') },
    }
    const body = JSON.stringify(event)
    mockConstructEvent.mockReturnValue(event)
    const res = await POST(makeRequest(body, signBody(body)))
    expect(res.status).toBe(200)
    expect(mockApplyPlanLimits).toHaveBeenCalledWith('user_1', 'BUILDER', expect.anything())
    expect(mockUserUpdate).toHaveBeenCalled()
    expect(mockCreateProcessed).toHaveBeenCalled()
    expect(mockCreateLifecycle).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeEventId: 'evt_sub',
        type: 'SUBSCRIPTION_CREATED',
        previousPlan: 'FREE',
        plan: 'BUILDER',
        status: 'ACTIVE',
      }),
    })
  })

  it('payment_failed syncs subscription and notifies admin', async () => {
    const pastDueSub = subscriptionObject('past_due')
    mockSubscriptionsRetrieve.mockResolvedValue(pastDueSub)
    const event = {
      id: 'evt_fail',
      created: Math.floor(Date.now() / 1000),
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_1' } },
    }
    const body = JSON.stringify(event)
    mockConstructEvent.mockReturnValue(event)
    const res = await POST(makeRequest(body, signBody(body)))
    expect(res.status).toBe(200)
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_1')
    expect(mockApplyPlanLimits).toHaveBeenCalledWith('user_1', 'FREE', expect.anything())
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', subscriptionId: 'sub_1' })
    )
  })

  it('fulfills credit pack on checkout.session.completed', async () => {
    mockCreditFindUnique.mockResolvedValue({
      id: 'cp_1',
      status: 'PENDING',
      creditsPurchased: 10,
    })
    const event = {
      id: 'evt_credits',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_1',
          payment_intent: 'pi_1',
          metadata: { type: 'credit_pack', userId: 'user_1', packId: 'pack_10', credits: '10' },
        },
      },
    }
    const body = JSON.stringify(event)
    mockConstructEvent.mockReturnValue(event)
    const res = await POST(makeRequest(body, signBody(body)))
    expect(res.status).toBe(200)
    expect(mockCreditUpdate).toHaveBeenCalledWith({
      where: { id: 'cp_1' },
      data: expect.objectContaining({
        status: 'PAID',
        creditsRemaining: 10,
        stripePaymentIntentId: 'pi_1',
      }),
    })
  })
})
