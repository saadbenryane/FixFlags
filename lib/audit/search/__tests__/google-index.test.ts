import { describe, expect, it } from 'vitest'
import { googleIndexObservations } from '../google-index'
import { searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { searchReceiptSchema, type SearchObservation } from '../contracts'

const pageUrl = 'https://example.com/product', property = 'sc-domain:example.com'
const collectedAt = '2026-10-14T12:00:00Z'
const healthy = { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED',
  lastCrawlTime: '2026-10-01T00:00:00Z', googleCanonical: pageUrl, userCanonical: pageUrl }
const receipt = (observations: SearchObservation[]) => searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'fixture', pageUrl, collectedAt,
  complete: !observations.some(item => item.disposition === 'unknown'), observations })
const evaluate = (status = healthy) => googleIndexObservations({ pageUrl, property, collectedAt, status })
const previous = receipt(evaluate())
const local = receipt([{ ...previous.observations[0], id: 'local', checkId: 'robots-blocks-indexing', source: 'http', disposition: 'passed', reason: 'no_index_restrictions' }])
describe('Google indexed-version details', () => {
  it('records fetch, indexing and canonical fields without relying on free-text coverage labels', () => {
    const observations = evaluate()
    expect(observations.find(item => item.checkId === 'search-google-fetch')).toMatchObject({ disposition: 'passed', google: { pageFetchState: 'SUCCESSFUL' } })
    expect(observations.find(item => item.checkId === 'search-google-directives')).toMatchObject({ disposition: 'passed' })
    expect(observations.find(item => item.checkId === 'search-google-canonical')).toMatchObject({ disposition: 'passed' })
    expect(searchFindings(observations)).toEqual([])
  })
  it('recognizes a new soft 404 even when Google reports an excluded verdict', () => {
    const observations = googleIndexObservations({ pageUrl, property, collectedAt, previous, local,
      status: { ...healthy, verdict: 'NEUTRAL', pageFetchState: 'SOFT_404', lastCrawlTime: '2026-10-10T00:00:00Z' } })
    expect(observations.find(item => item.checkId === 'search-google-fetch')).toMatchObject({ reason: 'google_soft_404_recorded', disposition: 'observed' })
    expect(searchFindings(observations)).toMatchObject([{ checkId: 'indexing-failure', attentionPolicy: { kind: 'flag', google: { pageFetchState: 'SOFT_404' } } }])
    expect(assessSearchRecovery(receipt(observations), 'indexing-failure', searchFindings(observations)[0].attentionPolicy)).toMatchObject({ verdict: 'failed', comparable: true })
  })
  it('keeps first observations, stale crawls, changed properties and intentional noindex free of invented regressions', () => {
    const status = { ...healthy, verdict: 'NEUTRAL', indexingState: 'BLOCKED_BY_META_TAG', pageFetchState: 'SUCCESSFUL', lastCrawlTime: '2026-10-10T00:00:00Z' }
    for (const options of [{ previous: null, local }, { previous, local: undefined }, { previous, local, property: 'sc-domain:other.example' },
      { previous, local, status: { ...status, lastCrawlTime: healthy.lastCrawlTime } }]) {
      const observations = googleIndexObservations({ pageUrl, property, collectedAt, status, ...options })
      expect(searchFindings(observations).some(item => item.attentionPolicy?.kind === 'flag')).toBe(false)
    }
  })
  it('reports canonical disagreement as review guidance, including a legitimate cross-domain choice', () => {
    const observations = evaluate({ ...healthy, googleCanonical: 'https://preferred.example/product' })
    expect(searchFindings(observations)).toMatchObject([{ checkId: 'search-google-canonical', attentionPolicy: { kind: 'recommendation' } }])
    expect(observations.find(item => item.checkId === 'search-google-canonical')?.guidance).toContain('legitimately')
  })
  it('requires a later crawl of the same property to certify recovery', () => {
    const observations = googleIndexObservations({ pageUrl, property, collectedAt, previous, local,
      status: { ...healthy, verdict: 'FAIL', pageFetchState: 'SERVER_ERROR', lastCrawlTime: '2026-10-10T00:00:00Z' } })
    const policy = searchFindings(observations)[0].attentionPolicy
    for (const status of [{ ...healthy, lastCrawlTime: '2026-10-10T00:00:00Z' }, { ...healthy, lastCrawlTime: undefined }])
      expect(assessSearchRecovery(receipt(googleIndexObservations({ pageUrl, property, collectedAt, status })), 'indexing-failure', policy).verdict).toBe('unknown')
    expect(assessSearchRecovery(receipt(evaluate({ ...healthy, lastCrawlTime: '2026-10-11T00:00:00Z' })), 'indexing-failure', policy)).toMatchObject({ verdict: 'passed', comparable: true })
  })
  it('does not interpret missing fields or contradictory provider evidence as passing details', () => {
    const absent = googleIndexObservations({ pageUrl, property, collectedAt, status: { verdict: 'PASS' } })
    expect(absent.filter(item => item.disposition === 'unknown').map(item => item.checkId)).toEqual(['search-google-fetch', 'search-google-directives', 'search-google-canonical'])
    const conflicting = evaluate({ ...healthy, pageFetchState: 'SOFT_404' })
    expect(conflicting.find(item => item.checkId === 'indexing-failure')).toMatchObject({ disposition: 'unknown', reason: 'google_indexing_evidence_conflict' })
    expect(searchFindings(conflicting)).toEqual([])
  })
})
