import { describe, expect, it, vi } from 'vitest'
import { loadSiteRecommendations } from '../flags'
import { newestRecordedFlag } from '../flag-resolution'
import type { SiteRecord } from '../types'

const db = vi.hoisted(() => ({ improvement: { findMany: vi.fn() }, flag: { findMany: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('../application/incident-proofs', () => ({ currentImprovementWhere: {}, unboundSiteFindingWhere: () => ({}), loadIncidentRecoveryProofs: vi.fn().mockResolvedValue(new Map()) }))
const site = { kind: 'project', projectId: 'owned-site' } as SiteRecord
const time = (seconds: number) => new Date(Date.UTC(2026, 9, 17, 2, 0, seconds))
const flag = (id: string, seconds: number) => ({ id, createdAt: time(seconds), auditId: 'audit-' + id, fingerprint: 'privacy-scope', checkId: 'no-privacy-policy',
  rubric: 'REACH', severity: 'POLISH', impactTag: 'TRUST', problem: 'No privacy policy link found', evidence: 'Recorded privacy link absence',
  whyItMatters: 'Review the intended privacy access.', fix: 'Provide the appropriate policy link.', pageUrl: 'https://example.com/' + id, status: 'OPEN', resolvedInId: null })

describe('current finding recency across bound and unbound records', () => {
  it.each([false, true])('does not let an older unbound record replace a newer occurrence (reverse order %s)', async reverse => {
    const older = flag('older-unbound', 1), recent = { ...flag('recent-recurrence', 20), status: 'REGRESSED' }
    const historical = flag('late-materialized-history', 0)
    const occurrences = [{ createdAt: time(30), flag: historical }, { createdAt: time(20), flag: recent }]
    db.improvement.findMany.mockResolvedValue([{ id: 'improvement', fingerprint: 'privacy-scope', status: 'PROPOSED', attempts: [], outcome: null, occurrences: reverse ? occurrences.reverse() : occurrences }])
    db.flag.findMany.mockResolvedValue([older])
    const rows = await loadSiteRecommendations(site)
    expect(rows).toMatchObject([{ improvementId: 'improvement', sourceFlagId: recent.id, status: 'REGRESSED', pageUrl: recent.pageUrl, latestOccurrenceAt: time(20).toISOString() }])
    expect(rows[0].affectedPaths).toEqual(expect.arrayContaining([older.pageUrl, recent.pageUrl, historical.pageUrl]))
  })
  it('keeps a genuinely newer unbound observation visible before materialization', async () => {
    const bound = flag('bound', 1), unbound = flag('new-unbound', 20)
    db.improvement.findMany.mockResolvedValue([{ id: 'improvement', fingerprint: 'privacy-scope', status: 'PROPOSED', attempts: [], outcome: null, occurrences: [{ createdAt: time(1), flag: bound }] }])
    db.flag.findMany.mockResolvedValue([unbound])
    expect(await loadSiteRecommendations(site)).toMatchObject([{ sourceFlagId: unbound.id, latestOccurrenceAt: time(20).toISOString() }])
  })
  it('uses a deterministic tie and never invents missing timestamps', () => {
    expect(newestRecordedFlag([{ id: 'a', createdAt: time(1) }, { id: 'b', createdAt: time(1) }])?.id).toBe('b')
    expect(newestRecordedFlag([{ id: 'known', createdAt: time(1) }, { id: 'unknown' }])?.id).toBe('known')
    expect(newestRecordedFlag([])).toBeUndefined()
  })
})
