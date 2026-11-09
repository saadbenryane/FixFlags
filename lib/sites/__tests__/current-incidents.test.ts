import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '../types'
import { currentIncidentFlags, incidentAffectedPaths } from '../flag-resolution'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const db = vi.hoisted(() => ({ improvements: vi.fn(), flags: vi.fn(), audit: vi.fn(), proofs: vi.fn(), assessments: vi.fn(), receipts: vi.fn(), current: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: async () => ({ id: 'owned' }) },
  improvement: { findMany: async (query: unknown) => (await db.improvements(query)).map((row: object) => ({ ...row, projectId: 'site-1' })) },
  flag: { findMany: async (query: { select?: { improvementOccurrence?: { select?: { createdAt?: boolean } } }; where?: { id?: { in: string[] } } }) => {
    const unbound = await db.flags(query)
    const incidents = await db.improvements.mock.results.at(-1)?.value ?? []
    const bound = incidents.flatMap((incident: { id: string; occurrences?: Array<{ createdAt?: Date; flag: ReturnType<typeof captured> }> }) =>
      (incident.occurrences ?? []).map(row => ({ ...row.flag, audit: { projectId: 'site-1' },
        improvementOccurrence: { improvementId: incident.id, createdAt: row.createdAt ?? row.flag.createdAt } })))
    if (query.select?.improvementOccurrence?.select?.createdAt) return [...bound, ...unbound.filter((flag: { id: string }) => !bound.some((row: { id: string }) => row.id === flag.id))
      .map((flag: object) => ({ ...flag, audit: { projectId: 'site-1' }, improvementOccurrence: null }))]
    return query.where?.id?.in ? [...bound, ...unbound].filter((flag: { id: string }) => query.where!.id!.in.includes(flag.id)) : unbound
  } },
  outcomeAssessment: { findMany: db.assessments }, audit: { findFirst: db.audit, findMany: db.proofs },
  auditVerificationReceipt: { findMany: db.receipts }, $queryRaw: db.current } }))
import { loadSiteFlags } from '../flags'
import { loadIncidentRecoveryProofs } from '../application/incident-proofs'

const site = { kind: 'project', projectId: 'site-1', userId: 'owner' } as SiteRecord
const recoveredAt = new Date('2026-10-12T12:00:00Z')
const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture('https://site.test/') } })
function captured(overrides: Record<string, unknown> = {}) {
  return { id: 'flag-1', auditId: 'before', checkId: 'lcp-poor', rubric: 'PERFORMANCE', severity: 'IMPORTANT', confidence: 1,
    problem: 'Page title is missing', evidence: 'The inspected document has no title.', whyItMatters: 'The page cannot be named.',
    fix: 'Add a descriptive title.', pageUrl: 'https://site.test/', status: 'FIXED', resolvedInId: 'recovery', fingerprint: 'title',
    createdAt: new Date('2026-10-01T12:00:00Z'), ...runPerformanceChecks(measurement, null, 'https://site.test/')[0], ...overrides }
}
function recovery(overrides: Record<string, unknown> = {}) {
  return { id: 'recovery', projectId: site.projectId, completedAt: recoveredAt,
    executionSpec: { engine: 'progressive-v1', version: 1, targetUrl: 'https://site.test/', environment: 'production', scope: 'SITE',
      checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
    verifierExecutions: [{ targetKey: 'module:performance', status: 'COMPLETED', detail: {
      kind: 'site-module-check', version: 1, module: 'performance', pageUrl: 'https://site.test/', applicable: true, passed: true,
      assertions: scopePerformanceAssertions(measurement, 'https://site.test/',
        [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
      execution: { auditId: 'recovery', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: recoveredAt.toISOString() },
    } }], ...overrides }
}
beforeEach(() => {
  vi.resetAllMocks(); db.flags.mockResolvedValue([]); db.assessments.mockResolvedValue([]); db.audit.mockResolvedValue({ id: 'latest' })
  db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', occurrences: [{ flag: captured() }], attempts: [] }])
  db.proofs.mockResolvedValue([recovery()])
  db.current.mockResolvedValue([])
  db.receipts.mockImplementation(async query => {
    const audits = await db.proofs.mock.results.at(-1)?.value ?? []
    return audits.flatMap((audit: ReturnType<typeof recovery>) => query.where.OR.some((source: { auditId: string }) => source.auditId === audit.id)
      ? (audit.verifierExecutions ?? []).map((row, index) => ({ ...row, id: audit.id + ':' + index, auditId: audit.id })) : [])
  })
})
describe('current incident projection', () => {
  it('does not let a newer copied repair hide the already admitted verification of the current Flag', async () => {
    const flag = captured({ status: 'OPEN', resolvedInId: null })
    const checking = { outcome: null, sourceAuditId: flag.auditId, sourceFlagIds: [flag.id], verificationAuditId: 'checking',
      verificationAudit: { id: 'checking', projectId: site.projectId, parentId: flag.auditId, status: 'CHECKING' } }
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'READY_TO_VERIFY', occurrences: [{ flag }],
      attempts: [{ outcome: null, sourceAuditId: flag.auditId, verificationAuditId: null, verificationAudit: null }, checking] }])
    db.current.mockResolvedValue([{ flagId: flag.id, ...checking, comparable: null, verificationReason: null, handoffReference: null,
      projectId: site.projectId, parentId: flag.auditId, status: 'CHECKING', createdAt: flag.createdAt, completedAt: null, finalizeState: null }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flag.id, verificationState: 'verifying' }])
  })
  it('removes a proven recovered incident without rewriting its unacted repair workflow', async () => {
    expect(await loadSiteFlags(site)).toEqual([])
    expect(db.proofs).toHaveBeenCalledWith({ where: { id: { in: ['recovery'] }, projectId: { in: ['site-1'] }, status: 'COMPLETED', completedAt: { not: null } },
      select: { id: true, projectId: true, completedAt: true, executionSpec: true,
        outcomeAssessments: { select: { state: true, outcomeId: true, evidence: true } } } })
  })
  it('keeps missing or foreign recovery proof unverified and preserves every unresolved condition', async () => {
    db.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'another-site', completedAt: recoveredAt }])
    expect(await loadSiteFlags(site)).toMatchObject([{ id: 'incident', status: 'UNVERIFIED', verificationState: 'could_not_verify' }])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', occurrences: [
      { flag: captured() }, { flag: captured({ id: 'older', status: 'OPEN', resolvedInId: null, pageUrl: 'https://site.test/original' }) },
    ], attempts: [] }])
    db.proofs.mockResolvedValue([recovery()])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: 'older', affectedPaths: ['https://site.test/original'] }])
  })
  it('shares one recovery read between incident occurrences and unbound observations', async () => {
    db.flags.mockResolvedValue([captured({ id: 'unbound-condition' })])
    expect(await loadSiteFlags(site)).toEqual([])
    expect(db.proofs).toHaveBeenCalledOnce()
    expect(db.receipts).toHaveBeenCalledOnce()
  })
  it('keeps recurrence visible and counts the recorded affected paths', () => {
    const flags = currentIncidentFlags([captured(), captured({ status: 'REGRESSED', resolvedInId: null,
      affectedPaths: ['https://site.test/', 'https://site.test/other'] })], new Set(['recovery']))
    expect(flags).toHaveLength(1)
    expect(incidentAffectedPaths(flags)).toEqual(['https://site.test/', 'https://site.test/other'])
  })
  it('keeps completed execution without the original measurement unverified', async () => {
    db.proofs.mockResolvedValue([recovery({ verifierExecutions: [] })])
    expect(await loadSiteFlags(site)).toMatchObject([{ status: 'UNVERIFIED', verificationState: 'could_not_verify' }])
  })
  it('proves each Flag scope separately even when they share a completed recovery Audit', async () => {
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', attempts: [], occurrences: [
      { flag: captured() }, { flag: captured({ id: 'peer', pageUrl: 'https://site.test/other' }) },
    ] }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: 'peer', status: 'UNVERIFIED', affectedPaths: ['https://site.test/other'] }])
  })
  it('keeps a later open occurrence visible after the earlier source was verified', async () => {
    const older = captured({ status: 'OPEN', resolvedInId: null })
    const later = captured({ id: 'later', auditId: 'later-source', status: 'OPEN', resolvedInId: null, pageUrl: 'https://site.test/later' })
    const attempt = { outcome: 'IMPROVED', comparable: true, sourceAuditId: older.auditId, handoffReference: 'flag:' + older.id,
      verificationAuditId: 'repair', createdAt: recoveredAt,
      verificationAudit: { id: 'repair', projectId: site.projectId, parentId: older.auditId, status: 'COMPLETED' } }
    db.current.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('recovery.*') ? [{
      flagId: older.id, sourceAuditId: older.auditId, handoffReference: attempt.handoffReference, verificationAuditId: 'repair',
      outcome: 'IMPROVED', comparable: true,
      projectId: site.projectId, parentId: older.auditId, status: 'COMPLETED', completedAt: recoveredAt,
    }] : [])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'VERIFIED', outcome: { id: 'outcome-1', name: 'Page loads' }, occurrences: [
      { flagId: later.id, flag: later }, { flagId: older.id, flag: older },
    ], attempts: [attempt] }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: later.id, status: 'OPEN', verificationState: 'still_open', affectedPaths: [later.pageUrl] }])
    // The latest broad report can still contain the repaired legacy OPEN row.
    db.flags.mockResolvedValue([older])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: later.id, affectedPaths: [later.pageUrl] }])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'VERIFIED', occurrences: [
      { flagId: older.id, flag: older },
    ], attempts: [attempt] }])
    expect(await loadSiteFlags(site)).toEqual([])
  })
  it('never lets a batched proof from one owned Site close another owned Site', async () => {
    db.proofs.mockResolvedValue([recovery({ projectId: 'site-2' })])
    const proofs = await loadIncidentRecoveryProofs([{ projectId: 'site-1', flags: [captured()] }, { projectId: 'site-2', flags: [captured()] }])
    expect(proofs.get('site-1')).toBeUndefined()
    expect(proofs.get('site-2')?.has('recovery')).toBe(true)
  })
  it('proves an outcome flag only from the committed recovery incident', async () => {
    const fingerprint = 'outcome:v1:checkout-outcome:browser'
    const incident = { version: 1, transition: 'recovery', incidentRunRequestId: 'source-run', rootFlagIds: ['checkout-flag'],
      flagIds: [], recoveredFlagIds: ['checkout-flag'], previousAssessmentId: 'before' }
    const checkout = captured({ id: 'checkout-flag', checkId: 'journey-checkout-failed-http_error', fingerprint, auditId: 'before',
      impactTag: 'REVENUE', rubric: 'EXPERIENCE', severity: 'CRITICAL', problem: 'Checkout is unavailable', evidence: 'The purchase request failed',
      whyItMatters: 'Customers cannot pay', fix: 'Restore checkout' })
    const receipt = { state: 'CLEAR', outcomeId: 'checkout-outcome', evidence: { reason: 'reached', incident } }
    let confirmedId = checkout.id
    db.current.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('jsonb_to_recordset') ? [{ id: confirmedId }] : [])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint, status: 'VERIFIED', outcome: { id: 'checkout-outcome', name: 'Checkout' },
      occurrences: [{ flag: checkout }], attempts: [] }])
    db.proofs.mockResolvedValue([recovery({ executionSpec: { ...recovery().executionSpec, checks: {}, scope: 'OUTCOMES' }, verifierExecutions: [],
      outcomeAssessments: [receipt] })])
    db.flags.mockResolvedValue([checkout])
    expect(await loadSiteFlags(site)).toEqual([])
    receipt.evidence.incident.transition = 'clear'
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: 'checkout-flag', status: 'UNVERIFIED' }])
    receipt.evidence.incident.transition = 'recovery'
    receipt.evidence = { ...receipt.evidence, supersededByAssessmentId: 'later' }
    expect(await loadSiteFlags(site)).toMatchObject([{ status: 'UNVERIFIED' }])
    receipt.evidence = { reason: 'reached', incident: { ...incident, recoveredFlagIds: ['other-flag'] } }
    expect(await loadSiteFlags(site)).toMatchObject([{ status: 'UNVERIFIED' }])
    const continuation = { ...checkout, id: 'continuation', auditId: 'during' }
    confirmedId = continuation.id
    db.flags.mockResolvedValue([])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint, status: 'VERIFIED', occurrences: [{ flag: continuation }], attempts: [] }])
    db.assessments.mockResolvedValue([{ auditId: 'during', outcomeId: 'checkout-outcome', audit: { projectId: 'site-1' }, evidence: {
      incident: { ...incident, transition: 'ongoing_failure', flagIds: ['continuation'], recoveredFlagIds: [] } } }])
    expect(await loadSiteFlags(site)).toEqual([])
    db.assessments.mockResolvedValue([{ auditId: 'during', outcomeId: 'checkout-outcome', audit: { projectId: 'site-1' }, evidence: {
      incident: { ...incident, transition: 'ongoing_failure', incidentRunRequestId: 'other-run', flagIds: ['continuation'], recoveredFlagIds: [] } } }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: 'continuation', status: 'UNVERIFIED' }])
    db.assessments.mockResolvedValue([])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'VERIFIED', occurrences: [{ flag: { ...checkout, fingerprint: 'title' } }], attempts: [] }])
    expect(await loadSiteFlags(site)).toMatchObject([{ status: 'UNVERIFIED' }])
  })
})
