import { analysisEnvironmentWhere } from '@/lib/sites/application/analysis-scope'
import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import type { FlagStatus, Severity } from '@prisma/client'

const { prismaMock, recoveryProofs } = vi.hoisted(() => ({
  recoveryProofs: vi.fn(),
  prismaMock: {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },
    $queryRaw: vi.fn().mockResolvedValue([]),
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
vi.mock('@/lib/sites/application/incident-proofs', async original => ({ ...await original<typeof import('@/lib/sites/application/incident-proofs')>(),
  loadIncidentRecoveryProofs: recoveryProofs,
}))
beforeEach(() => {
  recoveryProofs.mockResolvedValue(new Map())
  prismaMock.$queryRaw.mockResolvedValue([])
})

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
  readReportComparison,
  diffMatchKey,
  isFoundOnNewlyReviewedPage,
  reviewedPageUrls,
} from '../diff-flags'
import { CHECK_REGISTRY } from '../check-registry'
import { FLAG_COMPARISON_TARGET, comparisonEvidenceComplete } from '../flag-comparison'
import { SECTION_LINK_VERIFICATION_RULE } from '../checks/section-links'
import { TRACKING_VERIFICATION_RULE } from '../tracking/identity'
import { ENGAGEMENT_VERIFICATION_RULE } from '../network-engagement-evidence'
import { ACCESSIBILITY_VERIFICATION_RULE } from '../checks/accessibility-rules'
import { PAGESPEED_LAB_RULE } from '../performance-measurement'
import { searchResourceKey } from '../search/resource-identity'

type FlagRow = {
  id: string
  checkId: string | null
  problem: string
  rubric: string
  severity: Severity
  status: FlagStatus
  resolvedInId?: string | null
  pageUrl?: string | null
  affectedPaths?: unknown
  fingerprint?: string
  supportingObservations?: unknown
  verificationRule?: string
  evidenceTargets?: unknown
  attentionPolicy?: unknown
}

function flag(overrides: Partial<FlagRow>): FlagRow {
  return {
    id: 'flag-1',
    checkId: 'cta-dead-link',
    problem: 'Primary CTA is a dead link',
    rubric: 'EXPERIENCE',
    severity: 'IMPORTANT',
    status: 'OPEN',
    resolvedInId: null,
    pageUrl: null,
    affectedPaths: null,
    ...overrides,
  }
}

function childAudit(overrides: {
  parentId?: string | null
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
    prismaMock.auditVerificationReceipt.upsert.mockReset()
    prismaMock.$transaction.mockImplementation(async fn => fn(prismaMock))
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent', verifierExecutions: [] })
    prismaMock.auditVerificationReceipt.upsert.mockImplementation(async input => ({ status: 'COMPLETED', detail: input.create.detail }))
  })
  it.each(['newIssues', 'unchanged', 'inconclusive', 'fixed'] as const)('retains unavailable source evidence through %s without copying private observations', async bucket => {
    const unreadable = { version: 999, items: [{ evidence: 'Private unavailable source' }] }
    const original = flag({ id: 'before', supportingObservations: unreadable })
    const current = flag({ id: 'after', supportingObservations: unreadable })
    if (bucket === 'inconclusive') prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit({ reportCompleteness: 'PARTIAL' }),
      projectId: 'project-1', parentId: 'parent', verifierExecutions: [] })
    const absent = bucket === 'inconclusive' || bucket === 'fixed'
    prismaMock.flag.findMany.mockResolvedValueOnce(bucket === 'newIssues' ? [] : [original])
      .mockResolvedValueOnce(absent ? [] : [current])
    await persistFlagDiffSummary('parent', 'child')
    const summary = prismaMock.auditVerificationReceipt.upsert.mock.calls[0][0].create.detail.summary
    expect(summary[bucket]).toMatchObject([{ id: absent ? 'before' : 'after', supportingEvidenceUnreadable: true }])
    expect(comparisonEvidenceComplete(summary)).toBe(false)
    expect(JSON.stringify(summary)).not.toContain('Private unavailable source')
    expect(original.supportingObservations).toEqual(unreadable)
  })
  it('retains an unchanged failure after later monitoring resolves or regresses its Flag rows', async () => {
    prismaMock.flag.findMany.mockResolvedValueOnce([flag({ id: 'before' })]).mockResolvedValueOnce([flag({ id: 'after' })])
    await persistFlagDiffSummary('parent', 'child')
    const input = prismaMock.auditVerificationReceipt.upsert.mock.calls[0][0]
    expect(input).toMatchObject({ update: {}, create: { targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product', status: 'COMPLETED' } })
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent',
      verifierExecutions: [{ status: 'COMPLETED', detail: input.create.detail }] })
    prismaMock.flag.findMany.mockRejectedValue(new Error('Later mutable Flag history was read'))
    expect(await getFlagDiffSummary('parent', 'child')).toMatchObject({ unchanged: [{ id: 'after', status: 'OPEN' }], fixed: [], regressed: [] })
    await persistFlagDiffSummary('parent', 'child')
    expect(prismaMock.auditVerificationReceipt.upsert).toHaveBeenCalledTimes(1)
  })
  it('preserves first-run alerts when later recovery changes the underlying Flag status', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: null, verifierExecutions: [] })
    prismaMock.flag.findMany.mockResolvedValue([flag({ id: 'first' })])
    await persistFlagDiffSummary(null, 'child')
    const detail = prismaMock.auditVerificationReceipt.upsert.mock.calls[0][0].create.detail
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
    await expect(readReportComparison('parent', 'child')).resolves.toBeNull()
    expect(prismaMock.flag.findMany).not.toHaveBeenCalled()
  })
  it('does not conceal an unexpected database failure', async () => {
    const failure = new Error('Database unavailable')
    prismaMock.audit.findUnique.mockRejectedValue(failure)
    await expect(readReportComparison('parent', 'child')).rejects.toBe(failure)
  })
  it('requires the completed original parent before recording a comparison', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), status: 'RUNNING', parentId: 'parent' })
    await expect(persistFlagDiffSummary('parent', 'child')).rejects.toThrow(/completed execution/)
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), parentId: 'parent' })
    await expect(persistFlagDiffSummary('different', 'child')).rejects.toThrow(/original parent/)
    expect(prismaMock.auditVerificationReceipt.upsert).not.toHaveBeenCalled()
  })
  it('preserves the first committed comparison when concurrent projection or retry reaches the same ledger key', async () => {
    const original = { kind: 'flag-comparison', version: 1, auditId: 'child', parentAuditId: 'parent',
      summary: { fixed: [], inconclusive: [], unchanged: [{ id: 'original', checkId: 'cta-dead-link', problem: 'Primary CTA is a dead link',
        rubric: 'EXPERIENCE', severity: 'IMPORTANT', status: 'OPEN' }], regressed: [], newIssues: [] } }
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.auditVerificationReceipt.upsert.mockResolvedValue({ status: 'COMPLETED', detail: original })
    await persistFlagDiffSummary('parent', 'child')
    expect(prismaMock.auditVerificationReceipt.upsert.mock.calls[0][0].update).toEqual({})
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'project-1', parentId: 'parent',
      verifierExecutions: [{ status: 'COMPLETED', detail: original }] })
    expect(await getFlagDiffSummary('parent', 'child')).toMatchObject({ unchanged: [{ id: 'original' }] })
  })
  it('preserves anonymous comparison evidence when the same Audit is claimed into an owned Site', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: null, parentId: null, verifierExecutions: [] })
    prismaMock.flag.findMany.mockResolvedValue([flag({ id: 'anonymous-flag' })])
    await persistFlagDiffSummary(null, 'anonymous-audit')
    const detail = prismaMock.auditVerificationReceipt.upsert.mock.calls[0][0].create.detail
    expect(detail).not.toHaveProperty('projectId')
    prismaMock.audit.findUnique.mockResolvedValue({ ...childAudit(), projectId: 'claimed-site', parentId: null,
      verifierExecutions: [{ status: 'COMPLETED', detail }] })
    expect(await getFlagDiffSummary(null, 'anonymous-audit')).toMatchObject({ newIssues: [{ id: 'anonymous-flag' }] })
  })
})

describe('durable diagnostic continuity', () => {
  const pageUrl = 'https://example.com/'
  const isUnresolvedHistory = (query: { where: { audit?: unknown; OR?: unknown; status?: { in?: unknown } } }) =>
    Boolean(query.where.audit && !query.where.OR && query.where.status?.in)
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
  it('retains recovery on the original page when the same check fails on a different page', async () => {
    const original = previous()
    const sibling = previous({ id: 'sibling', pageUrl: 'https://example.com/another' })
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
      : input.where.auditId === 'current-audit' ? [sibling] : [])
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([{ id: 'title-proof', auditId: 'current-audit',
      targetKey: 'check:title-missing', status: 'COMPLETED', detail: {
        kind: 'search-verifier', version: 1, auditId: 'current-audit', pageUrl, checkId: 'title-missing',
        verdict: 'passed', comparable: true, observationIds: ['fresh-title'], reason: 'Original page title is present',
      } }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls).toEqual([[{ where: { id: original.id }, data: { status: 'FIXED', resolvedInId: 'current-audit' } }]])
    const result = await getFlagDiffSummary('gap', 'current-audit')
    expect(result.fixed).toMatchObject([{ id: original.id }])
    expect(result.newIssues).toMatchObject([{ id: sibling.id }])
    expect(result.regressed).toEqual([])
  })
  it.each(['FIXED', 'OPEN'] as const)('uses the nearest history on the original page when it was %s', async status => {
    const earlier = { ...previous({ status: 'FIXED' }), resolvedInId: 'recovery' }
    const nearer = previous({ id: 'nearer-open' })
    const unrelated = previous({ id: 'other-page', pageUrl: 'https://example.com/another' })
    const child = [previous({ id: 'fresh-sibling', pageUrl: unrelated.pageUrl }), previous({ id: 'fresh-original' })]
    recoveryProofs.mockResolvedValue(new Map([['project-1', Object.assign(new Map([
      ['recovery', new Date('2026-10-11T12:00:00Z')],
    ]), { hasFlag: (flag: { id: string }) => flag.id === earlier.id })]]))
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [unrelated]
      : input.where.auditId === 'current-audit' ? child : input.where.OR ? (status === 'OPEN' ? [nearer, earlier] : [earlier]) : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ occurrences: [{ flag: unrelated }] }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls).toEqual(status === 'FIXED'
      ? [[{ where: { id: 'fresh-original' }, data: { status: 'REGRESSED' } }]] : [])
    const result = await getFlagDiffSummary('gap', 'current-audit')
    expect(result.regressed.map(flag => flag.id)).toEqual(status === 'FIXED' ? ['fresh-original'] : [])
    expect(result.unchanged.map(flag => flag.id).sort()).toEqual(status === 'FIXED' ? ['fresh-sibling'] : ['fresh-original', 'fresh-sibling'])
    expect(result.newIssues).toEqual([])
  })
  it.each(['different fragment', 'different capture', 'unscoped history'] as const)('compares section links with %s', async scenario => {
    const target = (capture: string, fragment: string) => ({ context: 'section:v2:' + capture.repeat(64) + ':' + fragment.repeat(64) })
    const link = previous({ checkId: 'broken-page-anchors', verificationRule: SECTION_LINK_VERIFICATION_RULE })
    const original = { ...link, evidenceTargets: scenario === 'unscoped history' ? [] : [target('a', 'b')] }
    const current = { ...link, id: 'new-capture', evidenceTargets: [target('c', scenario === 'different fragment' ? 'd' : 'b')] }
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
      : input.where.auditId === 'current-audit' ? [current] : [])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    if (scenario === 'different fragment') {
      expect(summary.newIssues).toMatchObject([{ id: current.id }])
      expect(summary.inconclusive).toMatchObject([{ id: original.id }])
      expect(summary.unchanged).toEqual([])
    } else {
      expect(summary.newIssues).toEqual([])
      expect(summary.inconclusive).toEqual([])
      expect(summary.unchanged).toMatchObject([{ id: current.id }])
    }
    expect(summary.fixed).toEqual([])
  })
  it.each([
    { description: 'comparable historical tracking capture', originalVersion: 2, currentVersion: 3, request: 'a', same: true },
    { description: 'different tracking request', originalVersion: 4, currentVersion: 4, request: 'd', same: false },
    { description: 'different tracking capture method', originalVersion: 3, currentVersion: 4, request: 'a', same: false },
  ])('compares $description using the verifier request identity', async ({ originalVersion, currentVersion, request, same }) => {
    const target = (version: number, key: string) => ({ context: 'tracking:page_load:vercel:library:example.com/script.js:request:v' + version +
      ':' + key.repeat(64) + ':capture:' + 'b'.repeat(64) + ':page:' + 'c'.repeat(64) })
    const flag = previous({ checkId: 'tracking-library-http-error', verificationRule: TRACKING_VERIFICATION_RULE })
    const original = { ...flag, evidenceTargets: [target(originalVersion, 'a')] }
    const current = { ...flag, id: 'fresh-library', evidenceTargets: [target(currentVersion, request)] }
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
      : input.where.auditId === 'current-audit' ? [current] : [])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.unchanged.map(item => item.id)).toEqual(same ? [current.id] : [])
    expect(summary.newIssues.map(item => item.id)).toEqual(same ? [] : [current.id])
    expect(summary.inconclusive.map(item => item.id)).toEqual(same ? [] : [original.id])
    expect(summary.fixed).toEqual([])
  })
  it('keeps separate engagement request failures on the same page', async () => {
    const target = (key: string) => ({ context: 'engagement:page_load:control:page:request:v2:' + key.repeat(64) +
      ':capture:' + 'b'.repeat(64) + ':page:' + 'c'.repeat(64) })
    const flag = previous({ checkId: 'api-engagement-server-error', verificationRule: ENGAGEMENT_VERIFICATION_RULE })
    const original = { ...flag, evidenceTargets: [target('a')] }
    const current = { ...flag, id: 'new-request', evidenceTargets: [target('d')] }
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
      : input.where.auditId === 'current-audit' ? [current] : [])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.unchanged).toEqual([])
    expect(summary.newIssues).toMatchObject([{ id: current.id }])
    expect(summary.inconclusive).toMatchObject([{ id: original.id }])
  })
  it.each(['same rule on another element', 'different device', 'unavailable historical capture'] as const)(
    'compares Accessibility observations with %s', async scenario => {
      const target = (device: string, capture: string, selector: string) => ({
        context: `accessibility:axe:${device}:${capture}:axe-target-size:4.10.3:target-size:same-origin-v2`, selector,
      })
      const flag = previous({ checkId: 'axe-target-size', verificationRule: ACCESSIBILITY_VERIFICATION_RULE })
      const original = { ...flag, evidenceTargets: [target('desktop', scenario === 'unavailable historical capture' ? 'unknown' : 'a'.repeat(64), '#original')] }
      const current = { ...flag, id: 'fresh-target', evidenceTargets: [scenario === 'different device'
        ? target('mobile', 'b'.repeat(64), '#different') : target('desktop', 'a'.repeat(64), '#different')] }
      prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
        : input.where.auditId === 'current-audit' ? [current] : [])
      const result = await getFlagDiffSummary('gap', 'current-audit')
      const separate = scenario === 'different device'
      expect(result.newIssues.map(item => item.id)).toEqual(separate ? [current.id] : [])
      expect(result.inconclusive.map(item => item.id)).toEqual(separate ? [original.id] : [])
      expect(result.unchanged.map(item => item.id)).toEqual(separate ? [] : [current.id])
      expect(result.fixed).toEqual([])
    }
  )
  it.each([
    { before: 'perf-score-critical', after: 'perf-score-poor', beforeSeverity: 'CRITICAL', afterSeverity: 'IMPORTANT', sameProfile: true, result: 'unchanged' },
    { before: 'perf-score-poor', after: 'perf-score-critical', beforeSeverity: 'IMPORTANT', afterSeverity: 'CRITICAL', sameProfile: true, result: 'regressed' },
    { before: 'perf-score-critical', after: 'perf-score-poor', beforeSeverity: 'CRITICAL', afterSeverity: 'IMPORTANT', sameProfile: false, result: 'newIssues' },
  ] as const)('classifies $before to $after as $result under the recorded lab scope', async scenario => {
    const target = (profile: string) => ({ context: `pagespeed-condition:v1:${'a'.repeat(64)}:${profile.repeat(64)}:lab:score` })
    const initial = previous({ checkId: scenario.before, severity: scenario.beforeSeverity, verificationRule: PAGESPEED_LAB_RULE,
      evidenceTargets: [target('b')] })
    const current = previous({ id: 'new-score', checkId: scenario.after, severity: scenario.afterSeverity,
      verificationRule: PAGESPEED_LAB_RULE, evidenceTargets: [target(scenario.sameProfile ? 'b' : 'c')] })
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [initial]
      : input.where.auditId === 'current-audit' ? [current] : [])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary[scenario.result]).toMatchObject([{ id: current.id }])
    expect(summary.fixed).toEqual([])
  })
  it('uses the closest structured-property failure after a gap instead of an older repair', async () => {
    const scoped = (id: string, properties: string[]) => previous({ id, checkId: 'search-structured-feature', attentionPolicy: {
      policy: 'search', version: 5, kind: 'flag', reason: 'invalid property', pageScopes: [{ pageUrl, reason: 'invalid property',
        markupTargets: [{ entityId: 'product', entityType: 'Product', source: 'rendered-dom', properties }] }],
    } })
    const parent = scoped('latest-url', ['url'])
    const earlier = { ...scoped('old-price', ['price']), status: 'FIXED' as const, resolvedInId: 'recovery' }
    const unscoped = { ...earlier, id: 'legacy-without-property', attentionPolicy: undefined }
    const unresolved = scoped('more-recent-price', ['price'])
    const current = scoped('grouped-current', ['url', 'price'])
    recoveryProofs.mockResolvedValue(new Map([['project-1', Object.assign(new Map([
      ['recovery', new Date('2026-10-11T12:00:00Z')],
    ]), { hasFlag: (flag: { id: string }) => [earlier.id, unscoped.id].includes(flag.id) })]]))
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [parent]
      : input.where.auditId === 'current-audit' ? [current] : input.where.OR ? [unscoped, unresolved, earlier]
        : input.where.status === 'FIXED' && input.where.resolvedInId?.not === null ? [earlier] : [])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update).not.toHaveBeenCalled()
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(summary.unchanged).toMatchObject([{ id: current.id }])
    expect(summary.regressed).toEqual([])
    expect(summary.newIssues).toEqual([])
    expect(prismaMock.flag.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      status: { in: ['OPEN', 'REGRESSED', 'FIXED'] }, OR: expect.arrayContaining([{ pageUrl: { in: expect.arrayContaining([pageUrl]) } }]),
    }) }))
  })
  it.each(['keyed', 'legacy'])('reports a newly blocked crawl hop alongside a continuing %s failure', async prior => {
    const scope = (resourceKeys: string[]) => ({ policy: 'search', version: 2, kind: 'flag', reason: 'crawl_policy_regressed',
      pageScopes: [{ pageUrl, reason: 'crawl_policy_regressed', sources: ['robots-txt'], resourceKeys }] })
    const initial = searchResourceKey(pageUrl)
    const original = previous({ checkId: 'search-crawl-access', attentionPolicy: prior === 'keyed' ? scope([initial]) : undefined })
    const current = previous({ id: 'expanded', checkId: 'search-crawl-access', attentionPolicy: scope([initial, 'b'.repeat(64)]) })
    prismaMock.flag.findMany.mockImplementation(async input => input.where.auditId === 'gap' ? [original]
      : input.where.auditId === 'current-audit' ? [current] : [])
    const result = await getFlagDiffSummary('gap', 'current-audit')
    expect(result.newIssues).toMatchObject([{ id: current.id }])
    expect(result.unchanged).toEqual([])
    expect(result.regressed).toEqual([])
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
    prismaMock.flag.findMany.mockImplementation(async query => query.where.auditId === 'gap' || isUnresolvedHistory(query) ? [other] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'other-improvement', occurrences: [{ flag: other }], attempts: [] }])
    expect(Object.values(await getFlagDiffSummary('gap', 'current-audit')).flat()).toEqual([])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update).not.toHaveBeenCalled()
  })
  it('marks recurrence while preserving the original completed recovery', async () => {
    recoveryProofs.mockResolvedValue(new Map([['project-1', Object.assign(new Map([
      ['recovery', new Date('2026-10-11T12:00:00Z')], ['independent-repair', new Date('2026-10-11T12:00:00Z')],
    ]), { hasFlag: (flag: { id: string }) => flag.id === 'original' })]]))
    prismaMock.flag.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([previous({ id: 'current' })])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: { ...previous({ status: 'FIXED' }), resolvedInId: 'recovery' } }], attempts: [] }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls).toEqual([[{ where: { id: 'current' }, data: { status: 'REGRESSED' } }]])
  })
  it('reads historical and targeted incident history when the first broad run has no parent', async () => {
    recoveryProofs.mockResolvedValue(new Map([['project-1', Object.assign(new Map([
      ['recovery', new Date('2026-10-11T12:00:00Z')], ['independent-repair', new Date('2026-10-11T12:00:00Z')],
    ]), { hasFlag: (flag: { id: string }) => flag.id === 'original' })]]))
    const child = prismaMock.audit.findUnique.getMockImplementation()!
    prismaMock.audit.findUnique.mockImplementation(async () => ({ ...await child(), parentId: null }))
    prismaMock.flag.findMany.mockResolvedValueOnce([previous({ id: 'current' })]).mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{
      flag: { ...previous({ status: 'FIXED' }), resolvedInId: 'independent-repair' },
    }], attempts: [] }])
    await diffFlagsAgainstParent('current-audit', null)
    expect(prismaMock.flag.update.mock.calls).toEqual([[{ where: { id: 'current' }, data: { status: 'REGRESSED' } }]])
    const query = prismaMock.improvement.findMany.mock.calls[0][0]
    const history = query.select.occurrences.where.audit
    expect(history).toMatchObject({ projectId: 'project-1', id: { not: 'current-audit' }, status: 'COMPLETED',
      createdAt: { lt: new Date('2026-10-12T12:00:00Z') } })
    expect(history.AND[0]).toEqual({ OR: [
      { executionSpec: { path: ['scope'], equals: expect.anything() } },
      { NOT: { executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } } },
    ] })
    expect(history.AND[1]).toEqual(analysisEnvironmentWhere('production'))
    const unresolved = prismaMock.flag.findMany.mock.calls.find(([input]) => isUnresolvedHistory(input))?.[0]
    expect(unresolved.where.audit).toEqual(history)
  })
  it('does not repeat an old recovery on healthy monitoring runs', async () => {
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: { ...previous({ status: 'FIXED' }), resolvedInId: 'recovery' } }], attempts: [] }])
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    expect(Object.values(summary).flat()).toEqual([])
  })
  it('closes an older pending fix only with its own positive scoped evidence', async () => {
    prismaMock.flag.findMany.mockImplementation(async input => isUnresolvedHistory(input) ? [previous()] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ occurrences: [{ flag: previous({ id: 'latest' }) }] }])
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([{ id: 'title-proof', auditId: 'current-audit', targetKey: 'check:title-missing', status: 'COMPLETED', detail: {
      kind: 'search-verifier', version: 1, auditId: 'current-audit', pageUrl, checkId: 'title-missing', verdict: 'passed', comparable: true,
      observationIds: ['fresh-title'], reason: 'Fresh original and rendered title',
    } }])
    await diffFlagsAgainstParent('current-audit', 'gap')
    expect(prismaMock.flag.update.mock.calls.map(call => call[0])).toEqual([
      { where: { id: 'latest' }, data: { status: 'FIXED', resolvedInId: 'current-audit' } },
      { where: { id: 'original' }, data: { status: 'FIXED', resolvedInId: 'current-audit' } },
    ])
  })
  it.each(['passed', 'failed', 'missing'] as const)('reads recovery evidence beyond the first batch and preserves %s evidence', async verdict => {
    const original = previous()
    prismaMock.flag.findMany.mockImplementation(async input => isUnresolvedHistory(input) ? [original] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: original }], attempts: [] }])
    const proof = (result: 'passed' | 'failed') => ({
      kind: 'search-verifier', version: 1, auditId: 'current-audit', pageUrl, checkId: 'title-missing', verdict: result, comparable: true,
      observationIds: ['fresh-title'], reason: 'Fresh original and rendered title',
    })
    const rows = Array.from({ length: 1201 }, (_, index) => ({
      id: String(index).padStart(5, '0'), auditId: 'current-audit', targetKey: 'check:title-missing', status: 'COMPLETED', detail: {} as unknown,
    }))
    if (verdict !== 'missing') rows[1200].detail = proof(verdict)
    if (verdict === 'failed') rows[0].detail = proof('passed')
    prismaMock.auditVerifierExecution.findMany.mockImplementation(async input =>
      rows.filter(row => !input.where.id || row.id > input.where.id.gt).slice(0, input.take))

    await diffFlagsAgainstParent('current-audit', 'gap')
    const summary = await getFlagDiffSummary('gap', 'current-audit')
    if (verdict === 'passed') {
      expect(prismaMock.flag.update).toHaveBeenCalledWith({ where: { id: original.id }, data: { status: 'FIXED', resolvedInId: 'current-audit' } })
      expect(summary.fixed.map(flag => flag.id)).toEqual([original.id])
    } else {
      expect(prismaMock.flag.update).not.toHaveBeenCalled()
      expect(summary.fixed).toEqual([])
      expect(summary.inconclusive.map(flag => flag.id)).toEqual([original.id])
    }
    const reads = prismaMock.auditVerifierExecution.findMany.mock.calls.map(([input]) => input)
    expect(reads.filter(input => input.where.id?.gt === '01023')).toHaveLength(2)
    for (const input of reads) {
      expect(input).toMatchObject({ where: { status: 'COMPLETED', OR: [{ auditId: 'current-audit', targetKey: { in: expect.arrayContaining(['check:title-missing']) } }] },
        take: 512, orderBy: { id: 'asc' } })
      expect(input.select).toEqual({ id: true, auditId: true, targetKey: true, status: true, pageUrl: true, detail: true,
        task: { select: { id: true, pageUrl: true } } })
    }
  })
  it('checks unacted older conditions and never summarizes a partially recovered responsibility as fixed', async () => {
    const latest = previous({ id: 'latest' })
    const samePage = previous({ id: 'older-same-page' })
    const otherPage = previous({ id: 'older-other-page', pageUrl: 'https://example.com/original' })
    prismaMock.flag.findMany.mockImplementation(async input => isUnresolvedHistory(input) ? [samePage, otherPage] : [])
    prismaMock.improvement.findMany.mockResolvedValue([{ id: 'improvement', occurrences: [{ flag: latest }], attempts: [] }])
    prismaMock.auditVerifierExecution.findMany.mockResolvedValue([{ id: 'title-proof', auditId: 'current-audit', targetKey: 'check:title-missing', status: 'COMPLETED', detail: {
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
    prismaMock.flag.update.mockReset()
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
      ['b']
    )
    assert.deepEqual(
      summary.fixed.map((i) => i.id).sort(),
      ['p2']
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

  it.each([
    { observed: 'https://example.com/pricing/', fixed: true },
    { observed: 'https://example.com/pricing', fixed: false },
  ])('requires the exact Flag resource despite optional PageSpeed gaps: $observed', async ({ observed, fixed }) => {
    prismaMock.audit.findUnique.mockResolvedValue(
      childAudit({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: observed, status: 'COMPLETED', completeness: 'PARTIAL' },
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
    expect(summary.fixed).toHaveLength(fixed ? 1 : 0)
    expect(summary.inconclusive).toHaveLength(fixed ? 0 : 1)
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
  const recordedChild = (overrides: Parameters<typeof childAudit>[0] = {}) =>
    childAudit({ parentId: 'parent-audit', ...overrides })

  beforeEach(() => {
    prismaMock.flag.findMany.mockReset()
    prismaMock.flag.update.mockReset()
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.findUnique.mockResolvedValue(recordedChild())
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

  it.each(['recovery', 'severity'] as const)('retains every page condition when %s establishes a regression', async cause => {
    const ordinary = flag({ id: 'ordinary', checkId: 'cta-dead-link::page:1', severity: 'IMPORTANT' })
    const regressing = flag({ id: 'regressing', checkId: 'cta-dead-link::page:2',
      status: cause === 'recovery' ? 'FIXED' : 'OPEN', severity: cause === 'severity' ? 'POLISH' : 'IMPORTANT' })
    const current = flag({ id: 'current', checkId: 'cta-dead-link', severity: 'IMPORTANT' })
    for (const parents of [[ordinary, regressing], [regressing, ordinary]]) {
      prismaMock.flag.update.mockClear()
      prismaMock.flag.findMany.mockResolvedValueOnce(parents).mockResolvedValueOnce([current])
      await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
      expect(prismaMock.flag.update.mock.calls.filter(([input]) => input.where.id === current.id))
        .toEqual([[{ where: { id: current.id }, data: { status: 'REGRESSED' } }]])
      prismaMock.flag.findMany.mockResolvedValueOnce(parents).mockResolvedValueOnce([current])
      const summary = await getFlagDiffSummary('parent-audit', 'monitoring-audit')
      expect(summary.regressed).toMatchObject([{ id: current.id, status: 'REGRESSED' }])
      expect(summary.unchanged).toEqual([])
    }
  })

  it('marks parent flags missing from monitoring as FIXED', async () => {
    prismaMock.flag.findMany
      .mockResolvedValueOnce([
        flag({ id: 'p1', checkId: 'dead-link', status: 'OPEN' }),
      ])
      .mockResolvedValueOnce([])
    prismaMock.audit.findUnique.mockResolvedValue(recordedChild({ reportCompleteness: 'FULL' }))

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = prismaMock.flag.update.mock.calls.map(([input]) => input)
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
      recordedChild({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/pricing', status: 'COMPLETED', completeness: 'PARTIAL' },
        ],
      })
    )

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    const updates = prismaMock.flag.update.mock.calls.map(([input]) => input)
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
      recordedChild({
        reportCompleteness: 'PARTIAL',
        pages: [
          { url: 'https://example.com/', status: 'COMPLETED', completeness: 'FULL' },
        ],
      })
    )

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')

    expect(prismaMock.flag.update).not.toHaveBeenCalled()
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

    expect(prismaMock.flag.update).not.toHaveBeenCalled()
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

    const updates = prismaMock.flag.update.mock.calls.map(([input]) => input)
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

    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(notifyWatchRegression).not.toHaveBeenCalled()
  })

  it('leaves bound incident state with the assessment projection during a broad comparison', async () => {
    prismaMock.flag.update.mockClear()
    const before = flag({ id: 'bound-before', checkId: 'outcome-availability-failed', status: 'FIXED', fingerprint: 'outcome:v1:availability:http' })
    const after = flag({ ...before, id: 'bound-after', status: 'OPEN' })
    prismaMock.flag.findMany.mockResolvedValueOnce([before]).mockResolvedValueOnce([after])
    await diffFlagsAgainstParent('monitoring-audit', 'parent-audit')
    expect(prismaMock.flag.update).not.toHaveBeenCalled()
  })
})
