import { describe, expect, it } from 'vitest'
import { applySearchCardEvidence } from '../search-view'
import type { BoardCardView } from '../board-card'
import type { SearchObservation, SearchReceipt } from '@/lib/audit/search/contracts'
import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { applyCardEvidence } from '../application/card-evidence'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import { siteCoverageMaxAgeMs } from '../evidence-freshness'
import { SITE_BOARD_COPY, SITE_PRESENTATION_COPY } from '@/lib/marketing/copy/terminology'

const collectedAt = '2026-10-12T10:00:00.000Z'
const now = new Date(collectedAt)
const pageUrl = 'https://example.com/'
function card(overrides: Partial<BoardCardView> = {}): BoardCardView {
  return { id: 'search', name: 'Search', question: '', state: 'healthy', status: 'Checked', answer: 'Checked',
    detail: null, facts: [], coverage: null, evidenced: true, openFlagCount: 0, checkedAt: null,
    flagIds: [], flagChips: [], sources: [], activity: null, wide: false, captureUrl: null, captureAlt: null,
    cropUrl: null, cropAlt: null, problem: null, ...overrides }
}
function observation(overrides: Partial<SearchObservation> = {}): SearchObservation {
  return { id: 'crawl', checkId: 'search-crawl-access', checkVersion: 1, responsibility: 'crawl', name: 'Crawl rules',
    disposition: 'unknown', reason: 'public_document_unavailable', expected: 'Readable crawl rules', observed: 'robots.txt could not be read.',
    source: 'robots-txt', collectedAt, pageUrl, attention: { policy: 'search', version: 1, kind: 'observation', reason: 'public_document_unavailable' },
    evidence: [], limitation: '', guidance: '', ...overrides }
}
function receipt(overrides: Partial<SearchReceipt> = {}): SearchReceipt {
  return { kind: 'search-checks', version: 1, auditId: 'a', pageUrl, collectedAt, complete: true, observations: [], ...overrides }
}

describe('Search evidence recovery', () => {
  it('keeps the current care expiry visible through the complete Search card projection', () => {
    const search = card({ state: 'unknown' })
    const audit = { status: 'COMPLETED', startedAt: now, failureCode: null,
      verifierExecutions: [{ targetKey: 'module:search', detail: receipt() }] }
    const input = { cards: [search], audit: audit as unknown as Parameters<typeof applyCardEvidence>[0]['audit'],
      summaryResults: [], inFlight: false, pageCount: 1, connections: null, connectionNotes: {} }
    const later = new Date(now.getTime() + 2 * 86400_000)
    applyCardEvidence({ ...input, now: later, coverageMaxAgeMs: siteCoverageMaxAgeMs('daily') })
    expect(search).toMatchObject({ state: 'unknown', answer: SITE_BOARD_COPY.checkOutOfDate, checkedAt: collectedAt })
    search.state = 'healthy'
    applyCardEvidence({ ...input, now: later })
    expect(search).toMatchObject({ state: 'healthy', answer: SITE_PRESENTATION_COPY.flags(0), detail: null })
    expect(search.answer).not.toContain('recorded')
  })
  it('stays incomplete without naming the missing checks', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search-presentation', detail: receipt() }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.answer).toBe(C.summary.partial)
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    for (const name of ['Crawl access', 'Discovery', 'Google evidence', 'Search presentation']) {
      expect(search.incompleteReason).not.toContain(name)
    }
  })

  it('keeps a confirmed Flag and discloses the unfinished work beside it', () => {
    const search = card({ state: 'problem', openFlagCount: 1, answer: 'Page title is missing', flagIds: ['f1'] })
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [observation()] }) }], false, now)
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Crawl access')
    expect(search).toMatchObject({ state: 'problem', answer: 'Page title is missing', openFlagCount: 1, flagIds: ['f1'] })
  })

  it('preserves the Search recovery reason through the complete card projection', () => {
    const search = card()
    const audit = { status: 'COMPLETED', startedAt: now, failureCode: null, failedModules: [], triageAt: now, aiReviewAt: now,
      verifierExecutions: [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [observation()] }) }] }
    applyCardEvidence({ cards: [search], audit: audit as unknown as Parameters<typeof applyCardEvidence>[0]['audit'],
      summaryResults: [], inFlight: false, pageCount: 1, connections: null, connectionNotes: {}, now })
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Crawl access')
    expect(search.state).toBe('unknown')
  })

  it('requires complete local evidence for each recorded page', () => {
    const search = card()
    applySearchCardEvidence(search, [
      { targetKey: 'module:search', detail: receipt() },
      { targetKey: 'module:search-crawl', detail: receipt({ pageUrl: pageUrl + 'about' }) },
    ], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Search presentation')
  })

  it('does not trust a complete receipt with an unknown result', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ observations: [observation()] }) }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Crawl access')
  })

  it('does not let a Google receipt satisfy missing local modules', () => {
    const search = card()
    applySearchCardEvidence(search, [
      { targetKey: 'module:search-presentation', detail: receipt() },
      { targetKey: 'module:search-google', detail: receipt({ complete: false, observations: [observation({ responsibility: 'google' })] }) },
    ], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Crawl access')
    expect(search.incompleteReason).not.toContain('Google evidence')
  })

  it('keeps complete local evidence healthy without requiring Search Console', () => {
    const search = card()
    const executions = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
      .map(item => ({ targetKey: 'module:search-' + item.evaluator, detail: receipt() }))
    applySearchCardEvidence(search, executions, false, now)
    expect(search.state).toBe('healthy')
    expect(search.incompleteReason).toBeNull()
  })

  it('preserves another Search module limitation when local Search receipts are complete', () => {
    const search = card({ state: 'unknown', incompleteReason: 'This area was only partially checked.' })
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt() }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe('This area was only partially checked.')
  })

  it('keeps recorded checks when only the other source is unavailable', () => {
    const search = card()
    const recorded = (id: string, checkId: string, responsibility: SearchObservation['responsibility'], source: SearchObservation['source'], disposition: SearchObservation['disposition']) =>
      observation({ id, checkId, responsibility, source, disposition, reason: 'recorded' })
    const missing = (id: string, checkId: string, responsibility: SearchObservation['responsibility'], reason: string) =>
      observation({ id, checkId, responsibility, source: 'rendered-dom', disposition: 'unknown', reason })
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [
      recorded('title', 'title-missing', 'presentation', 'original-html', 'passed'),
      missing('title-rendered', 'title-missing', 'presentation', 'document_truncated'),
      recorded('description', 'description-missing', 'presentation', 'original-html', 'passed'),
      missing('description-rendered', 'description-missing', 'presentation', 'document_truncated'),
      recorded('canonical', 'search-canonical-invalid', 'canonical', 'http', 'passed'),
      missing('canonical-rendered', 'search-canonical-invalid', 'canonical', 'document_truncated'),
      recorded('indexing', 'search-indexing-source', 'indexing', 'original-html', 'observed'),
      missing('indexing-rendered', 'search-indexing-source', 'indexing', 'required_evidence_unavailable'),
      recorded('markup', 'search-structured-invalid', 'structured-data', 'original-html', 'passed'),
      missing('markup-rendered', 'search-structured-invalid', 'structured-data', 'capture_unavailable'),
      observation(),
    ] }) }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Crawl access')
  })

  it('records the captured source when the rendered copy is the only gap', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [
      observation({ id: 'title', checkId: 'title-missing', responsibility: 'presentation', source: 'original-html', disposition: 'passed', reason: 'title_present' }),
      observation({ id: 'title-rendered', checkId: 'title-missing', responsibility: 'presentation', source: 'rendered-dom', disposition: 'unknown', reason: 'document_truncated' }),
    ] }) }], false, now)
    expect(search).toMatchObject({ state: 'healthy', answer: SITE_PRESENTATION_COPY.flags(0), detail: null, incompleteReason: null })
    expect(JSON.stringify(search)).not.toContain('Google’s indexed version')
  })

  it('does not treat a missing rendered title as passed when no source recorded it', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [
      observation({ id: 'title-rendered', checkId: 'title-missing', responsibility: 'presentation', source: 'rendered-dom', disposition: 'unknown', reason: 'document_truncated' }),
    ] }) }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(SITE_BOARD_COPY.cardCheckIncomplete)
    expect(search.incompleteReason).not.toContain('Search presentation')
  })

  it('does not offer recovery while evidence is still arriving', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search-crawl', detail: receipt({ complete: false, observations: [observation()] }) }], true, now)
    expect(search.activity).toBe('checking')
    expect(search.incompleteReason).toBeNull()
  })
})

describe('Clear category results', () => {
  function trackingResult(overrides: Partial<SiteCheckResult> = {}): SiteCheckResult {
    return { id: 'request', auditId: 'a', area: 'tracking', name: 'Event request', kind: 'assertion', status: 'observed',
      pageUrl, checkedAt: collectedAt, historical: false, limitation: '', source: 'browser-network',
      evidenceReference: { auditId: 'a', executionId: 'e', pageUrl }, assertionKey: 'tracking-initiation',
      observation: '1 request attempt to example.com/collect during page loading. Payloads, identifiers and event values were not retained.',
      ...overrides }
  }
  function project(card: BoardCardView, summaryResults: SiteCheckResult[]) {
    applyCardEvidence({ cards: [card], audit: null, summaryResults, inFlight: false, pageCount: 1, connections: null, connectionNotes: {}, now })
  }

  it('reports zero Flags when Tracking observed requests and found none', () => {
    const tracking = card({ id: 'tracking', name: 'Tracking', state: 'unknown', answer: 'Couldn’t verify', evidenced: false, checkedAt: collectedAt })
    project(tracking, [trackingResult()])
    expect(tracking).toMatchObject({ state: 'healthy', answer: SITE_PRESENTATION_COPY.flags(0), detail: null, openFlagCount: 0 })
    expect(tracking.facts.join(' ')).toContain('do not prove delivery')
    expect(`${tracking.answer} ${tracking.detail ?? ''}`).not.toContain('retained')
  })

  it('does not turn an unverified or stale Tracking check into zero Flags', () => {
    const unverified = card({ id: 'tracking', name: 'Tracking', state: 'unknown', answer: 'Couldn’t verify', evidenced: false, checkedAt: collectedAt })
    project(unverified, [trackingResult({ status: 'unknown', observation: 'No recognized event collection request was observed.' })])
    expect(unverified.state).toBe('unknown')
    expect(unverified.answer).not.toBe(SITE_PRESENTATION_COPY.flags(0))
    expect(unverified.detail).toBeNull()

    const stale = card({ id: 'tracking', name: 'Tracking', state: 'unknown', answer: 'Couldn’t verify', evidenced: false, checkedAt: '2020-01-01T00:00:00.000Z' })
    project(stale, [trackingResult()])
    expect(stale).toMatchObject({ state: 'unknown', answer: 'Couldn’t verify' })
  })

  it('keeps an open Tracking Flag ahead of the request observation', () => {
    const tracking = card({ id: 'tracking', name: 'Tracking', state: 'problem', answer: 'A tracking destination returned an HTTP error', openFlagCount: 1, checkedAt: collectedAt })
    project(tracking, [trackingResult()])
    expect(tracking).toMatchObject({ state: 'problem', answer: 'A tracking destination returned an HTTP error', openFlagCount: 1 })
  })
})
