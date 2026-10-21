import { describe, expect, it } from 'vitest'
import { projectSiteAssessment, requiredAreasForScope, LEGACY_BROAD_REQUIRED_AREAS } from '../assessment'
import { siteCardHealth } from '../site-health'
import type { CoverageFact } from '../coverage'
import { siteCoverageMaxAgeMs } from '../evidence-freshness'

const now = new Date('2026-10-12T12:00:00Z')
const spec = (checks: Record<string, number>) => ({ version: 1, engine: 'progressive-v1', scope: 'SITE',
  targetUrl: 'https://acme.fixture.test/', environment: 'production', checks, outcomes: [], verificationTarget: null })
function facts(): CoverageFact[] {
  return LEGACY_BROAD_REQUIRED_AREAS.map(area => ({ area, state: 'healthy', label: 'Recorded', detail: null,
    checkedAt: now.toISOString(), openFlagCount: 0, evidenced: true }))
}
const input = () => ({ status: 'COMPLETED', coverage: facts(), flags: [], now, pagesComplete: true, checkedAt: now })

describe('shared Site assessment', () => {
  it('derives modern required areas from the admitted identities rather than visible cards', () => {
    const executionSpec = spec({ 'no-https': 1, 'lang-missing': 1 })
    expect(requiredAreasForScope(executionSpec)).toEqual(['security', 'accessibility'])
    const assessed = projectSiteAssessment({ ...input(), executionSpec })
    expect(assessed).toMatchObject({ result: 'COULD_NOT_VERIFY', completeness: 'PARTIAL', gaps: [{ area: 'accessibility', reason: 'missing' }] })
    const health = siteCardHealth({ inFlight: false, finished: true, hasLastKnown: true,
      ...input(), executionSpec })
    expect(health.state).toBe('unknown')
  })
  it('never treats an empty coverage array as evidence that all requirements passed', () => {
    expect(projectSiteAssessment({ ...input(), coverage: [] }).result).toBe('COULD_NOT_VERIFY')
    expect(siteCardHealth({ ...input(), coverage: [], inFlight: false, finished: true, hasLastKnown: false }).state).toBe('unknown')
  })
  it('keeps unknown checks, unavailable versions, and scopes without obligations unassessed', () => {
    for (const checks of [{ invented: 1 }, { 'no-https': 9 }, {}])
      expect(projectSiteAssessment({ ...input(), executionSpec: spec(checks) }).result).toBe('COULD_NOT_VERIFY')
  })
  it('returns Clear only for complete current required evidence', () => {
    expect(projectSiteAssessment(input())).toMatchObject({ result: 'CLEAR', completeness: 'FULL', gaps: [] })
    const incomplete = facts().map(fact => fact.area === 'search' ? { ...fact, incompleteReason: 'Crawl checks unfinished' } : fact)
    expect(projectSiteAssessment({ ...input(), coverage: incomplete }).result).toBe('COULD_NOT_VERIFY')
    expect(projectSiteAssessment({ ...input(), pagesComplete: false }).result).toBe('COULD_NOT_VERIFY')
  })
  it('retains established failures when other evidence is missing', () => {
    const assessed = projectSiteAssessment({ ...input(), coverage: [], flags: [{ severity: 'IMPORTANT' }] })
    expect(assessed).toMatchObject({ result: 'FLAG', completeness: 'PARTIAL' })
    expect(projectSiteAssessment({ ...input(), coverage: [], outcomes: [{ state: 'FLAG' }] }).result).toBe('FLAG')
    expect(siteCardHealth({ ...input(), coverage: [], inFlight: false, finished: true, hasLastKnown: true,
      outcomes: [{ state: 'FLAG' }] }).state).toBe('attention')
  })
  it('keeps pending and failed execution distinct from assessment success', () => {
    expect(projectSiteAssessment({ ...input(), status: 'RUNNING', flags: [{ severity: 'CRITICAL' }] })).toMatchObject({ result: null, completeness: 'PENDING' })
    expect(projectSiteAssessment({ ...input(), status: 'FAILED' })).toMatchObject({ result: 'FAILED', completeness: 'PARTIAL' })
  })
  it('uses the earliest required freshness deadline and does not certify an expired observation', () => {
    const deadline = new Date(now.getTime() + 60_000)
    expect(projectSiteAssessment({ ...input(), outcomes: [{ state: 'CLEAR', validUntil: deadline }] }).validUntil).toBe(deadline.toISOString())
    const stale = facts().map(fact => ({ ...fact, checkedAt: '2026-10-01T12:00:00Z' }))
    expect(projectSiteAssessment({ ...input(), coverage: stale })).toMatchObject({ result: 'STALE', completeness: 'FULL' })
    expect(projectSiteAssessment({ ...input(), outcomes: [{ state: 'STALE' }] }).result).toBe('STALE')
  })
  it('does not require a paused Outcome, but requires an enabled unassessed one', () => {
    expect(projectSiteAssessment({ ...input(), outcomes: [{ state: 'COULD_NOT_VERIFY', enabled: false }] }).result).toBe('CLEAR')
    expect(projectSiteAssessment({ ...input(), outcomes: [{ state: 'COULD_NOT_VERIFY' }] }).result).toBe('COULD_NOT_VERIFY')
  })

  it('uses current broad care for both the conclusion and deadline without changing historical defaults', () => {
    const coverageMaxAgeMs = siteCoverageMaxAgeMs('daily')
    const later = new Date(now.getTime() + coverageMaxAgeMs)
    const current = { ...input(), now: later, coverageMaxAgeMs }
    expect(projectSiteAssessment(current)).toMatchObject({ result: 'STALE', validUntil: later.toISOString() })
    expect(siteCardHealth({ ...current, inFlight: false, finished: true, hasLastKnown: true })).toMatchObject({
      state: 'unknown', assessment: { result: 'STALE', validUntil: later.toISOString() },
    })
    expect(projectSiteAssessment({ ...input(), now: later })).toMatchObject({ result: 'CLEAR',
      validUntil: new Date(now.getTime() + 8 * 86400_000).toISOString() })
    expect(projectSiteAssessment({ ...current, flags: [{ severity: 'IMPORTANT' }] }).result).toBe('FLAG')
  })
})
