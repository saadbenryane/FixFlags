import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '../types'
import { currentIncidentFlags, incidentAffectedPaths } from '../flag-resolution'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const db = vi.hoisted(() => ({ improvements: vi.fn(), flags: vi.fn(), audit: vi.fn(), proofs: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { improvement: { findMany: db.improvements }, flag: { findMany: db.flags },
  audit: { findFirst: db.audit, findMany: db.proofs } } }))
import { loadSiteFlags, loadSiteResolvedFlags } from '../flags'
import { loadIncidentRecoveryProofs } from '../application/incident-proofs'

const site = { kind: 'project', projectId: 'site-1' } as SiteRecord
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
  vi.resetAllMocks(); db.flags.mockResolvedValue([]); db.audit.mockResolvedValue({ id: 'latest' })
  db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', occurrences: [{ flag: captured() }], attempts: [] }])
  db.proofs.mockResolvedValue([recovery()])
})
describe('current incident projection', () => {
  it('removes a proven recovered incident without rewriting its unacted repair workflow', async () => {
    expect(await loadSiteFlags(site)).toEqual([])
    expect(db.proofs).toHaveBeenCalledWith({ where: { id: { in: ['recovery'] }, projectId: { in: ['site-1'] }, status: 'COMPLETED', completedAt: { not: null } },
      select: { id: true, projectId: true, completedAt: true, executionSpec: true,
        verifierExecutions: { where: { status: 'COMPLETED', OR: [{ targetKey: { startsWith: 'module:' } }, { targetKey: { startsWith: 'check:' } }] },
          select: { targetKey: true, status: true, detail: true } } } })
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
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'VERIFIED', occurrences: [
      { flagId: later.id, flag: later }, { flagId: older.id, flag: older },
    ], attempts: [attempt] }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: later.id, status: 'OPEN', verificationState: 'still_open', affectedPaths: [later.pageUrl] }])
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: older.id, status: 'VERIFIED', affectedPaths: [older.pageUrl] }])
    // The latest broad report can still contain the repaired legacy OPEN row.
    db.flags.mockResolvedValue([older])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: later.id, affectedPaths: [later.pageUrl] }])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'VERIFIED', occurrences: [
      { flagId: older.id, flag: older },
    ], attempts: [attempt] }])
    expect(await loadSiteFlags(site)).toEqual([])
  })
  it('uses the actual recovery date and durable identity in the recovered list', async () => {
    db.improvements.mockResolvedValue([])
    db.flags.mockResolvedValue([captured({ improvementOccurrence: { improvementId: 'incident' } }),
      captured({ id: 'flag-2', improvementOccurrence: { improvementId: 'incident' } })])
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ id: 'incident', verificationState: 'verified', latestOccurrenceAt: recoveredAt.toISOString() }])
    expect(await loadSiteResolvedFlags(site)).toHaveLength(1)
    db.proofs.mockResolvedValue([])
    expect(await loadSiteResolvedFlags(site)).toEqual([])
  })
  it('never lets a batched proof from one owned Site close another owned Site', async () => {
    db.proofs.mockResolvedValue([recovery({ projectId: 'site-2' })])
    const proofs = await loadIncidentRecoveryProofs([{ projectId: 'site-1', flags: [captured()] }, { projectId: 'site-2', flags: [captured()] }])
    expect(proofs.get('site-1')).toBeUndefined()
    expect(proofs.get('site-2')?.has('recovery')).toBe(true)
  })
})
