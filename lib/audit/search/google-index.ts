import type { SearchUrlInspection } from '@/lib/integrations/google-search-console'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { searchObservationSchema, type SearchObservation, type SearchReceipt } from './contracts'

type Status = NonNullable<SearchUrlInspection['indexStatusResult']>
const fetchFailures = new Set(['SOFT_404', 'BLOCKED_ROBOTS_TXT', 'NOT_FOUND', 'ACCESS_DENIED', 'SERVER_ERROR', 'REDIRECT_ERROR', 'ACCESS_FORBIDDEN', 'BLOCKED_4XX', 'INVALID_URL'])
const blockedIndexing = new Set(['BLOCKED_BY_META_TAG', 'BLOCKED_BY_HTTP_HEADER'])

export function googleIndexObservations(input: { pageUrl: string; property: string; collectedAt: string; status: Status;
  previous?: SearchReceipt | null; local?: SearchReceipt }): SearchObservation[] {
  const { status, property, pageUrl, collectedAt } = input
  const google = { property, verdict: status.verdict, lastCrawlAt: status.lastCrawlTime, pageFetchState: status.pageFetchState,
    robotsTxtState: status.robotsTxtState, indexingState: status.indexingState, googleCanonical: status.googleCanonical, userCanonical: status.userCanonical }
  const make = (checkId: string, rule: 'google' | 'googleFetch' | 'googleDirectives' | 'googleCanonical', disposition: SearchObservation['disposition'],
    reason: string, observed: string, attention: SearchObservation['attention']['kind'] = 'observation') => searchObservationSchema.parse({
    id: `${checkId}:google-index`, checkId, checkVersion: 1, responsibility: 'google', name: C.rules[rule].name,
    expected: C.rules[rule].expected, guidance: C.rules[rule].guidance, disposition, reason, observed, source: 'google-index', collectedAt, pageUrl,
    attention: { policy: 'search', version: 1, kind: attention, reason }, google,
    evidence: [{ source: 'google-index', url: pageUrl, locator: 'indexStatusResult', excerpt: observed.slice(0, 2000), collectedAt }], limitation: C.googleLimit,
  })
  const fetchFailed = Boolean(status.pageFetchState && fetchFailures.has(status.pageFetchState))
  const excluded = status.robotsTxtState === 'DISALLOWED' || Boolean(status.indexingState && blockedIndexing.has(status.indexingState))
  const conflict = status.verdict === 'PASS' && (fetchFailed || excluded)
  const failed = !conflict && (status.verdict === 'FAIL' || fetchFailed || excluded)
  const before = input.previous?.pageUrl === pageUrl ? input.previous.observations.find(item => item.checkId === 'indexing-failure') : undefined
  const newer = Boolean(status.lastCrawlTime && before?.google?.lastCrawlAt && new Date(status.lastCrawlTime) > new Date(before.google.lastCrawlAt))
  const localAllows = input.local?.pageUrl === pageUrl && input.local.observations.some(item => item.checkId === 'robots-blocks-indexing' && item.disposition === 'passed' && item.reason === 'no_index_restrictions')
  const regression = failed && localAllows && before?.google?.property === property &&
    (before.disposition === 'passed' && newer || before.attention.kind === 'flag')
  const observations = [
    make('search-google-index', 'google', 'observed', 'google_indexed_version_recorded',
      `Google verdict: ${status.verdict ?? 'not supplied'}. Last crawl: ${status.lastCrawlTime ?? 'not supplied'}. Coverage: ${status.coverageState ?? 'not supplied'}.`),
    make('indexing-failure', 'google', conflict ? 'unknown' : status.verdict === 'PASS' ? 'passed' : failed ? 'failed' : 'unknown',
      conflict ? 'google_indexing_evidence_conflict' : regression ? 'google_indexing_regression' : 'google_indexed_version_assessment',
      `Google’s indexed-version verdict is ${status.verdict ?? 'unknown'}; last crawl ${status.lastCrawlTime ?? 'unknown'}. Fetch: ${status.pageFetchState ?? 'not supplied'}. Robots: ${status.robotsTxtState ?? 'not supplied'}. Indexing: ${status.indexingState ?? 'not supplied'}.`, regression ? 'flag' : 'observation'),
    make('search-google-fetch', 'googleFetch', status.pageFetchState === 'SUCCESSFUL' ? 'passed' : fetchFailed ? 'observed' : 'unknown',
      status.pageFetchState === 'SOFT_404' ? 'google_soft_404_recorded' : fetchFailed ? 'google_fetch_failure_recorded' : 'google_fetch_assessment',
      `Google recorded ${status.pageFetchState === 'SOFT_404' ? 'a soft 404' : status.pageFetchState ?? 'no page-fetch result'} for this URL. Last crawl: ${status.lastCrawlTime ?? 'unknown'}.`),
    make('search-google-directives', 'googleDirectives', excluded ? 'observed' : status.robotsTxtState === 'ALLOWED' && status.indexingState === 'INDEXING_ALLOWED' ? 'passed' : 'unknown',
      excluded ? 'google_indexing_restriction_recorded' : 'google_indexing_rules_assessment',
      `Google’s recorded robots.txt result: ${status.robotsTxtState ?? 'not supplied'}. Indexing rules: ${status.indexingState ?? 'not supplied'}. These describe the recorded crawl, separately from today’s public page.`),
  ]
  const selected = status.googleCanonical, declared = status.userCanonical
  const mismatch = Boolean(selected && declared && new URL(selected).href !== new URL(declared).href)
  observations.push(make('search-google-canonical', 'googleCanonical', selected && declared ? mismatch ? 'observed' : 'passed'
    : selected ? 'observed' : failed || status.verdict === 'NEUTRAL' ? 'not_applicable' : 'unknown',
    mismatch ? 'google_canonical_mismatch' : selected && declared ? 'google_canonical_matches' : 'google_canonical_selection_recorded',
    `Google’s selected canonical: ${selected ?? 'not supplied'}. Declared canonical: ${declared ?? 'not supplied'}.`, mismatch ? 'recommendation' : 'observation'))
  return observations
}
