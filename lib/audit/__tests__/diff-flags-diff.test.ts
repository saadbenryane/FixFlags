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
}

function flag(overrides: Partial<FlagRow>): FlagRow {
  return {
    id: 'flag-1',
    checkId: 'cta-dead-link',
    problem: 'Primary CTA is a dead link',
    rubric: 'EXPERIENCE',
    severity: 'IMPORTANT',
    status: 'OPEN',
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
    prismaMock.audit.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      reportCompleteness: 'FULL',
    })
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

    // p1 matches m1 with same severity: unchanged
    assert.deepEqual(
      summary.unchanged.map((i) => i.checkId),
      ['a']
    )
    // p2 and p3 (FIXED parent, no monitoring match) land in the fixed bucket
    assert.deepEqual(
      summary.fixed.map((i) => i.checkId).sort(),
      ['b', 'c']
    )
    // m2 has no parent: new issue
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

  it('does not call a missing Flag fixed when the update Review is partial', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      reportCompleteness: 'PARTIAL',
    })
    prismaMock.flag.findMany
      .mockResolvedValueOnce([flag({ id: 'p1', checkId: 'a', status: 'OPEN' })])
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
    prismaMock.audit.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      reportCompleteness: 'FULL',
    })
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
    prismaMock.audit.findUnique.mockResolvedValue({
      projectId: 'proj-1',
      status: 'COMPLETED',
      reportCompleteness: 'FULL',
    })

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = (await prismaMock.$transaction.mock.results[0].value) as Array<{
      data: { status: string; resolvedInId?: string }
    }>
    assert.equal(updates.length, 1)
    assert.equal(updates[0].data.status, 'FIXED')
    assert.equal(updates[0].data.resolvedInId, 'monitoring-audit')
  })

  it('keeps matched flags OPEN when severity is unchanged', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'a', severity: 'IMPORTANT', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([
        flag({ id: 'm1', checkId: 'a', problem: 'Still broken', severity: 'IMPORTANT', status: 'OPEN' }),
      ])
    prismaMock.audit.findUnique.mockResolvedValue({ projectId: 'proj-1' })

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
    prismaMock.audit.findUnique.mockResolvedValue({ projectId: 'proj-1' })

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
    prismaMock.audit.findUnique
      .mockResolvedValueOnce({ projectId: 'proj-1' })
      .mockResolvedValueOnce({ productContract: { name: 'Example' } })

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
    prismaMock.audit.findUnique.mockResolvedValue({ projectId: 'proj-1', productContract: null })

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(mutateProjectIntelligence).not.toHaveBeenCalled()
  })

  it('surfaces watch persistence errors so the completion projection can retry', async () => {
    notifyWatchRegression.mockRejectedValue(new Error('email down'))
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.audit.findUnique.mockResolvedValue({ projectId: null })

    await expect(
      diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    ).rejects.toThrow('email down')
    expect(notifyWatchRegression).toHaveBeenCalledWith('parent-audit', 'monitoring-audit')
  })
})
