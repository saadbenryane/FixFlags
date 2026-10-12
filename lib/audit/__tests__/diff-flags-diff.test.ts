import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import type { FlagStatus, Severity } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    flag: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    audit: {
      findUnique: vi.fn(),
    },
    improvement: { findMany: vi.fn() },
    auditVerifierExecution: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
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
  persistFlagDiffSummary,
  diffMatchKey,
  isFoundOnNewlyReviewedPage,
  reviewedPageUrls,
} from '../diff-flags'
import { CHECK_REGISTRY } from '../check-registry'
import { FLAG_COMPARISON_TARGET } from '../flag-comparison'

type FlagRow = {
  id: string
  checkId: string | null
  problem: string
  rubric: string
  severity: Severity
  status: FlagStatus
  pageUrl?: string | null
  affectedPaths?: unknown
  fingerprint?: string
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

describe('completed comparison facts', () => {
  beforeEach(() => {
    prismaMock.flag.findMany.mockReset()
    prismaMock.audit.findUnique.mockReset()
    prismaMock.auditVerifierExecution.upsert.mockReset()
    prismaMock.$transaction.mockImplementation(async fn => fn(prismaMock))
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent', verifierExecutions: [] })
    prismaMock.auditVerifierExecution.upsert.mockImplementation(async input => ({ status: 'COMPLETED', detail: input.create.detail }))
  })
  it('retains an unchanged failure after later monitoring resolves or regresses its Flag rows', async () => {
    prismaMock.flag.findMany.mockResolvedValueOnce([flag({ id: 'before' })]).mockResolvedValueOnce([flag({ id: 'after' })])
    await persistFlagDiffSummary('parent', 'child')
    const input = prismaMock.auditVerifierExecution.upsert.mock.calls[0][0]
    expect(input).toMatchObject({ update: {}, create: { targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product', status: 'COMPLETED' } })
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent',
      verifierExecutions: [{ status: 'COMPLETED', detail: input.create.detail }] })
    prismaMock.flag.findMany.mockRejectedValue(new Error('Later mutable Flag history was read'))
    expect(await getFlagDiffSummary('parent', 'child')).toMatchObject({ unchanged: [{ id: 'after', status: 'OPEN' }], fixed: [], regressed: [] })
    await persistFlagDiffSummary('parent', 'child')
    expect(prismaMock.auditVerifierExecution.upsert).toHaveBeenCalledTimes(1)
  })
  it('preserves first-run alerts when later recovery changes the underlying Flag status', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: null, verifierExecutions: [] })
    prismaMock.flag.findMany.mockResolvedValue([flag({ id: 'first' })])
    await persistFlagDiffSummary(null, 'child')
    const detail = prismaMock.auditVerifierExecution.upsert.mock.calls[0][0].create.detail
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: null,
      verifierExecutions: [{ status: 'COMPLETED', detail }] })
    prismaMock.flag.findMany.mockResolvedValue([flag({ id: 'first', status: 'FIXED' })])
    expect(await getFlagDiffSummary(null, 'child')).toMatchObject({ newIssues: [{ id: 'first', status: 'OPEN' }], fixed: [] })
  })
  it.each(['wrong-audit', 'wrong-parent', 'incomplete', 'invalid'] as const)('refuses an unrelated or incomplete comparison instead of rebuilding historical success: %s', async scenario => {
    const detail = { kind: 'flag-comparison', version: scenario === 'invalid' ? 2 : 1, auditId: scenario === 'wrong-audit' ? 'other' : 'child',
      parentAuditId: scenario === 'wrong-parent' ? 'other' : 'parent',
      summary: { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [] } }
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent',
      verifierExecutions: [{ status: scenario === 'incomplete' ? 'PENDING' : 'COMPLETED', detail }] })
    await expect(getFlagDiffSummary('parent', 'child')).rejects.toThrow(/comparison/)
    expect(prismaMock.flag.findMany).not.toHaveBeenCalled()
  })
  it('requires the completed original parent before recording a comparison', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), status: 'RUNNING', parentId: 'parent' })
    await expect(persistFlagDiffSummary('parent', 'child')).rejects.toThrow(/completed execution/)
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), parentId: 'parent' })
    await expect(persistFlagDiffSummary('different', 'child')).rejects.toThrow(/original parent/)
    expect(prismaMock.auditVerifierExecution.upsert).not.toHaveBeenCalled()
  })
  it('preserves the first committed comparison when concurrent projection or retry reaches the same ledger key', async () => {
    const original = { kind: 'flag-comparison', version: 1, auditId: 'child', parentAuditId: 'parent',
      summary: { fixed: [], inconclusive: [], unchanged: [{ id: 'original', checkId: 'cta-dead-link', problem: 'Primary CTA is a dead link',
        rubric: 'EXPERIENCE', severity: 'IMPORTANT', status: 'OPEN' }], regressed: [], newIssues: [] } }
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.auditVerifierExecution.upsert.mockResolvedValue({ status: 'COMPLETED', detail: original })
    await persistFlagDiffSummary('parent', 'child')
    expect(prismaMock.auditVerifierExecution.upsert.mock.calls[0][0].update).toEqual({})
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent',
      verifierExecutions: [{ status: 'COMPLETED', detail: original }] })
    expect(await getFlagDiffSummary('parent', 'child')).toMatchObject({ unchanged: [{ id: 'original' }] })
  })
  it('preserves anonymous comparison evidence when the same Audit is claimed into an owned Site', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: null, parentId: null, verifierExecutions: [] })
    prismaMock.flag.findMany.mockResolvedValue([flag({ id: 'anonymous-flag' })])
    await persistFlagDiffSummary(null, 'anonymous-audit')
    const detail = prismaMock.auditVerifierExecution.upsert.mock.calls[0][0].create.detail
    expect(detail).not.toHaveProperty('projectId')
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'claimed-site', parentId: null,
      verifierExecutions: [{ status: 'COMPLETED', detail }] })
    expect(await getFlagDiffSummary(null, 'anonymous-audit')).toMatchObject({ newIssues: [{ id: 'anonymous-flag' }] })
  })
})

describe('durable diagnostic continuity', () => {
  const pageUrl = 'https://example.com/'
  beforeEach(() => {
    prismaMock.flag.findMany.mockReset().mockResolvedValue([])
    prismaMock.flag.update.mockReset()
    prismaMock.audit.findUnique.mockReset()
    prismaMock.improvement.findMany.mockReset()
    prismaMock.auditVerifierExecution.findMany.mockReset()
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([])
    prismaMock.$transaction.mockImplementation(async fn => fn(prismaMock))
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'gap', createdAt: new Date('2026-10-12T12:00:00Z'),
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'title-missing': CHECK_REGISTRY['title-missing'].version }, outcomes: [], verificationTarget: null } })
  })
  function previous(overrides: Partial<FlagRow> = {}) {
    return { ...flag({ id: 'original', checkId: 'title-missing', pageUrl, ...overrides }), resolvedInId: null }
  }
  it('keeps an existing failure unchanged after an inconclusive report', async () => {
    prismaMock.flag.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([previous({ id: 'current' })])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: previous() }], attempts: [] }])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.unchanged.map(flag => flag.id)).toEqual(['current'])
    expect(summary.newIssues).toEqual([])
    expect(prismaMock.improvement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project-1', outcomeId: null } }))
  })
  it('keeps missing responsibility evidence inconclusive across a gap', async () => {
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: previous() }], attempts: [] }])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.inconclusive.map(flag => flag.id)).toEqual(['original'])
    expect(summary.fixed).toEqual([])
  })
  it('excludes an unadmitted historical page from a category receipt without resolving its Flag', async () => {
    const other = previous({ id: 'outside-selection', pageUrl: 'https://example.com/old-page' })
    const audit = { ...childAudit(), projectId: 'project-1', parentId: 'gap', createdAt: new Date('2026-10-12T12:00:00Z'),
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'CATEGORY',
        category: { area: 'search', sourceAuditId: 'gap', pages: [pageUrl] },
        checks: { 'title-missing': CHECK_REGISTRY['title-missing'].version }, outcomes: [], verificationTarget: null } }
    prismaMock.audit.findUnique.mockResolvedValue(audit)
    prismaMock.flag.findMany.mockImplementation(async query => query.where.auditId === 'gap' || query.where.improvementOccurrence ? [other] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'other-improvement', occurrences: [{ flag: other }], attempts: [] }])
    expect(Object.values(await getFlagDiffSummary('gap', 'current-audit')).flat()).toEqual([])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update).not.toHaveBeenCalled()
  })
  it('marks recurrence while preserving the original completed recovery', async () => {
    prismaMock.flag.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([previous({ id: 'current' })])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: { ...previous({ status: 'FIXED' }), resolvedInId: 'recovery' } }], attempts: [] }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls).toEqual([[{ where: { id: 'current' }, data: { status: 'REGRESSED' } }]])
  })
  it('does not repeat an old recovery on healthy monitoring runs', async () => {
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: { ...previous({ status: 'FIXED' }), resolvedInId: 'recovery' } }], attempts: [] }])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(Object.values(summary).flat()).toEqual([])
  })
  it('closes an older pending fix only with its own positive scoped evidence', async () => {
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: previous({ id: 'latest' }) }],
      attempts: [{ sourceAudit: { improvementOccurrences: [{ improvementId: 'improvement', flag: previous() }] } }] }])
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([{ targetKey: 'check:title-missing', status: 'COMPLETED', detail: {
      kind: 'search-verifier', version: 1, auditId: 'current-audit', pageUrl, checkId: 'title-missing', verdict: 'passed', comparable: true,
      observationIds: ['fresh-title'], reason: 'Fresh original and rendered title',
    } }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls.map(call => call[0])).toEqual([
      { where: { id: 'latest' }, data: { status: 'FIXED', resolvedInId: 'current-audit' } },
      { where: { id: 'original' }, data: { status: 'FIXED', resolvedInId: 'current-audit' } },
    ])
  })
  it('checks unacted older conditions and never summarizes a partially recovered responsibility as fixed', async () => {
    const latest = previous({ id: 'latest' })
    const samePage = previous({ id: 'older-same-page' })
    const otherPage = previous({ id: 'older-other-page', pageUrl: 'https://example.com/original' })
    prismaMock.flag.findMany.mockImplementation(async input => input.where.improvementOccurrence ? [samePage, otherPage] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: latest }], attempts: [] }])
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([{ targetKey: 'check:title-missing', status: 'COMPLETED', detail: {
      kind: 'search-verifier', version: 1, auditId: 'current-audit', pageUrl, checkId: 'title-missing', verdict: 'passed', comparable: true,
      observationIds: ['fresh-title'], reason: 'Fresh original and rendered title',
    } }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls.map(call => call[0].where.id)).toEqual(['latest', 'older-same-page'])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.fixed).toEqual([])
    expect(summary.inconclusive).toMatchObject([{ id: 'older-other-page', pageUrl: 'https://example.com/original' }])
  })
})

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

  it('collapses journey aliases onto one durable check', () => {
    assert.equal(
      diffMatchKey({
        checkId: 'journey-signup-hidden-cta',
        problem: 'No obvious primary CTA',
        rubric: 'EXPERIENCE',
      }),
      diffMatchKey({
        checkId: 'journey-pricing-evaluation-hidden-cta',
        problem: 'Primary action is hard to find',
        rubric: 'EXPERIENCE',
      })
    )
  })

  it('matches restated AI Flags through the stored identity', () => {
    const stored = diffMatchKey({
      checkId: null,
      problem: 'Headline is vague',
      rubric: 'MESSAGE',
    })
    assert.equal(
      diffMatchKey({
        checkId: null,
        problem: 'Hero title still does not name the offer',
        rubric: 'MESSAGE',
        fingerprint: stored,
      }),
      stored
    )
  })
})

describe('isFoundOnNewlyReviewedPage', () => {
  it('does not treat a trailing-slash variant as a new page', () => {
    const parentReviewedUrls = reviewedPageUrls({
      pages: [{ url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' }],
      flags: [],
    })
    assert.equal(
      isFoundOnNewlyReviewedPage({
        pageUrl: 'https://example.com',
        parentReviewedUrls,
      }),
      false
    )
  })

  it('marks a path the parent never reviewed as new', () => {
    const parentReviewedUrls = reviewedPageUrls({
      pages: [{ url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' }],
      flags: [],
    })
    assert.equal(
      isFoundOnNewlyReviewedPage({
        pageUrl: 'https://example.com/pricing',
        parentReviewedUrls,
      }),
      true
    )
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
      summary.fixed.map((i) => i.id).sort(),
      ['p2', 'p3']
    )
    assert.deepEqual(
      summary.newIssues.map((i) => i.checkId),
      ['d']
    )
    assert.deepEqual(summary.newIssues.map((i) => i.id), ['m2'])
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

  it('treats first-Watch observations as new without inventing recoveries or losing confidence', async () => {
    prismaMock.flag.findMany.mockResolvedValue([{ ...flag({ id: 'new-checkout', severity: 'CRITICAL' }), confidence: 0.95, impactTag: 'REVENUE' }])
    const summary = await getFlagDiffSummary(null, 'first-watch')
    expect(summary.fixed).toEqual([])
    expect(summary.newIssues).toEqual([expect.objectContaining({ id: 'new-checkout', confidence: 0.95, impactTag: 'REVENUE' })])
    expect(prismaMock.flag.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.audit.findUnique).toHaveBeenCalledTimes(1)
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

  it('credits Fixed when the Flag page was captured even without PageSpeed FULL', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'PARTIAL' },
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

  it('credits Fixed for historical PARTIAL page status when the page was run', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'PARTIAL', completeness: 'PARTIAL' },
        ],
      })
    )
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({
          id: 'p1',
          checkId: 'home-cta',
          status: 'OPEN',
          pageUrl: 'https://example.com/',
        }),
      ])
      .mockResolvedValueOnce([])

    const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
    expect(summary.fixed).toHaveLength(1)
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

  it('keeps multi-path absences inconclusive when one affected page failed', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'COMPLETED', completeness: 'PARTIAL' },
          { url: 'https://example.com/pricing', status: 'FAILED', completeness: 'PARTIAL' },
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
    prismaMock.$transaction.mockImplementation(async (work: unknown) => typeof work === 'function'
      ? work(prismaMock) : Promise.all(work as Promise<unknown>[]))
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

  it('marks page-scoped absences FIXED under PARTIAL when that page was captured', async () => {
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
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'PARTIAL' },
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

  it('keeps notification delivery outside diagnostic comparison', async () => {
    notifyWatchRegression.mockRejectedValue(new Error('email down'))
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.audit.findUnique.mockResolvedValue(childAudit())

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(notifyWatchRegression).not.toHaveBeenCalled()
  })

  it('leaves bound incident state with the assessment projection during a broad comparison', async () => {
    prismaMock.flag.update.mockClear()
    const before = flag({ id: 'bound-before', checkId: 'outcome-availability-failed', status: 'FIXED', fingerprint: 'outcome:v1:availability:http' })
    const after = flag({ ...before, id: 'bound-after', status: 'OPEN' })
    prismaMock.flag.findMany.mockResolvedValueOnce([before]).mockResolvedValueOnce([after])
    prismaMock.audit.findUnique.mockResolvedValue(childAudit())
    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(prismaMock.flag.update).not.toHaveBeenCalled()
  })
})
