import { describe, expect, it, vi } from 'vitest'
import {
  calendarMonthUtc,
  expectedUsagePeriod,
  rollUserUsagePeriod,
  setStripeUsagePeriod,
} from '@/lib/billing/usage-period'

const JAN_START = new Date('2026-01-01T00:00:00.000Z')
const FEB_START = new Date('2026-02-01T00:00:00.000Z')
const MAR_START = new Date('2026-03-01T00:00:00.000Z')

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    subscriptionStatus: 'NONE',
    stripePriceId: null,
    stripeCurrentPeriodStart: null,
    stripeCurrentPeriodEnd: null,
    usagePeriodStart: JAN_START,
    usagePeriodEnd: FEB_START,
    auditsUsed: 3,
    auditsLimit: 3,
    deepReviewsUsed: 1,
    deepReviewsLimit: 1,
    ...overrides,
  }
}

function txFor(current: ReturnType<typeof user>) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    user: {
      findUnique: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...current, ...data })),
    },
  }
}

describe('monthly usage periods', () => {
  it('uses exact UTC calendar months for Free', () => {
    expect(calendarMonthUtc(new Date('2026-02-18T23:59:00.000Z'))).toEqual({
      start: FEB_START,
      end: MAR_START,
    })
  })

  it('uses Stripe renewal bounds for a live paid subscription', () => {
    const start = new Date('2026-02-10T12:30:00.000Z')
    const end = new Date('2026-03-10T12:30:00.000Z')
    expect(
      expectedUsagePeriod(
        user({
          plan: 'BUILDER',
          subscriptionStatus: 'ACTIVE',
          stripeCurrentPeriodStart: start,
          stripeCurrentPeriodEnd: end,
        }) as never,
        new Date('2026-02-20T00:00:00.000Z')
      )
    ).toEqual({ start, end })
  })

  it('atomically rolls both Free usage pools without rollover', async () => {
    const tx = txFor(user())
    await rollUserUsagePeriod(tx as never, 'user-1', new Date('2026-02-18T00:00:00.000Z'))

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        usagePeriodStart: FEB_START,
        usagePeriodEnd: MAR_START,
        auditsLimit: 3,
        deepReviewsLimit: 1,
        auditsUsed: 0,
        deepReviewsUsed: 0,
      },
    })
  })

  it('does not reset counters again inside the same period', async () => {
    const tx = txFor(user({ usagePeriodStart: FEB_START, usagePeriodEnd: MAR_START }))
    await rollUserUsagePeriod(tx as never, 'user-1', new Date('2026-02-18T00:00:00.000Z'))
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('aligns a paid account to a new Stripe period and resets once', async () => {
    const tx = txFor(user({ plan: 'BUILDER' }))
    const start = new Date('2026-02-10T12:30:00.000Z')
    const end = new Date('2026-03-10T12:30:00.000Z')
    await setStripeUsagePeriod(tx as never, {
      userId: 'user-1',
      plan: 'BUILDER',
      status: 'ACTIVE',
      priceId: null,
      start,
      end,
    })

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        plan: 'BUILDER',
        usagePeriodStart: start,
        usagePeriodEnd: end,
        auditsLimit: 15,
        deepReviewsLimit: 3,
        auditsUsed: 0,
        deepReviewsUsed: 0,
      }),
    })
  })

  it('keeps the allowance sold with a configured legacy price on renewal', async () => {
    vi.stubEnv('STRIPE_LEGACY_BUILDER_PRICE_IDS', 'price_legacy_pro')
    const tx = txFor(
      user({
        plan: 'BUILDER',
        stripePriceId: 'price_legacy_pro',
        auditsLimit: 25,
        deepReviewsLimit: 4,
      })
    )
    const start = new Date('2026-02-10T12:30:00.000Z')
    const end = new Date('2026-03-10T12:30:00.000Z')

    await setStripeUsagePeriod(tx as never, {
      userId: 'user-1',
      plan: 'BUILDER',
      status: 'ACTIVE',
      priceId: 'price_legacy_pro',
      start,
      end,
    })

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ auditsLimit: 25, deepReviewsLimit: 4 }),
    })
    vi.unstubAllEnvs()
  })

  it('does not overwrite a grandfathered allowance during admission rollover', async () => {
    const start = new Date('2026-02-10T12:30:00.000Z')
    const end = new Date('2026-03-10T12:30:00.000Z')
    const tx = txFor(
      user({
        plan: 'TEAM',
        subscriptionStatus: 'ACTIVE',
        stripePriceId: 'price_preconfiguration_studio',
        stripeCurrentPeriodStart: start,
        stripeCurrentPeriodEnd: end,
        usagePeriodStart: start,
        usagePeriodEnd: end,
        auditsLimit: 80,
        deepReviewsLimit: 10,
      })
    )

    await rollUserUsagePeriod(tx as never, 'user-1', new Date('2026-02-18T00:00:00.000Z'))

    expect(tx.user.update).not.toHaveBeenCalled()
  })
})
