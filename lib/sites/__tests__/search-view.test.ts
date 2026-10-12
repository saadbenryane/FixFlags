import { describe, expect, it } from 'vitest'
import { applySearchCardEvidence } from '../search-view'
import type { BoardCardView } from '../board-card'
import type { SearchObservation, SearchReceipt } from '@/lib/audit/search/contracts'
import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { applyCardEvidence } from '../application/card-evidence'

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
  it('names missing responsibilities even when all recorded parts passed', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search-presentation', detail: receipt() }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.answer).toBe(C.summary.partial)
    expect(search.incompleteReason).toContain('Crawl access')
    expect(search.incompleteReason).toContain('Discovery')
    expect(search.incompleteReason).not.toContain('Google evidence')
  })

  it('keeps a confirmed Flag and discloses the unfinished work beside it', () => {
    const search = card({ state: 'problem', openFlagCount: 1, answer: 'Page title is missing', flagIds: ['f1'] })
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [observation()] }) }], false, now)
    expect(search.incompleteReason).toBe(C.unfinished(['Crawl access']))
    expect(search).toMatchObject({ state: 'problem', answer: 'Page title is missing', openFlagCount: 1, flagIds: ['f1'] })
  })

  it('preserves the Search recovery reason through the complete card projection', () => {
    const search = card()
    const audit = { status: 'COMPLETED', startedAt: now, failureCode: null, failedModules: [], triageAt: now, aiReviewAt: now,
      verifierExecutions: [{ targetKey: 'module:search', detail: receipt({ complete: false, observations: [observation()] }) }] }
    applyCardEvidence({ cards: [search], audit: audit as unknown as Parameters<typeof applyCardEvidence>[0]['audit'],
      summaryResults: [], inFlight: false, pageCount: 1, connections: null, connectionNotes: {}, now })
    expect(search.incompleteReason).toBe(C.unfinished(['Crawl access']))
    expect(search.state).toBe('unknown')
  })

  it('requires complete local evidence for each recorded page', () => {
    const search = card()
    applySearchCardEvidence(search, [
      { targetKey: 'module:search', detail: receipt() },
      { targetKey: 'module:search-crawl', detail: receipt({ pageUrl: pageUrl + 'about' }) },
    ], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toContain('Search presentation')
  })

  it('does not trust a complete receipt with an unknown result', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search', detail: receipt({ observations: [observation()] }) }], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toBe(C.unfinished(['Crawl access']))
  })

  it('does not let a Google receipt satisfy missing local modules', () => {
    const search = card()
    applySearchCardEvidence(search, [
      { targetKey: 'module:search-presentation', detail: receipt() },
      { targetKey: 'module:search-google', detail: receipt({ complete: false, observations: [observation({ responsibility: 'google' })] }) },
    ], false, now)
    expect(search.state).toBe('unknown')
    expect(search.incompleteReason).toContain('Crawl access')
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

  it('does not offer recovery while evidence is still arriving', () => {
    const search = card()
    applySearchCardEvidence(search, [{ targetKey: 'module:search-crawl', detail: receipt({ complete: false, observations: [observation()] }) }], true, now)
    expect(search.activity).toBe('checking')
    expect(search.incompleteReason).toBeNull()
  })
})
