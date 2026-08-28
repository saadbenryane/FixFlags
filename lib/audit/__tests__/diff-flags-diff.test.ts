import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import type { FlagStatus, Severity } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    flag: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    audit: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

const { mutateProjectIntelligence, appendVerifiedLearning, productIntelligenceFromContract, notifyWatchRegression } =
  vi.hoisted(() => ({
    mutateProjectIntelligence: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appendVerifiedLearning: vi.fn((pi: unknown, learning: unknown) => pi),
    productIntelligenceFromContract: vi.fn(() => ({ source: 'contract' })),
    notifyWatchRegression: vi.fn(),
  }))

vi.mock('@/lib/audit/ensure-product-project', () => ({
  mutateProjectIntelligence,
}))

vi.mock('@/lib/audit/product-intelligence', () => ({
  appendVerifiedLearning,
  productIntelligenceFromContract,
}))

vi.mock('@/lib/audit/product-contract', () => ({
  parseProductContract: vi.fn((raw: unknown) =>
    raw ? { name: 'Example', purpose: 'Test' } : null
  ),
}))

vi.mock('@/lib/audit/project-watch', () => ({
  notifyWatchRegression,
}))

import {
  diffFlagsAgainstParent,
  getFlagDiffSummary,
  diffMatchKey,
} from '../diff-flags'

type FlagRow = {
  id: string
  checkId: string | null
  problem: string
  rubric: string
  severity: Severity
  status: FlagStatus
  pageUrl?: string | null
  affectedPaths?: unknown
}

function flag(overrides: Partial<FlagRow>): FlagRow {
  return {
    id: 'flag-1',
    checkId: 'cta-dead-link',
    problem: 'Primary CTA is a dead link',
    rubric: 'EXPERIENCE',
    severity: 'IMPORTANT',
    status: 'OPEN',
    pageUrl: null,
    affectedPaths: null,
    ...overrides,
  }
}

function childAudit(overrides: {
  status?: string
  reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
  pages?: Array<{ url: string; status: string; completeness: 'FULL' | 'PARTIAL' | 'UNKNOWN' }>
} = {}) {
  return {
    status: 'COMPLETED' as const,
    reportCompleteness: 'FULL' as const,
    pages: [] as Array<{ url: string; status: string; completeness: 'FULL' | 'PARTIAL' | 'UNKNOWN' }>,
    ...overrides,
  }
}

describe('diffMatchKey', () => {
  it('keys deterministic flags by base check id, collapsing page variants', () => {
    assert.equal(
      diffMatchKey({ checkId: 'cta-dead-link::page:2', problem: 'x', rubric: 'MESSAGE' }),
      diffMatchKey({ checkId: 'cta-dead-link::page:1', problem: 'x', rubric: 'MESSAGE' })
    )
    assert.equal(diffMatchKey({ checkId: 'cta-dead-link', problem: 'x', rubric: 'MESSAGE' }), 'check:cta-dead-link')
  })

  it('keys AI flags by problem and rubric', () => {
    const key = diffMatchKey({ checkId: null, problem: 'Headline is vague', rubric: 'MESSAGE' })
    assert.match(key, /headline/i)
  })
})

describe('getFlagDiffSummary', () => {
  beforeEach(() => {
    prismaMock.flag.findMany.mockReset()
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.findUnique.mockResolvedValue(childAudit())
  })

  it('buckets fixed, unchanged, regressed, and new issues', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', status: 'OPEN' }),
        flag({ id: 'p2', checkId: 'b', problem: 'B problem', status: 'OPEN', severity: 'POLISH' }),
        flag({ id: 'p3', checkId: 'c', status: 'FIXED' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'A still broken', severity: 'IMPORTANT', status: 'OPEN' }),
        flag({ id: 'm2', checkId: 'd', problem: 'New issue', status: 'OPEN' }),
      ])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')

    assert.deepEqual(
      summary.unchanged.map((i) => i.checkId),
      ['a']
    )
    assert.deepEqual(
      summary.fixed.map((i) => i.checkId).sort(),
      ['b', 'c']
    )
    assert.deepEqual(
      summary.newIssues.map((i) => i.checkId),
      ['d']
    )
    assert.deepEqual(summary.regressed, [])
    assert.deepEqual(summary.inconclusive, [])
  })

  it('flags a severity increase as regressed', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', severity: 'POLISH', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'Worse now', severity: 'CRITICAL', status: 'OPEN' }),
      ])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    assert.equal(summary.regressed.length, 1)
    assert.equal(summary.regressed[0].checkId, 'a')
    assert.equal(summary.regressed[0].severity, 'CRITICAL')
    assert.equal(summary.regressed[0].status, 'REGRESSED')
    assert.deepEqual(summary.unchanged, [])
  })

  it('collapses per-page parent variants into one summary entry', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a::page:1' }),
        flag({ id: 'p2', checkId: 'a::page:2' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'Still broken', severity: 'IMPORTANT', status: 'OPEN' }),
      ])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    assert.equal(summary.unchanged.length, 1)
    assert.equal(summary.fixed.length, 0)
  })

  it('returns empty buckets when there are no flags', async () => {
    prismaMock.flag.findMany.mockResolvedValue([])
    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    assert.deepEqual(summary, {
      fixed: [],
      inconclusive: [],
      unchanged: [],
      regressed: [],
      newIssues: [],
    })
  })

  it('keeps product-scoped absences inconclusive when the update Review is partial', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({ reportCompleteness: 'PARTIAL' })
    )
    prismaMock.flag.findMany
      .mockResolvedValueOnce([flag({ id: 'p1', checkId: 'a', status: 'OPEN', pageUrl: null })])
      .mockResolvedValueOnce([])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')

    expect(summary.fixed).toEqual([])
    expect(summary.inconclusive).toHaveLength(1)
  })

  it('credits Fixed when the Flag page is FULL even if the audit is PARTIAL', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'FULL' },
          { url: 'https://example.com/blog', status: 'FAILED', completeness: 'PARTIAL' },
        ],
      })
    )
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'pricing-cta',
          status: 'OPEN',
          pageUrl: 'https://example.com/pricing/',
        }),
      ])
      .mockResolvedValueOnce([])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    expect(summary.fixed).toHaveLength(1)
    expect(summary.inconclusive).toEqual([])
  })

  it('keeps absences inconclusive when the Flag page is missing from the child', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' },
        ],
      })
    )
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'pricing-cta',
          status: 'OPEN',
          pageUrl: 'https://example.com/pricing',
        }),
      ])
      .mockResolvedValueOnce([])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    expect(summary.fixed).toEqual([])
    expect(summary.inconclusive).toHaveLength(1)
  })

  it('keeps multi-path absences inconclusive when only some affected pages are FULL', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' },
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'PARTIAL' },
        ],
      })
    )
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'shared-chrome',
          status: 'OPEN',
          pageUrl: 'https://example.com/',
          affectedPaths: ['https://example.com/', 'https://example.com/pricing'],
        }),
      ])
      .mockResolvedValueOnce([])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    expect(summary.fixed).toEqual([])
    expect(summary.inconclusive).toHaveLength(1)
  })
})

describe('diffFlagsAgainstParent', () => {
  beforeEach(() => {
    prismaMock.flag.findMany.mockReset()
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.findUnique.mockResolvedValue(childAudit())
    prismaMock.$transaction.mockReset()
    prismaMock.$transaction.mockImplementation(async (queries: unknown[]) =>
      Promise.all(queries as Promise<unknown>[])
    )
    prismaMock.flag.update.mockImplementation((args: { where: { id: string }; data: unknown }) =>
      Promise.resolve({ id: args.where.id, data: args.data })
    )
    mutateProjectIntelligence.mockReset()
    mutateProjectIntelligence.mockImplementation(async (_projectId, fn) => fn(null))
    notifyWatchRegression.mockReset()
    notifyWatchRegression.mockResolvedValue(undefined)
  })

  it('marks parent flags missing from monitoring as FIXED', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'dead-link', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([])
    prismaMock.audit.findUnique.mockResolvedValue(childAudit({ reportCompleteness: 'FULL' }))

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = (await prismaMock.$transaction.mock.results[0].value) as Array<{
      data: { status: string; resolvedInId?: string }
    }>
    assert.equal(updates.length, 1)
    assert.equal(updates[0].data.status, 'FIXED')
    assert.equal(updates[0].data.resolvedInId, 'monitoring-audit')
  })

  it('marks page-scoped absences FIXED under PARTIAL when that page is FULL', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'pricing-cta',
          status: 'OPEN',
          pageUrl: 'https://example.com/pricing',
        }),
      ])
      .mockResolvedValueOnce([])
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'FULL' },
        ],
      })
    )

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = (await prismaMock.$transaction.mock.results[0].value) as Array<{
      data: { status: string; resolvedInId?: string }
    }>
    assert.equal(updates.length, 1)
    assert.equal(updates[0].data.status, 'FIXED')
  })

  it('does not mark absences FIXED when the Flag page was not fully re-checked', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'pricing-cta',
          status: 'OPEN',
          pageUrl: 'https://example.com/pricing',
        }),
      ])
      .mockResolvedValueOnce([])
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' },
        ],
      })
    )

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('keeps matched flags OPEN when severity is unchanged', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', severity: 'IMPORTANT', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'Still broken', severity: 'IMPORTANT', status: 'OPEN' }),
      ])

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = (await prismaMock.$transaction.mock.results[0].value) as Array<{
      id: string
      data: { status: string; resolvedInId?: string | null }
    }>
    const parentUpdate = updates.find((u) => u.id === 'p1')
    assert.ok(parentUpdate)
    assert.equal(parentUpdate.data.status, 'OPEN')
    assert.equal(parentUpdate.data.resolvedInId, null)
  })

  it('regresses when monitoring severity increases', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', severity: 'POLISH', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'Now critical', severity: 'CRITICAL', status: 'OPEN' }),
      ])

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = (await prismaMock.$transaction.mock.results[0].value) as Array<{
      data: { status: string }
    }>
    assert.ok(updates.every((u) => u.data.status === 'REGRESSED'))
  })

  it('does not turn a cleared Flag into Product Memory without an Improvement Attempt', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', status: 'OPEN' }),
        flag({ id: 'p2', checkId: 'b', status: 'IGNORED' }),
      ])
      .mockResolvedValueOnce([])

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    expect(mutateProjectIntelligence).not.toHaveBeenCalled()
    expect(appendVerifiedLearning).not.toHaveBeenCalled()
  })

  it('does not append learnings when the parent has no project', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([])
    prismaMock.audit.findUnique.mockResolvedValue(null)

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(mutateProjectIntelligence).not.toHaveBeenCalled()
  })

  it('skips the product contract path when parsing fails', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([])

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(mutateProjectIntelligence).not.toHaveBeenCalled()
  })

  it('surfaces watch persistence errors so the completion projection can retry', async () => {
    notifyWatchRegression.mockRejectedValue(new Error('email down'))
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.audit.findUnique.mockResolvedValue(childAudit())

    await expect(
      diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    ).rejects.toThrow('email down')
    expect(notifyWatchRegression).toHaveBeenCalledWith('parent-audit', 'monitoring-audit')
  })
})
