import { describe, expect, it } from 'vitest'
import { googleIndexObservations } from '../google-index'
import { searchFindings } from '../registry'
import { searchReceiptSchema, type SearchReceipt } from '../contracts'
import { assessSearchRecovery } from '../recovery'
import { collapseRecordedFixtureFlags as collapseFlagsWithAffectedPaths } from '@/lib/audit/__tests__/recorded-flag-fixtures'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'

const root = 'https://example.com/', peer = 'https://example.com/pricing', property = 'sc-domain:example.com'
const collectedAt = '2026-10-14T12:00:00Z'
function receipt(pageUrl: string, verdict: string, crawl: string): SearchReceipt {
  const observations = googleIndexObservations({ pageUrl, property, collectedAt,
    status: { verdict, lastCrawlTime: crawl, pageFetchState: verdict === 'PASS' ? 'SUCCESSFUL' : 'SOFT_404', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED' } })
    .map(item => item.checkId === 'indexing-failure' && verdict !== 'PASS'
      ? { ...item, attention: { ...item.attention, kind: 'flag' as const, reason: 'google_indexing_regression' } } : item)
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl, collectedAt, complete: true, observations })
}
describe('collapsed Search recovery retains each original page', () => {
  it('does not borrow an earlier page crawl to certify an older observation for another page', () => {
    const flag = collapseFlagsWithAffectedPaths([
      ...searchFindings(receipt(root, 'FAIL', '2026-10-01T00:00:00Z').observations),
      ...searchFindings(receipt(peer, 'FAIL', '2026-10-10T00:00:00Z').observations),
    ])[0]
    expect(flag.attentionPolicy?.pageScopes).toHaveLength(2)
    expect(flag.evidence).toContain(peer + ':')
    expect(assessSearchRecovery(receipt(root, 'PASS', '2026-10-02T00:00:00Z'), 'indexing-failure', flag.attentionPolicy)).toMatchObject({ verdict: 'passed' })
    expect(assessSearchRecovery(receipt(peer, 'PASS', '2026-10-05T00:00:00Z'), 'indexing-failure', flag.attentionPolicy)).toMatchObject({ verdict: 'unknown' })
    const current = (peerCrawl: string) => hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: {
      version: 1, scope: 'SITE', targetUrl: root, environment: 'production', checks: { 'indexing-failure': 1 }, outcomes: [], verificationTarget: null }, flag,
      executions: [receipt(root, 'PASS', '2026-10-02T00:00:00Z'), receipt(peer, 'PASS', peerCrawl)]
        .map(detail => ({ targetKey: 'module:search-google-index', status: 'COMPLETED', detail })) })
    expect(current('2026-10-05T00:00:00Z')).toBe(false)
    expect(current('2026-10-11T00:00:00Z')).toBe(true)
    expect(collapseFlagsWithAffectedPaths([flag])[0].attentionPolicy).toEqual(flag.attentionPolicy)
  })
  it('does not invent historical peer provenance or accept a page without a recorded scope', () => {
    const scoped = searchFindings(receipt(root, 'FAIL', '2026-10-01T00:00:00Z').observations)[0].attentionPolicy!
    const legacy = { ...scoped, pageScopes: undefined }
    expect(assessSearchRecovery(receipt(peer, 'PASS', '2026-10-11T00:00:00Z'), 'indexing-failure', legacy, root).verdict).toBe('unknown')
    expect(assessSearchRecovery(receipt(root, 'PASS', '2026-10-11T00:00:00Z'), 'indexing-failure', legacy, root).verdict).toBe('passed')
    expect(assessSearchRecovery(receipt(peer, 'PASS', '2026-10-11T00:00:00Z'), 'indexing-failure', scoped).verdict).toBe('unknown')
    expect(assessSearchRecovery(receipt(root, 'PASS', '2026-10-11T00:00:00Z'), 'indexing-failure', legacy, null, [root, peer]).verdict).toBe('unknown')
  })
  it('keeps different original markup requirements on different pages', () => {
    const base = searchFindings(receipt(root, 'FAIL', '2026-10-01T00:00:00Z').observations)[0]
    const markup = (pageUrl: string, name: string) => ({ ...base, checkId: 'search-structured-invalid', pageUrl,
      attentionPolicy: { policy: 'search' as const, version: 1 as const, kind: 'flag' as const, reason: 'markup_property_invalid',
        pageScopes: [{ pageUrl, reason: 'markup_property_invalid', sources: ['rendered-dom' as const], entityTypes: ['Product'],
          markupTargets: [{ entityId: '#product', entityType: 'Product', source: 'rendered-dom' as const, properties: [name] }] }] } })
    const flag = collapseFlagsWithAffectedPaths([markup(root, 'price'), markup(peer, 'name')])[0]
    const current = receipt(peer, 'PASS', '2026-10-11T00:00:00Z')
    current.observations = [{ ...current.observations[0], checkId: 'search-structured-invalid', source: 'rendered-dom', disposition: 'observed',
      entityId: '#product', entityTypes: ['Product'], invalidProperties: ['name'] }]
    expect(assessSearchRecovery(current, 'search-structured-invalid', flag.attentionPolicy).verdict).toBe('unknown')
    current.observations[0].invalidProperties = []
    expect(assessSearchRecovery(current, 'search-structured-invalid', flag.attentionPolicy).verdict).toBe('passed')
  })
  it('withholds recovery when a recorded Search policy is malformed instead of discarding its constraints', () => {
    const current = receipt(root, 'PASS', '2026-10-11T00:00:00Z')
    current.observations = [{ ...current.observations[0], checkId: 'title-missing', source: 'rendered-dom', disposition: 'passed' }]
    const scope = { policy: 'search', version: 1, kind: 'flag', reason: 'recorded', pageScopes: [{ pageUrl: 'not a URL', reason: 'recorded' }] }
    expect(assessSearchRecovery(current, 'title-missing', scope).verdict).toBe('unknown')
  })
})
