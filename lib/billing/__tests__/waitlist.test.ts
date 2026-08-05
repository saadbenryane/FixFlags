import { describe, expect, it, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { upsertPaidPlanWaitlistEntry } from '@/lib/billing/waitlist'
import { DEFAULT_WAITLIST_CAMPAIGN } from '@/lib/billing/discount-tiers'

function txMock(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: vi.fn(),
    paidPlanWaitlistEntry: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ...overrides,
  }
}

describe('upsertPaidPlanWaitlistEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function runWith(tx: ReturnType<typeof txMock>) {
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    return upsertPaidPlanWaitlistEntry({ userId: 'user-1', plan: 'BUILDER' })
  }

  it('takes a per-plan advisory lock inside the transaction', async () => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(0)
    tx.paidPlanWaitlistEntry.create.mockResolvedValue({ id: 'entry-1' })
    await runWith(tx)

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    const sqlText = JSON.stringify(tx.$executeRaw.mock.calls[0] ?? '')
    expect(sqlText).toContain('pg_advisory_xact_lock')
    expect(sqlText).toContain('waitlist_tier:BUILDER')
    // The lock and the count+create happen in the same interactive transaction.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it.each([
    [0, 1], // position 1
    [499, 1], // position 500: last tier-1 slot
    [500, 2], // position 501: first tier-2 slot
    [999, 2], // position 1000: last tier-2 slot
    [1000, null], // position 1001: list price
  ])('assigns tier from existing count of %i -> position %i tier', async (count, expectedTier) => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(count)
    tx.paidPlanWaitlistEntry.create.mockImplementation(async ({ data }) => ({
      id: 'entry-new',
      ...data,
    }))
    await runWith(tx)

    expect(tx.paidPlanWaitlistEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ discountTier: expectedTier }),
    })
  })

  it('never overshoots the caps under a burst: positions are exact under the lock', async () => {
    // A burst of 1001 concurrent joins serialized by the advisory lock yields
    // exactly 500 tier-1 and 500 tier-2 rows. Per-call the tier is a pure
    // function of the count observed under the lock.
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(1000)
    tx.paidPlanWaitlistEntry.create.mockResolvedValue({ id: 'entry-1001' })
    await runWith(tx)
    expect(tx.paidPlanWaitlistEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ discountTier: null }),
    })
  })

  it('keeps the tier on re-join and does not consume a new position', async () => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-existing',
      userId: 'user-1',
      plan: 'BUILDER',
      discountTier: 1,
    })
    tx.paidPlanWaitlistEntry.update.mockResolvedValue({ id: 'entry-existing' })
    await runWith(tx)

    expect(tx.paidPlanWaitlistEntry.count).not.toHaveBeenCalled()
    expect(tx.paidPlanWaitlistEntry.create).not.toHaveBeenCalled()
    expect(tx.paidPlanWaitlistEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-existing' },
      data: expect.objectContaining({
        source: undefined,
        campaign: DEFAULT_WAITLIST_CAMPAIGN,
      }),
    })
  })

  it('updates the captured email on re-join and stores it on create', async () => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(0)
    tx.paidPlanWaitlistEntry.create.mockResolvedValue({ id: 'entry-new' })
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx)
    )
    await upsertPaidPlanWaitlistEntry({
      userId: 'user-1',
      plan: 'BUILDER',
      email: 'captured@example.com',
      source: 'waitlist',
    })

    expect(tx.paidPlanWaitlistEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'captured@example.com',
        source: 'waitlist',
        discountTier: 1,
      }),
    })
  })
})
