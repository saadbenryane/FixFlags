import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '../types'
import { currentIncidentFlags, incidentAffectedPaths } from '../flag-resolution'

const db = vi.hoisted(() => ({ improvements: vi.fn(), flags: vi.fn(), audit: vi.fn(), proofs: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { improvement: { findMany: db.improvements }, flag: { findMany: db.flags },
  audit: { findFirst: db.audit, findMany: db.proofs } } }))
import { loadSiteFlags, loadSiteResolvedFlags } from '../flags'
import { loadIncidentRecoveryProofs } from '../application/incident-proofs'

const site = { kind: 'project', projectId: 'site-1' } as SiteRecord
const recoveredAt = new Date('2026-10-12T12:00:00Z')
function captured(overrides: Record<string, unknown> = {}) {
  return { id: 'flag-1', auditId: 'before', checkId: 'title-missing', rubric: 'REACH', severity: 'IMPORTANT', confidence: 1,
    problem: 'Page title is missing', evidence: 'The inspected document has no title.', whyItMatters: 'The page cannot be named.',
    fix: 'Add a descriptive title.', pageUrl: 'https://site.test/', status: 'FIXED', resolvedInId: 'recovery', fingerprint: 'title',
    createdAt: new Date('2026-10-01T12:00:00Z'), ...overrides }
}
beforeEach(() => {
  vi.resetAllMocks(); db.flags.mockResolvedValue([]); db.audit.mockResolvedValue({ id: 'latest' })
  db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', occurrences: [{ flag: captured() }], attempts: [] }])
  db.proofs.mockResolvedValue([{ id: 'recovery', projectId: site.projectId, completedAt: recoveredAt }])
})
describe('current incident projection', () => {
  it('removes a proven recovered incident without rewriting its unacted repair workflow', async () => {
    expect(await loadSiteFlags(site)).toEqual([])
    expect(db.proofs).toHaveBeenCalledWith({ where: { id: { in: ['recovery'] }, projectId: { in: ['site-1'] }, status: 'COMPLETED', completedAt: { not: null } },
      select: { id: true, projectId: true, completedAt: true } })
  })
  it('keeps missing or foreign recovery proof unverified and preserves every unresolved condition', async () => {
    db.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'another-site', completedAt: recoveredAt }])
    expect(await loadSiteFlags(site)).toMatchObject([{ id: 'incident', status: 'UNVERIFIED', verificationState: 'could_not_verify' }])
    db.improvements.mockResolvedValue([{ id: 'incident', fingerprint: 'title', status: 'PROPOSED', occurrences: [
      { flag: captured() }, { flag: captured({ id: 'older', status: 'OPEN', resolvedInId: null, pageUrl: 'https://site.test/original' }) },
    ], attempts: [] }])
    db.proofs.mockResolvedValue([{ id: 'recovery', projectId: site.projectId, completedAt: recoveredAt }])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: 'older', affectedPaths: ['https://site.test/original'] }])
  })
  it('keeps recurrence visible and counts the recorded affected paths', () => {
    const flags = currentIncidentFlags([captured(), captured({ status: 'REGRESSED', resolvedInId: null,
      affectedPaths: ['https://site.test/', 'https://site.test/other'] })], new Set(['recovery']))
    expect(flags).toHaveLength(1)
    expect(incidentAffectedPaths(flags)).toEqual(['https://site.test/', 'https://site.test/other'])
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
    db.proofs.mockResolvedValue([{ id: 'recovery', projectId: 'site-2', completedAt: recoveredAt }])
    const proofs = await loadIncidentRecoveryProofs([{ projectId: 'site-1', flags: [captured()] }, { projectId: 'site-2', flags: [captured()] }])
    expect(proofs.get('site-1')).toBeUndefined()
    expect(proofs.get('site-2')?.has('recovery')).toBe(true)
  })
})
