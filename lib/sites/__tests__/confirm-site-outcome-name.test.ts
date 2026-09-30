import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  lockOutcome: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  txFindFirst: vi.fn(),
  txUpdateMany: vi.fn(),
  txFindUniqueOrThrow: vi.fn(),
  bindingUpdateMany: vi.fn(),
  bindingUpsert: vi.fn(),
}))

const tx = {
  $queryRaw: mocks.lockOutcome,
  siteOutcome: {
    findFirst: mocks.txFindFirst,
    updateMany: mocks.txUpdateMany,
    findUniqueOrThrow: mocks.txFindUniqueOrThrow,
  },
  outcomeExecutionBinding: {
    updateMany: mocks.bindingUpdateMany,
    upsert: mocks.bindingUpsert,
  },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    siteOutcome: { findFirst: mocks.findFirst, update: mocks.update },
    sitePage: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn() }))

import { OutcomeKindMismatchError, confirmSiteOutcome, renameSiteOutcome } from '@/lib/sites/outcomes'

const site = {
  siteId: 'project-1',
  kind: 'project' as const,
  projectId: 'project-1',
  provisionalSiteId: null,
  url: 'https://example.com',
  canonicalHost: 'example.com',
  name: 'Example',
  primaryAuditId: null,
  watchInterval: null,
  watchNextRunAt: null,
  watchLastRunAt: null,
  watchLastError: null,
  watchConsecutiveFailures: 0,
  userId: 'user-1',
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outcome-1',
    name: 'Contact support',
    slug: 'contact-support',
    description: null,
    inferenceSource: 'browser',
    confirmedAt: null,
    pages: [],
    kind: 'GENERIC',
    criticality: 'IMPORTANT',
    environment: 'production',
    expectation: null,
    bindings: [],
    assessments: [],
    runSelections: [],
    ...overrides,
  }
}

describe('confirmSiteOutcome semantic identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
    mocks.lockOutcome.mockResolvedValue([{ id: 'outcome-1' }])
    mocks.txFindFirst.mockResolvedValue({ id: 'outcome-1', name: 'Contact support', kind: 'GENERIC', confirmedAt: null })
    mocks.txUpdateMany.mockResolvedValue({ count: 1 })
    mocks.bindingUpdateMany.mockResolvedValue({ count: 0 })
    mocks.bindingUpsert.mockResolvedValue({ id: 'binding-1' })
    mocks.txFindUniqueOrThrow.mockResolvedValue(row({
      name: 'Checkout',
      inferenceSource: 'user',
      confirmedAt: new Date('2026-09-30T00:00:00.000Z'),
      kind: 'CHECKOUT',
      expectation: 'The selected product appears in the cart and checkout opens.',
      bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }],
    }))
  })

  it('assigns the execution kind canonical name instead of preserving a mismatched inference', async () => {
    await confirmSiteOutcome({
      site,
      outcomeId: 'outcome-1',
      confirmed: true,
      kind: 'CHECKOUT',
      name: 'Contact support',
    })

    expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Checkout', kind: 'CHECKOUT' }),
    }))
  })

  it('refuses to reclassify a known Outcome even when the request bypasses the UI', async () => {
    mocks.txFindFirst.mockResolvedValue({
      id: 'outcome-1',
      name: 'Signup',
      kind: 'SIGNUP',
      confirmedAt: null,
    })

    await expect(confirmSiteOutcome({
      site,
      outcomeId: 'outcome-1',
      confirmed: true,
      kind: 'AVAILABILITY',
    })).rejects.toBeInstanceOf(OutcomeKindMismatchError)
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
    expect(mocks.txUpdateMany).not.toHaveBeenCalled()
  })

  it('uses one transaction for binding retirement, binding install and semantic update', async () => {
    await confirmSiteOutcome({ site, outcomeId: 'outcome-1', confirmed: true, kind: 'CHECKOUT' })

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.lockOutcome).toHaveBeenCalledTimes(1)
    expect(mocks.bindingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ outcomeId: 'outcome-1', key: { not: 'checkout-browser-v1' } }),
      data: { enabled: false },
    }))
    expect(mocks.bindingUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.txUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('preserves a customer rename and confirmation time on a stale same-kind confirmation', async () => {
    const confirmedAt = new Date('2026-09-29T00:00:00.000Z')
    mocks.txFindFirst.mockResolvedValue({
      id: 'outcome-1',
      name: 'A customer can buy the annual plan',
      kind: 'CHECKOUT',
      confirmedAt,
    })
    mocks.txFindUniqueOrThrow.mockResolvedValue(row({
      name: 'A customer can buy the annual plan',
      inferenceSource: 'user',
      confirmedAt,
      kind: 'CHECKOUT',
      bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }],
    }))

    await confirmSiteOutcome({ site, outcomeId: 'outcome-1', confirmed: true, kind: 'CHECKOUT' })

    const data = mocks.txUpdateMany.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(data).not.toHaveProperty('name')
    expect(data.confirmedAt).toBe(confirmedAt)
  })

  it('rejects the whole operation when the semantic write fails after the binding write', async () => {
    mocks.txUpdateMany.mockRejectedValueOnce(new Error('semantic write failed'))

    await expect(confirmSiteOutcome({
      site,
      outcomeId: 'outcome-1',
      confirmed: true,
      kind: 'CHECKOUT',
    })).rejects.toThrow('semantic write failed')
    expect(mocks.bindingUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})

describe('renameSiteOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findFirst.mockResolvedValue({ id: 'outcome-1' })
    mocks.update.mockResolvedValue(row({
      name: 'A customer can check out',
      inferenceSource: 'user',
      confirmedAt: new Date('2026-09-29T00:00:00.000Z'),
      kind: 'CHECKOUT',
      bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }],
    }))
  })

  it('changes only the label and preserves confirmation, kind and bindings', async () => {
    const result = await renameSiteOutcome({
      site,
      outcomeId: 'outcome-1',
      name: '  A customer can check out  ',
    })

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'A customer can check out', inferenceSource: 'user' },
    }))
    expect(result).toMatchObject({
      name: 'A customer can check out',
      confirmedAt: '2026-09-29T00:00:00.000Z',
      kind: 'CHECKOUT',
      bindings: [{ key: 'checkout-browser-v1' }],
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
