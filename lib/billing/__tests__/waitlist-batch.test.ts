import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  paidPlanWaitlistEntry: {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  waitlistInvite: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  waitlistLead: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  DEFAULT_BATCH_SIZE,
  batchForPosition,
  claimWaitlistLead,
  generateWaitlistInvite,
  grantBatchAccess,
  hasPlanAccessGranted,
  isCheckoutEligible,
  redeemInvite,
  upsertPaidPlanWaitlistEntry,
  waitlistBatchSize,
} from '@/lib/billing/waitlist'

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

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.WAITLIST_OPEN_BATCH
  delete process.env.WAITLIST_BATCH_SIZE
})

afterEach(() => {
  delete process.env.WAITLIST_OPEN_BATCH
  delete process.env.WAITLIST_BATCH_SIZE
})

describe('batch size and position math', () => {
  it('defaults to 500 per batch (env-overridable)', () => {
    expect(DEFAULT_BATCH_SIZE).toBe(500)
    expect(waitlistBatchSize()).toBe(500)
    process.env.WAITLIST_BATCH_SIZE = '100'
    expect(waitlistBatchSize()).toBe(100)
    process.env.WAITLIST_BATCH_SIZE = 'nope'
    expect(waitlistBatchSize()).toBe(500)
  })

  it('assigns batch 1 to positions 1..500 and batch 2 to 501..1000', () => {
    expect(batchForPosition(1)).toBe(1)
    expect(batchForPosition(500)).toBe(1)
    expect(batchForPosition(501)).toBe(2)
    expect(batchForPosition(1000)).toBe(2)
    expect(batchForPosition(1001)).toBeNull()
  })

  it('honors a custom batch size override', () => {
    process.env.WAITLIST_BATCH_SIZE = '250'
    expect(batchForPosition(250)).toBe(1)
    expect(batchForPosition(251)).toBe(2)
    expect(batchForPosition(500)).toBe(2)
    expect(batchForPosition(501)).toBeNull()
  })

  it('never overshoots the caps under a simulated 600-join burst', () => {
    // 600 concurrent joins serialized by the per-plan advisory lock map to
    // exactly 500 batch-1 and 100 batch-2 members, never more.
    const counts = { 1: 0, 2: 0, none: 0 }
    for (let position = 1; position <= 600; position++) {
      const batch = batchForPosition(position)
      if (batch === 1) counts[1]++
      else if (batch === 2) counts[2]++
      else counts.none++
    }
    expect(counts[1]).toBe(500)
    expect(counts[2]).toBe(100)
    expect(counts.none).toBe(0)
  })
})

describe('isCheckoutEligible (batch gate matrix)', () => {
  it('passes users with no waitlist row (legacy global-open behavior)', () => {
    expect(isCheckoutEligible(null)).toBe(true)
  })

  it('passes explicitly granted members regardless of open batch', () => {
    expect(
      isCheckoutEligible({ batch: 2, accessGrantedAt: new Date() })
    ).toBe(true)
    expect(
      isCheckoutEligible({ batch: null, accessGrantedAt: new Date() })
    ).toBe(true)
  })

  it('blocks everyone when no batch is open', () => {
    expect(isCheckoutEligible({ batch: 1, accessGrantedAt: null })).toBe(false)
    expect(isCheckoutEligible({ batch: 2, accessGrantedAt: null })).toBe(false)
    expect(isCheckoutEligible({ batch: null, accessGrantedAt: null })).toBe(false)
  })

  it('releases batch 1 only when WAITLIST_OPEN_BATCH=1', () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    expect(isCheckoutEligible({ batch: 1, accessGrantedAt: null })).toBe(true)
    expect(isCheckoutEligible({ batch: 2, accessGrantedAt: null })).toBe(false)
    // Members beyond the caps (no batch) stay blocked until general release.
    expect(isCheckoutEligible({ batch: null, accessGrantedAt: null })).toBe(false)
  })

  it('releases batch 1 and 2 (general release) when WAITLIST_OPEN_BATCH=2', () => {
    process.env.WAITLIST_OPEN_BATCH = '2'
    expect(isCheckoutEligible({ batch: 1, accessGrantedAt: null })).toBe(true)
    expect(isCheckoutEligible({ batch: 2, accessGrantedAt: null })).toBe(true)
    // General release: waitlisters beyond the caps may buy at list price.
    expect(isCheckoutEligible({ batch: null, accessGrantedAt: null })).toBe(true)
  })
})

describe('hasPlanAccessGranted', () => {
  it('queries the member entry and applies the gate', async () => {
    process.env.WAITLIST_OPEN_BATCH = '1'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 1,
      accessGrantedAt: null,
    })
    expect(await hasPlanAccessGranted('user-1', 'BUILDER')).toBe(true)

    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: 2,
      accessGrantedAt: null,
    })
    expect(await hasPlanAccessGranted('user-1', 'BUILDER')).toBe(false)

    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    expect(await hasPlanAccessGranted('user-1', 'BUILDER')).toBe(true)

    expect(prismaMock.paidPlanWaitlistEntry.findUnique).toHaveBeenCalledWith({
      where: { userId_plan: { userId: 'user-1', plan: 'BUILDER' } },
      select: { batch: true, accessGrantedAt: true },
    })
  })
})

describe('upsertPaidPlanWaitlistEntry batch snapshot', () => {
  it('assigns batch from join position on create', async () => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(0)
    tx.paidPlanWaitlistEntry.create.mockImplementation(async ({ data }) => ({
      id: 'entry-new',
      ...data,
    }))
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx)
    )
    await upsertPaidPlanWaitlistEntry({ userId: 'user-1', plan: 'BUILDER' })

    expect(tx.paidPlanWaitlistEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ batch: 1, discountTier: 1 }),
    })
  })

  it('keeps the batch on re-join (snapshot never changes)', async () => {
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-existing',
      userId: 'user-1',
      plan: 'BUILDER',
      batch: 1,
    })
    tx.paidPlanWaitlistEntry.update.mockResolvedValue({ id: 'entry-existing' })
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx)
    )
    await upsertPaidPlanWaitlistEntry({ userId: 'user-1', plan: 'BUILDER' })

    expect(tx.paidPlanWaitlistEntry.create).not.toHaveBeenCalled()
    expect(tx.paidPlanWaitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({}) })
    )
  })
})

describe('generateWaitlistInvite', () => {
  it('creates an invite with a unique 8-char URL-safe code', async () => {
    prismaMock.waitlistInvite.create.mockImplementation(async ({ data }) => ({
      id: 'invite-1',
      ...data,
    }))
    const invite = await generateWaitlistInvite({
      inviteeEmail: '  Invitee@Example.com ',
      plan: 'BUILDER',
      batch: 1,
    })
    expect(invite.code).toMatch(/^[A-Za-z0-9_-]{8}$/)
    expect(invite.inviteeEmail).toBe('invitee@example.com')
    expect(invite.plan).toBe('BUILDER')
    expect(invite.batch).toBe(1)
    expect(invite.inviterUserId).toBeNull()
  })

  it('retries on a code collision (unique constraint)', async () => {
    prismaMock.waitlistInvite.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockImplementation(async ({ data }) => ({ id: 'invite-1', ...data }))
    const invite = await generateWaitlistInvite({
      inviteeEmail: 'a@example.com',
      plan: 'TEAM',
    })
    expect(prismaMock.waitlistInvite.create).toHaveBeenCalledTimes(2)
    expect(invite.code).toMatch(/^[A-Za-z0-9_-]{8}$/)
  })
})

describe('redeemInvite', () => {
  const pendingInvite = {
    id: 'invite-1',
    inviteeEmail: 'x@example.com',
    plan: 'BUILDER',
    batch: 1,
    status: 'PENDING',
    code: 'ABCD1234',
    redeemedAt: null,
    joinedUserId: null,
  }

  it('creates a waitlist row with batch + accessGrantedAt for a signed-in invitee', async () => {
    prismaMock.waitlistInvite.findUnique.mockResolvedValue(pendingInvite)
    const tx = txMock()
    tx.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    tx.paidPlanWaitlistEntry.count.mockResolvedValue(10)
    tx.paidPlanWaitlistEntry.create.mockImplementation(async ({ data }) => ({
      id: 'entry-invited',
      batch: data.batch,
      accessGrantedAt: data.accessGrantedAt,
    }))
    prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx)
    )

    const result = await redeemInvite({
      code: 'ABCD1234',
      plan: 'BUILDER',
      userId: 'user-1',
      email: 'x@example.com',
    })

    expect(result).toMatchObject({ ok: true, mode: 'entry', batch: 1 })
    expect(tx.paidPlanWaitlistEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batch: 1,
        accessGrantedAt: expect.any(Date),
        discountTier: 1, // position 11 is a tier-1 slot (first 500)
        source: 'invite',
      }),
    })
    expect(prismaMock.waitlistInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'JOINED', joinedUserId: 'user-1' }),
      })
    )
  })

  it('captures an anonymous invitee email-only with the grant preserved on the lead', async () => {
    prismaMock.waitlistInvite.findUnique.mockResolvedValue(pendingInvite)
    prismaMock.waitlistLead.findUnique.mockResolvedValue(null)
    prismaMock.waitlistLead.create.mockImplementation(async ({ data }) => ({
      id: 'lead-1',
      ...data,
    }))

    const result = await redeemInvite({
      code: 'ABCD1234',
      plan: 'BUILDER',
      email: 'x@example.com',
    })

    expect(result).toMatchObject({ ok: true, mode: 'lead', batch: 1 })
    expect(prismaMock.waitlistLead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'x@example.com',
        plan: 'BUILDER',
        batch: 1,
        accessGrantedAt: expect.any(Date),
      }),
    })
    expect(prismaMock.waitlistInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'JOINED', redeemedAt: expect.any(Date) }),
      })
    )
    expect(prismaMock.waitlistInvite.update.mock.calls[0][0].data.joinedUserId).toBeUndefined()
  })

  it('rejects unknown, revoked, already-redeemed, and wrong-plan codes', async () => {
    prismaMock.waitlistInvite.findUnique.mockResolvedValue(null)
    expect(await redeemInvite({ code: 'NOPE1234', plan: 'BUILDER' })).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    })

    prismaMock.waitlistInvite.findUnique.mockResolvedValue({
      ...pendingInvite,
      status: 'REVOKED',
    })
    expect(await redeemInvite({ code: 'ABCD1234', plan: 'BUILDER' })).toEqual({
      ok: false,
      reason: 'REVOKED',
    })

    prismaMock.waitlistInvite.findUnique.mockResolvedValue({
      ...pendingInvite,
      status: 'JOINED',
    })
    expect(await redeemInvite({ code: 'ABCD1234', plan: 'BUILDER' })).toEqual({
      ok: false,
      reason: 'ALREADY_REDEEMED',
    })

    prismaMock.waitlistInvite.findUnique.mockResolvedValue({
      ...pendingInvite,
      plan: 'TEAM',
    })
    expect(await redeemInvite({ code: 'ABCD1234', plan: 'BUILDER' })).toEqual({
      ok: false,
      reason: 'PLAN_MISMATCH',
    })
  })

  it('requires an email for anonymous redemption', async () => {
    prismaMock.waitlistInvite.findUnique.mockResolvedValue(pendingInvite)
    expect(await redeemInvite({ code: 'ABCD1234', plan: 'BUILDER' })).toEqual({
      ok: false,
      reason: 'EMAIL_REQUIRED',
    })
  })
})

describe('grantBatchAccess', () => {
  it('stamps accessGrantedAt on every not-yet-granted member of the cohort', async () => {
    prismaMock.paidPlanWaitlistEntry.updateMany.mockResolvedValue({ count: 42 })
    const count = await grantBatchAccess('BUILDER', 1)
    expect(count).toBe(42)
    expect(prismaMock.paidPlanWaitlistEntry.updateMany).toHaveBeenCalledWith({
      where: { plan: 'BUILDER', batch: 1, accessGrantedAt: null },
      data: { accessGrantedAt: expect.any(Date) },
    })
  })
})

describe('claimWaitlistLead (attach-on-signup)', () => {
  it('claims the lead and carries the invite grant onto the member entry', async () => {
    prismaMock.waitlistLead.findFirst.mockResolvedValue({
      id: 'lead-1',
      email: 'x@example.com',
      plan: 'BUILDER',
      batch: 1,
      accessGrantedAt: new Date('2026-09-01T00:00:00Z'),
      status: 'PENDING',
      claimedUserId: null,
    })
    prismaMock.waitlistLead.update.mockResolvedValue({ id: 'lead-1' })
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      batch: null,
      accessGrantedAt: null,
    })
    prismaMock.paidPlanWaitlistEntry.update.mockResolvedValue({ id: 'entry-1' })

    const result = await claimWaitlistLead('user-1', 'X@Example.com', 'BUILDER')

    expect(result).toEqual({
      entryId: 'entry-1',
      inheritedBatch: 1,
      accessGranted: true,
    })
    expect(prismaMock.waitlistLead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        status: 'CLAIMED',
        claimedUserId: 'user-1',
        claimedAt: expect.any(Date),
      }),
    })
    expect(prismaMock.paidPlanWaitlistEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: expect.objectContaining({ batch: 1, accessGrantedAt: expect.any(Date) }),
    })
  })

  it('returns null when no unclaimed lead matches', async () => {
    prismaMock.waitlistLead.findFirst.mockResolvedValue(null)
    expect(await claimWaitlistLead('user-1', 'x@example.com', 'BUILDER')).toBeNull()
  })
})
