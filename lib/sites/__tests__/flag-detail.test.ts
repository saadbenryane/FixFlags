import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { beforeEach, expect, it, vi } from 'vitest'
import type { SiteRecord } from '../types'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'
import { buildSiteRepairHandoff } from '../repair-brief'
const mocks = vi.hoisted(() => ({ flag: vi.fn(), attempts: vi.fn(), occurrences: vi.fn(), outcome: vi.fn(), proofs: vi.fn(), current: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: async () => ({ id: 'owned' }) },
  flag: { findFirst: mocks.flag, findMany: async (query: { select?: { improvementOccurrence?: { select?: { createdAt?: boolean } } }; where?: { id?: { in: string[] } } }) => {
    const rows = await mocks.occurrences(query)
    if (query.select?.improvementOccurrence?.select?.createdAt) return rows.map((row: { createdAt: Date; flag: object }) => ({ ...row.flag,
      audit: { projectId: 'project-1' }, improvementOccurrence: { improvementId: 'improvement-1', createdAt: row.createdAt } }))
    return rows.map((row: { flag: { id: string } }) => row.flag).filter((flag: { id: string }) => !query.where?.id || query.where.id.in.includes(flag.id))
  } }, improvementAttempt: { findMany: mocks.attempts },
  improvementOccurrence: { findMany: mocks.occurrences }, siteOutcome: { findFirst: mocks.outcome },
  audit: { findMany: mocks.proofs }, $queryRaw: mocks.current,
  auditVerificationReceipt: { findMany: async () => (await mocks.proofs()).flatMap((audit: { id: string; verifierExecutions?: object[] }) =>
    (audit.verifierExecutions ?? []).map((receipt, index) => ({ ...receipt, id: audit.id + ':receipt:' + index, auditId: audit.id }))) },
} }))
import { loadSiteFlagDetail } from '../flags'
const site = { siteId: 'site-1', projectId: 'project-1', userId: 'owner' } as SiteRecord
beforeEach(() => {
  vi.resetAllMocks()
  mocks.flag.mockResolvedValue({ id: 'captured-flag', auditId: 'audit-1', checkId: 'journey-checkout-failed-http_error', rubric: 'EXPERIENCE', severity: 'CRITICAL', impactTag: 'REVENUE', problem: 'Checkout is unavailable', evidence: 'Two failed checks', whyItMatters: 'Checkout cannot open', fix: 'Restore checkout', pageUrl: 'https://shop.test/checkout', status: 'OPEN', resolvedInId: null, confidence: 0.95, improvementOccurrence: { improvement: { id: 'improvement-1', status: 'PROPOSED', outcomeId: 'outcome-1' } } })
  mocks.attempts.mockResolvedValue([]); mocks.occurrences.mockResolvedValue([])
  mocks.proofs.mockResolvedValue([])
  mocks.current.mockResolvedValue([])
  mocks.outcome.mockResolvedValue({ id: 'outcome-1', name: 'Checkout', expectation: 'A customer can reach checkout from the product page.' })
})
function currentRow(attempt: { createdAt: Date; sourceFlagIds?: string[]; handoffReference?: string | null;
  verificationAudit: { createdAt?: Date; completedAt?: Date } } & Record<string, unknown>) {
  return { flagId: 'captured-flag', ...attempt, ...attempt.verificationAudit,
    createdAt: attempt.verificationAudit.createdAt ?? attempt.createdAt, completedAt: attempt.verificationAudit.completedAt ?? null,
    sourceFlagIds: attempt.sourceFlagIds ?? [], handoffReference: attempt.handoffReference ?? null, finalizeState: null }
}
it('preserves the captured Flag identity while projecting its durable Improvement', async () => {
  const detail = await loadSiteFlagDetail(site, 'improvement-1')
  expect(detail).toMatchObject({ id: 'improvement-1', sourceFlagId: 'captured-flag', sourceAuditId: 'audit-1', confidence: 0.95 })
})
it('projects the latest unsuccessful admitted verification without confusing a copied task with a check', async () => {
  const captured = await mocks.flag()
  mocks.attempts.mockResolvedValue([
    { id: 'copied', createdAt: new Date('2026-11-03T01:00:00Z'), outcome: null, sourceAuditId: captured.auditId,
      sourceFlagIds: [captured.id], verificationAuditId: null, verificationAudit: null },
    { id: 'checked', createdAt: new Date('2026-11-02T00:00:00Z'), outcome: 'UNCHANGED', comparable: true,
      verificationReason: null, sourceAuditId: captured.auditId, sourceFlagIds: [captured.id], verificationAuditId: 'checked-audit',
      verificationAudit: { id: 'checked-audit', projectId: 'project-1', parentId: captured.auditId,
        status: 'COMPLETED', completedAt: new Date('2026-11-02T01:00:00Z') } },
  ])
  mocks.current.mockResolvedValue([currentRow((await mocks.attempts())[1])])
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({ verifying: false,
    verificationFeedback: { result: 'still_open', checkedAt: '2026-11-02T01:00:00.000Z' } })
})
it.each(['same-source', 'other-source', 'other-flag', 'other-project', 'wrong-parent', 'unfinished'] as const)
('requires completed proof of this captured occurrence before inheriting Verified workflow: %s', async condition => {
  const captured = await mocks.flag()
  mocks.flag.mockResolvedValue({ ...captured, improvementOccurrence: { improvement: {
    ...captured.improvementOccurrence.improvement, status: 'VERIFIED',
  } } })
  mocks.attempts.mockResolvedValue([{ id: 'repair', createdAt: new Date(), builder: 'mcp', outcome: 'IMPROVED', comparable: true,
    sourceAuditId: condition === 'other-source' ? 'older-source' : captured.auditId,
    handoffReference: 'flag:' + (condition === 'other-flag' ? 'peer-flag' : captured.id), verificationAuditId: 'repair-proof',
    verificationAudit: { id: 'repair-proof', projectId: condition === 'other-project' ? 'other-project' : 'project-1',
      parentId: condition === 'wrong-parent' ? 'older-source' : captured.auditId,
      status: condition === 'unfinished' ? 'FINALIZING' : 'COMPLETED' } }])
  const proof = (await mocks.attempts())[0]
  mocks.current.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('recovery.*') ? [currentRow(proof)] : [])
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({
    status: condition === 'same-source' ? 'VERIFIED' : 'OPEN',
    resolvedInId: condition === 'same-source' ? 'repair-proof' : null,
    verificationState: condition === 'same-source' ? 'verified' : 'still_open', sourceAuditId: captured.auditId,
  })
})
it('shows only the recorded expectation from the same owned Site', async () => {
  const detail = await loadSiteFlagDetail(site, 'improvement-1')
  expect(mocks.outcome).toHaveBeenCalledWith({ where: { id: 'outcome-1', projectId: 'project-1' }, select: { id: true, name: true, expectation: true } })
  expect(detail?.expectedBehavior).toBe('A customer can reach checkout from the product page.')
  expect(detail?.relatedOutcome).toEqual({ id: 'outcome-1', name: 'Checkout' })
})
it('shows a committed outcome recovery as proven for the owned checkout flag', async () => {
  const captured = await mocks.flag()
  mocks.flag.mockResolvedValue({ ...captured, status: 'FIXED', resolvedInId: 'recovery', fingerprint: 'outcome:v1:outcome-1:browser' })
  mocks.current.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('FROM improvement_occurrences member')
    ? [{ id: captured.id }] : [])
  mocks.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'project-1', completedAt: new Date('2026-10-12T12:00:00Z'),
    executionSpec: { engine: 'progressive-v1', version: 1, targetUrl: 'https://shop.test/checkout', environment: 'production', scope: 'OUTCOMES',
      checks: {}, outcomes: [], verificationTarget: null }, verifierExecutions: [],
    outcomeAssessments: [{ state: 'CLEAR', outcomeId: 'outcome-1', evidence: { reason: 'reached', incident: {
      version: 1, transition: 'recovery', incidentRunRequestId: 'source-run', rootFlagIds: ['captured-flag'], flagIds: [],
      recoveredFlagIds: ['captured-flag'], previousAssessmentId: 'before' } } }],
  }])
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({ status: 'FIXED', verificationState: 'verified', sourceFlagId: 'captured-flag' })
})
it('keeps unsupported historical journey recovery unverified even when an Audit completed', async () => {
  const captured = await mocks.flag()
  mocks.flag.mockResolvedValue({ ...captured, status: 'FIXED', resolvedInId: 'recovery' })
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({ status: 'UNVERIFIED', verificationState: 'could_not_verify' })
  mocks.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'project-1', completedAt: new Date('2026-10-12T12:00:00Z') }])
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({ status: 'UNVERIFIED', verificationState: 'could_not_verify', sourceFlagId: 'captured-flag' })
})
it('opens the unresolved original capture for an incident link while keeping exact capture links historical', async () => {
  const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture('https://shop.test/checkout') } })
  const captured = { ...await mocks.flag(), ...runPerformanceChecks(measurement, null, 'https://shop.test/checkout')[0], rubric: 'PERFORMANCE', impactTag: null,
    problem: 'Checkout content loads too slowly', evidence: 'Measured LCP of 4000ms', whyItMatters: 'Visitors wait for checkout content', fix: 'Improve checkout loading' }
  const latest = { ...captured, status: 'FIXED', resolvedInId: 'recovery' }
  const original = { ...captured, id: 'older-flag', auditId: 'older-audit', pageUrl: 'https://shop.test/original', status: 'OPEN', resolvedInId: null }
  mocks.flag.mockImplementation(async args => args?.where?.id === original.id ? original : latest)
  mocks.occurrences.mockResolvedValue([{ createdAt: new Date('2026-10-12T12:00:00Z'), flag: latest },
    { createdAt: new Date('2026-10-01T12:00:00Z'), flag: original }])
  mocks.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'project-1', completedAt: new Date('2026-10-12T12:00:00Z'),
    executionSpec: { engine: 'progressive-v1', version: 1, targetUrl: captured.pageUrl, environment: 'production', scope: 'SITE',
      checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
    verifierExecutions: [{ targetKey: 'module:performance', status: 'COMPLETED', detail: {
      kind: 'site-module-check', version: 1, module: 'performance', pageUrl: captured.pageUrl, passed: true, applicable: true,
      assertions: scopePerformanceAssertions(measurement, captured.pageUrl,
        [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
      execution: { auditId: 'recovery', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: '2026-10-12T12:00:00Z' },
    } }],
  }])
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({ sourceFlagId: 'older-flag', sourceAuditId: 'older-audit',
    affectedPaths: [original.pageUrl], verificationState: 'still_open' })
  expect(await loadSiteFlagDetail(site, 'captured-flag')).toMatchObject({ sourceFlagId: 'captured-flag', status: 'FIXED',
    affectedPaths: [captured.pageUrl], verificationState: 'verified' })
})
it.each(['ready', 'admitted', 'failed', 'later-source'] as const)('projects recorded provenance and checking only from current admitted work: %s', async state => {
  const pending = { id: 'attempt-1', createdAt: new Date('2026-10-12T12:00:00Z'), builder: 'mcp',
    outcome: null, sourceAuditId: state === 'later-source' ? 'older-audit' : 'audit-1', comparable: null, verificationReason: null,
    changeSummary: 'Declared repair', commitReference: 'declared-commit', deploymentReference: 'declared-deployment',
    verificationAuditId: state === 'ready' ? null : 'verification-audit', verificationAudit: state === 'ready' ? null
      : { projectId: 'project-1', parentId: state === 'later-source' ? 'older-audit' : 'audit-1', status: state === 'failed' ? 'FAILED' : 'QUEUED' } }
  // Draft history cannot retire the actual check of this captured source.
  mocks.attempts.mockResolvedValue([pending, { ...pending, id: 'older-attempt', sourceAuditId: 'audit-1', verificationAuditId: 'older-verification',
    verificationAudit: { projectId: 'project-1', parentId: 'audit-1', status: 'QUEUED' } }])
  mocks.current.mockResolvedValue([currentRow((await mocks.attempts())[state === 'ready' || state === 'later-source' ? 1 : 0])])
  const detail = await loadSiteFlagDetail(site, 'improvement-1')
  expect(detail).toMatchObject({ verifying: state !== 'failed', verificationState: state !== 'failed' ? 'verifying' : 'still_open' })
  expect(detail?.attempts[0]).toMatchObject({ changeSummary: pending.changeSummary, sourceAuditId: pending.sourceAuditId,
    commitReference: pending.commitReference, deploymentReference: pending.deploymentReference, verifying: state === 'admitted' || state === 'later-source' })
})

it.each([
  { selected: true, sourceAuditId: 'representative-audit' }, { selected: false, sourceAuditId: 'representative-audit' },
  { selected: true, sourceAuditId: 'audit-1' }, { selected: false, sourceAuditId: 'audit-1' },
])('uses frozen grouped membership, selected=$selected and source=$sourceAuditId', async ({ selected, sourceAuditId }) => {
  mocks.attempts.mockResolvedValue([{ id: 'grouped-attempt', createdAt: new Date(), builder: 'site', outcome: null,
    sourceAuditId, sourceFlagIds: ['representative-flag', ...(selected ? ['captured-flag'] : [])],
    handoffReference: 'flag:representative-flag', verificationAuditId: 'grouped-verification',
    verificationAudit: { projectId: 'project-1', parentId: sourceAuditId, status: 'QUEUED' } }])
  mocks.current.mockResolvedValue(selected ? [currentRow((await mocks.attempts())[0])] : [])
  expect(await loadSiteFlagDetail(site, 'captured-flag')).toMatchObject({
    verifying: selected, verificationState: selected ? 'verifying' : 'still_open', sourceAuditId: 'audit-1',
  })
})

it.each([null, { version: 9, items: [] }])('distinguishes absent historical support from unreadable recorded evidence: %j', async supportingObservations => {
  mocks.flag.mockResolvedValue({ ...await mocks.flag(), supportingObservations })
  expect(await loadSiteFlagDetail(site, 'improvement-1')).toMatchObject({
    supportingObservations: [], supportingEvidenceUnreadable: supportingObservations !== null,
    evidence: 'Two failed checks', sourceFlagId: 'captured-flag',
  })
})

it.each([
  { name: 'an empty fix after failed AI review', fix: '', audit: { includeAi: true, triageAt: new Date(), aiReviewAt: null, failureCode: 'AI_REVIEW_FAILED' }, expected: 'ready' },
  { name: 'a blank fix with AI review pending', fix: ' ', audit: { includeAi: true, triageAt: new Date(), aiReviewAt: null, failureCode: null }, expected: 'ready' },
  { name: 'an empty fix after AI review', fix: '', audit: { includeAi: true, triageAt: new Date(), aiReviewAt: new Date(), failureCode: null }, expected: 'ready' },
  { name: 'a fix after an invalid AI contract', fix: 'Restore the measured action.', audit: { includeAi: true, triageAt: new Date(), aiReviewAt: null, failureCode: 'AI_CONTRACT_INVALID' }, expected: 'ready' },
])('projects per-finding guidance without borrowing broader prescription success: $name', async ({ fix, audit, expected }) => {
  const recorded = await mocks.flag()
  mocks.flag.mockResolvedValue({ ...recorded, fix, audit })
  const detail = await loadSiteFlagDetail(site, 'captured-flag')
  expect(detail).toMatchObject({ repairGuidance: expected, sourceAuditId: recorded.auditId, evidence: recorded.evidence })
  if (fix.trim()) expect(detail?.fix).toBe(fix.trim())
  else {
    expect(detail?.fix).toContain('reproduce the problem')
    expect(buildSiteRepairHandoff('site-1', { ...detail!, verificationRule: null }, 'https://fixflags.test').prompt).toContain('/sites/site-1?view=timeline#timeline')
    expect(recorded.fix).toBe('Restore checkout')
  }
})

it('keeps established historical indexing guidance and its action availability consistent without changing the stored finding', async () => {
  const recorded = { ...(await mocks.flag()), checkId: 'noindex-meta', fix: '', audit: { failureCode: 'AI_REVIEW_FAILED' } }
  const snapshot = structuredClone(recorded)
  mocks.flag.mockResolvedValue(recorded)
  expect(await loadSiteFlagDetail(site, 'captured-flag')).toMatchObject({ fix: SEARCH_COPY.rules.indexing.guidance, repairGuidance: 'ready' })
  expect(recorded).toEqual(snapshot)
})

it.each(['placeholder-copy-detected', 'cta-below-fold-mobile'])('replaces unsafe historical %s instructions with conditional inspection without rewriting evidence', async checkId => {
  const recorded = { ...(await mocks.flag()), checkId, fix: 'Replace the recorded content and move the action.', audit: { failureCode: 'AI_REVIEW_FAILED' } }
  const snapshot = structuredClone(recorded)
  mocks.flag.mockResolvedValue(recorded)
  const detail = await loadSiteFlagDetail(site, 'captured-flag')
  expect(detail).toMatchObject({ repairGuidance: 'ready', evidence: recorded.evidence })
  expect(detail?.fix).toContain('confirm its intended purpose')
  expect(detail?.fix).not.toContain(recorded.fix)
  expect(recorded).toEqual(snapshot)
})

it('keeps a complete historical editor-only task usable in Site actions without changing its source row', async () => {
  const task = 'Restore the recorded button label and preserve its working action.'
  const recorded = { ...(await mocks.flag()), checkId: 'buttons-no-text', fix: '', cursorPrompt: task,
    audit: { failureCode: 'AI_REVIEW_FAILED' } }
  const snapshot = structuredClone(recorded)
  mocks.flag.mockResolvedValue(recorded)
  expect(await loadSiteFlagDetail(site, 'captured-flag')).toMatchObject({ fix: task, repairGuidance: 'ready', evidence: recorded.evidence })
  expect(recorded).toEqual(snapshot)
})
