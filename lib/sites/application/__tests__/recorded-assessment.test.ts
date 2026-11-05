import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { readFlagComparison } from '@/lib/audit/flag-comparison'
import { preparePublishedSiteAssessment, projectRecordedSiteResult } from '../recorded-assessment'
import * as attention from '@/lib/audit/attention'

vi.mock('@/lib/db', () => ({ prisma: { audit: { findUniqueOrThrow: vi.fn() } } }))
const now = new Date('2026-10-20T12:00:00Z')
function fixture() {
  return { id: 'audit', parentId: null, status: 'COMPLETED' as const, completedAt: now, failureCode: null, flags: [],
    executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null },
    evidenceCoverage: {}, failedModules: [], pages: [{ url: 'https://example.com/', status: 'COMPLETED' as const }],
    verifierExecutions: [{ targetKey: 'module:security', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1,
      module: 'security', pageUrl: 'https://example.com/', passed: true, applicable: true, complete: true,
      assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Recorded', passed: true, complete: true })) } }],
    outcomeAssessments: [],
  }
}
async function publication(flagged = false) {
  const audit = fixture()
  vi.mocked(prisma.audit.findUniqueOrThrow).mockResolvedValue(audit as never)
  const summary = { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: flagged ? [{ id: 'original',
    checkId: 'no-https', rubric: 'REACH', severity: 'IMPORTANT', confidence: 1, problem: 'Original observed problem' }] : [] }
  const comparison = { kind: 'flag-comparison', version: 1, auditId: audit.id, parentAuditId: audit.parentId, summary }
  const siteAssessment = await preparePublishedSiteAssessment(audit.id, comparison)
  const detail = { ...comparison, siteAssessment }
  return { audit: { ...audit, verifierExecutions: [...audit.verifierExecutions,
    { targetKey: 'projection:flag-comparison', status: 'COMPLETED', detail }] }, detail }
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('recorded Site conclusion boundaries', () => {
  it.each([false, true])('caps current assurance without changing historical publication or finding membership (flagged: %s)', async flagged => {
    const { audit, detail } = await publication(flagged)
    Object.assign(audit.verifierExecutions[0].detail, { execution: { auditId: audit.id, taskId: 'security', checkVersion: 1,
      source: 'http', collectedAt: '2026-10-11T12:00:00.000Z' } })
    const before = structuredClone(detail)
    vi.spyOn(attention, 'isCustomerFlag').mockImplementation(() => { throw new Error('Expiry cannot reinterpret original membership') })
    expect(projectRecordedSiteResult({ audit, assessments: [], now }).assessment).toMatchObject({ result: flagged ? 'FLAG' : 'STALE', completeness: 'FULL',
      checkedAt: now.toISOString(), validUntil: '2026-10-19T12:00:00.000Z', gaps: [{ area: 'security', reason: 'stale' }] })
    expect(detail).toEqual(before)
  })
  it('publishes expiry from the observation even when finalization occurs later', async () => {
    const audit = fixture()
    Object.assign(audit.verifierExecutions[0].detail, { execution: { auditId: audit.id, taskId: 'security', checkVersion: 1,
      source: 'http', collectedAt: '2026-10-11T12:00:00.000Z' } })
    vi.mocked(prisma.audit.findUniqueOrThrow).mockResolvedValue(audit as never)
    const saved = await preparePublishedSiteAssessment(audit.id, { kind: 'flag-comparison', version: 1, auditId: audit.id, parentAuditId: null,
      summary: { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [] } })
    expect(saved.assessment).toMatchObject({ result: 'STALE', completeness: 'FULL', validUntil: '2026-10-19T12:00:00.000Z' })
  })
  it('does not consult a later attention policy to reinterpret published Flag membership', async () => {
    const { audit } = await publication(true)
    vi.spyOn(attention, 'isCustomerFlag').mockImplementation(() => { throw new Error('A future policy cannot reinterpret this publication') })
    expect(projectRecordedSiteResult({ audit, assessments: [], now })).toMatchObject({
      assessment: { result: 'FLAG' }, findings: [{ id: 'original', problem: 'Original observed problem' }],
    })
  })
  it('retains the original result while exposing expiry separately from its historical time', async () => {
    const { audit, detail } = await publication()
    const before = structuredClone(detail)
    expect(projectRecordedSiteResult({ audit, assessments: [], now }).assessment).toMatchObject({ result: 'CLEAR', completeness: 'FULL' })
    expect(projectRecordedSiteResult({ audit, assessments: [], now: new Date('2026-10-28T12:00:00Z') }).assessment)
      .toMatchObject({ result: 'STALE', completeness: 'FULL', validUntil: '2026-10-28T12:00:00.000Z' })
    expect(detail).toEqual(before)
    expect(projectRecordedSiteResult({ audit, assessments: [], now }).assessment.result).toBe('CLEAR')
  })

  it('keeps unfinished and failed requests distinct from a published observation', async () => {
    const { audit } = await publication()
    expect(projectRecordedSiteResult({ audit, assessments: [], now, status: 'RUNNING' }).assessment)
      .toMatchObject({ result: null, completeness: 'PENDING' })
    expect(projectRecordedSiteResult({ audit, assessments: [], now, status: 'FAILED' }).assessment)
      .toMatchObject({ result: 'FAILED', completeness: 'PARTIAL' })
  })

  it.each(['policy-version', 'spec-hash', 'timestamp', 'scope', 'contradictory-gap', 'contradictory-completeness', 'flag-reference'] as const)
    ('refuses an unreadable or mismatched recorded conclusion: %s', async change => {
      const { audit, detail } = await publication()
      if (change === 'policy-version') detail.siteAssessment.version = 2 as never
      if (change === 'spec-hash') detail.siteAssessment.specHash = '0'.repeat(64)
      if (change === 'timestamp') detail.siteAssessment.assessment.checkedAt = '2026-10-19T12:00:00.000Z'
      if (change === 'scope') audit.executionSpec.targetUrl = 'https://example.com/changed'
      if (change === 'contradictory-gap') detail.siteAssessment.assessment.gaps = [{ area: 'security', reason: 'missing' }]
      if (change === 'contradictory-completeness') detail.siteAssessment.assessment.completeness = 'PARTIAL'
      if (change === 'flag-reference') {
        detail.siteAssessment.customerFlags = [{ group: 'newIssues', index: 99 }]
        detail.siteAssessment.assessment.result = 'FLAG'
      }
      expect(projectRecordedSiteResult({ audit, assessments: [], now }).assessment)
        .toMatchObject({ result: 'COULD_NOT_VERIFY', completeness: 'PARTIAL' })
    })

  it('retains confirmed findings when supplementary conclusion data is unreadable', async () => {
    const { audit, detail } = await publication(true)
    detail.siteAssessment.specHash = '0'.repeat(64)
    expect(readFlagComparison(detail, { auditId: audit.id, parentAuditId: audit.parentId }).newIssues).toHaveLength(1)
    expect(projectRecordedSiteResult({ audit, assessments: [], now })).toMatchObject({
      assessment: { result: 'FLAG', completeness: 'PARTIAL' }, findings: [{ id: 'original', problem: 'Original observed problem' }],
    })
  })

  it('rejects a conclusion copied from another Audit without inventing a successful result', async () => {
    const { audit, detail } = await publication()
    detail.auditId = 'other-audit'
    expect(projectRecordedSiteResult({ audit, assessments: [], now }).assessment)
      .toMatchObject({ result: 'COULD_NOT_VERIFY', completeness: 'PARTIAL' })
  })
})
