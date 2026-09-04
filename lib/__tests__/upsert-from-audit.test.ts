import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  leadFindUnique: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdate: vi.fn(),
  auditUpdate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))

import { auditPendingLeadSync, upsertLeadFromAudit } from '@/lib/leads/upsert-from-audit'

function makeTx() {
  return {
    audit: {
      findUnique: mocks.auditFindUnique,
      update: mocks.auditUpdate,
    },
    lead: {
      findUnique: mocks.leadFindUnique,
      create: mocks.leadCreate,
      update: mocks.leadUpdate,
    },
  }
}

function baseAudit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    url: 'https://www.Example.com/pricing',
    userId: 'user-1',
    score: 92,
    normalizedDomain: 'example.com',
    source: 'WEB',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: new Date('2026-01-01T00:05:00.000Z'),
    leadSyncedAt: null,
    runCost: { estimatedCostUsd: new Prisma.Decimal(0.12) },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => unknown) =>
    fn(makeTx())
  )
  mocks.leadCreate.mockResolvedValue({ id: 'lead-new' })
  mocks.leadUpdate.mockResolvedValue({ id: 'lead-existing' })
  mocks.auditUpdate.mockResolvedValue({ id: 'audit-1' })
})

describe('upsertLeadFromAudit idempotency', () => {
  it('skips audits that already have leadSyncedAt', () => {
    expect(auditPendingLeadSync({ leadSyncedAt: new Date() })).toBe(false)
    expect(auditPendingLeadSync({ leadSyncedAt: null })).toBe(true)
  })
})

describe('upsertLeadFromAudit QUALIFIED consistency', () => {
  it('creates leads as NEW even with signup + high score (never QUALIFIED)', async () => {
    mocks.auditFindUnique.mockResolvedValue(baseAudit())
    mocks.leadFindUnique.mockResolvedValue(null)

    await upsertLeadFromAudit('audit-1')

    expect(mocks.leadCreate).toHaveBeenCalledTimes(1)
    const createData = mocks.leadCreate.mock.calls[0][0].data
    expect(createData.status).toBe('NEW')
    expect(createData.status).not.toBe('QUALIFIED')
    expect(createData.linkedUserId).toBe('user-1')
    expect(createData.scanCount).toBe(1)
    expect(createData.latestScore).toBe(92)
    expect(mocks.leadUpdate).not.toHaveBeenCalled()
  })

  it('updates existing leads without writing status (never promotes to QUALIFIED)', async () => {
    mocks.auditFindUnique.mockResolvedValue(
      baseAudit({
        userId: 'user-2',
        score: 88,
        id: 'audit-2',
      })
    )
    mocks.leadFindUnique.mockResolvedValue({
      id: 'lead-1',
      status: 'NEW',
      scanCount: 2,
      linkedUserId: null,
      source: 'web',
      totalCostUsd: new Prisma.Decimal(0.5),
    })

    await upsertLeadFromAudit('audit-2')

    expect(mocks.leadUpdate).toHaveBeenCalledTimes(1)
    const updateData = mocks.leadUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(updateData).not.toHaveProperty('status')
    expect(JSON.stringify(updateData)).not.toContain('QUALIFIED')
    expect(updateData.scanCount).toBe(3)
    expect(updateData.linkedUserId).toBe('user-2')
    expect(mocks.leadCreate).not.toHaveBeenCalled()
  })

  it('preserves CONTACTED / legacy QUALIFIED by omitting status on update', async () => {
    for (const status of ['CONTACTED', 'CONVERTED', 'DISQUALIFIED', 'QUALIFIED'] as const) {
      vi.clearAllMocks()
      mocks.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => unknown) =>
        fn(makeTx())
      )
      mocks.auditFindUnique.mockResolvedValue(baseAudit({ id: `audit-${status}` }))
      mocks.leadFindUnique.mockResolvedValue({
        id: `lead-${status}`,
        status,
        scanCount: 1,
        linkedUserId: 'user-1',
        source: 'web',
        totalCostUsd: new Prisma.Decimal(0.1),
      })
      mocks.leadUpdate.mockResolvedValue({ id: `lead-${status}` })
      mocks.auditUpdate.mockResolvedValue({ id: `audit-${status}` })

      await upsertLeadFromAudit(`audit-${status}`)

      const updateData = mocks.leadUpdate.mock.calls[0][0].data as Record<string, unknown>
      expect(updateData).not.toHaveProperty('status')
      expect(Object.values(updateData)).not.toContain('QUALIFIED')
    }
  })

  it('never passes QUALIFIED on any lead write path', async () => {
    mocks.auditFindUnique.mockResolvedValue(baseAudit({ score: 99, userId: 'u-high' }))
    mocks.leadFindUnique.mockResolvedValue(null)
    await upsertLeadFromAudit('audit-1')

    mocks.auditFindUnique.mockResolvedValue(
      baseAudit({ id: 'audit-3', userId: 'u-high', score: 95 })
    )
    mocks.leadFindUnique.mockResolvedValue({
      id: 'lead-hot',
      status: 'NEW',
      scanCount: 5,
      linkedUserId: 'u-high',
      source: 'web',
      totalCostUsd: new Prisma.Decimal(1),
    })
    await upsertLeadFromAudit('audit-3')

    const payloads = [
      ...mocks.leadCreate.mock.calls.map((c) => c[0]),
      ...mocks.leadUpdate.mock.calls.map((c) => c[0]),
    ]
    expect(payloads.length).toBeGreaterThanOrEqual(2)
    for (const payload of payloads) {
      expect(JSON.stringify(payload)).not.toContain('QUALIFIED')
    }
  })

  it('skips already-synced audits without lead writes', async () => {
    mocks.auditFindUnique.mockResolvedValue(
      baseAudit({ leadSyncedAt: new Date('2026-01-02T00:00:00.000Z') })
    )

    await upsertLeadFromAudit('audit-1')

    expect(mocks.leadCreate).not.toHaveBeenCalled()
    expect(mocks.leadUpdate).not.toHaveBeenCalled()
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })
})
