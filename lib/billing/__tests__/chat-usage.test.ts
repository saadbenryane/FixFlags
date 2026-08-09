import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  chatUsagePeriod: { upsert: vi.fn(), update: vi.fn() },
  chatUsageReservation: {
    create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn(),
  },
}))
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  chatUsagePeriod,
  reserveChatUsage,
  finalizeChatUsage,
} from '@/lib/billing/chat-usage'

const user = { id: 'u1', plan: 'FREE' as const, role: 'user', subscriptionStatus: 'NONE' }
const period = {
  id: 'p1', userId: 'u1', periodStart: new Date('2026-08-01T00:00:00Z'),
  periodEnd: new Date('2026-09-01T00:00:00Z'), limitTokens: 25_000,
  inputTokens: 1_000, outputTokens: 500, reservedTokens: 0,
}

describe('monthly chat usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.$queryRaw.mockResolvedValue([])
    tx.chatUsagePeriod.upsert.mockResolvedValue(period)
    tx.chatUsageReservation.aggregate.mockResolvedValue({ _sum: { reservedTokens: null } })
  })

  it('uses UTC calendar-month boundaries', () => {
    expect(chatUsagePeriod(new Date('2026-08-31T23:59:00-08:00'))).toEqual({
      start: new Date('2026-09-01T00:00:00Z'),
      end: new Date('2026-10-01T00:00:00Z'),
    })
  })

  it('locks the user period and reserves only available allowance', async () => {
    tx.chatUsageReservation.create.mockResolvedValue({ id: 'r1' })
    tx.chatUsagePeriod.update.mockResolvedValue({ ...period, reservedTokens: 10_000 })
    const result = await reserveChatUsage(user, 10_000, new Date('2026-08-09T00:00:00Z'))
    expect(tx.$queryRaw).toHaveBeenCalledOnce()
    expect(tx.chatUsageReservation.create).toHaveBeenCalledWith({
      data: {
        periodId: 'p1', reservedTokens: 10_000,
        expiresAt: new Date('2026-08-09T00:05:00Z'),
      },
    })
    expect(result).toMatchObject({ reservationId: 'r1', allowance: { remaining: 13_500 } })
  })

  it('does not create a reservation when remaining tokens are insufficient', async () => {
    tx.chatUsagePeriod.upsert.mockResolvedValue({ ...period, inputTokens: 20_000 })
    const result = await reserveChatUsage(user, 10_000)
    expect(result).toMatchObject({ reservationId: null, allowance: { remaining: 4_500 } })
    expect(tx.chatUsageReservation.create).not.toHaveBeenCalled()
  })

  it('reconciles the reservation to provider-reported input and output usage', async () => {
    tx.chatUsageReservation.findUnique.mockResolvedValue({
      id: 'r1', periodId: 'p1', reservedTokens: 10_000, status: 'RESERVED', period,
    })
    tx.chatUsageReservation.update.mockResolvedValue({})
    tx.chatUsagePeriod.update.mockResolvedValue({
      ...period, inputTokens: 1_120, outputTokens: 530, reservedTokens: 0,
    })
    const allowance = await finalizeChatUsage('r1', { inputTokens: 120.9, outputTokens: 30.2 })
    expect(tx.chatUsageReservation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inputTokens: 120, outputTokens: 30, status: 'FINALIZED' }),
    }))
    expect(allowance).toMatchObject({ used: 1_650, remaining: 23_350 })
  })
})
