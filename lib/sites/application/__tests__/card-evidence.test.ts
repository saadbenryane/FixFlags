import { describe, expect, it } from 'vitest'
import { applyCardEvidence } from '../card-evidence'
import type { BoardCardView } from '@/lib/sites/board-card'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { SiteCheckResult } from '@/lib/sites/check-result-contract'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'

const pageUrl = 'https://example.com/'
const now = new Date('2026-10-23T12:00:00Z')
const keyboardReceipt = { kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl,
  applicable: true, passed: false, complete: false, assertions: [], limitation: 'The keyboard inspection reached its control limit.' }
function project(status: string, kind: 'accessibility' | 'tracking' = 'accessibility', trackingDetail: unknown = null) {
  const card: BoardCardView = { id: kind, name: kind === 'accessibility' ? 'Accessibility' : 'Tracking', state: 'unknown',
    status: 'Waiting', question: '', answer: '', detail: null, evidenced: false, openFlagCount: 0, checkedAt: null,
    flagIds: [], flagChips: [], facts: [], coverage: null, sources: [], activity: null, wide: false,
    captureUrl: null, captureAlt: null, cropUrl: null, cropAlt: null, problem: null }
  const audit = { status: 'CHECKING', verifierExecutions: kind === 'accessibility' ? [
    { targetKey: 'task:p0:keyboard-evidence', workKind: 'keyboard', status, pageUrl, updatedAt: now, detail: null },
    ...(status === 'COMPLETED' ? [{ targetKey: 'module:keyboard', status: 'COMPLETED', pageUrl, updatedAt: now, detail: keyboardReceipt }] : []),
  ] : [{ targetKey: 'module:measurement', status: 'COMPLETED', pageUrl, updatedAt: now, detail: trackingDetail }] }
  applyCardEvidence({ cards: [card], audit: audit as unknown as Parameters<typeof applyCardEvidence>[0]['audit'],
    summaryResults: [], inFlight: true, pageCount: 1, connectionNotes: { search: null, tracking: null }, now })
  return card
}
describe('category evidence during a running scan', () => {
  it('stops the keyboard loading state as soon as its own task settles', () => {
    expect(project('RUNNING')).toMatchObject({ activity: 'checking', status: 'Running' })
    const settled = project('COMPLETED')
    expect(settled).toMatchObject({ activity: null, state: 'unknown', status: 'Partially checked', checkedAt: now.toISOString() })
    expect(settled.incompleteReason).toBeTruthy()
    expect(settled.detail).toBe(keyboardReceipt.limitation)
  })
  it('does not call a recorded tracking task healthy while unrelated work is running', () => {
    const recorded = { kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
      applicable: true, passed: true, complete: true, assertions: [] }
    expect(project('COMPLETED', 'tracking', recorded)).toMatchObject({ activity: null, state: 'unknown', status: SITE_ACTION_COPY.execution.checkedStatus })
    expect(project('COMPLETED', 'tracking')).toMatchObject({ activity: null, state: 'unknown', status: SITE_ACTION_COPY.execution.partialStatus })
  })
})

function recordedSources(results: Array<Partial<SiteCheckResult>>, area: BoardCardView['id'] = 'performance', notes = { search: null, tracking: null } as { search: string | null; tracking: string | null }) {
  const card = { ...project('COMPLETED'), id: area, sources: [SITE_BOARD_COPY.browserSource] } as BoardCardView
  applyCardEvidence({ cards: [card], audit: null, summaryResults: results.map((result, index) => ({
    id: String(index), auditId: 'audit', area, name: 'Recorded measurement', kind: 'assertion', status: 'passed',
    pageUrl, checkedAt: now.toISOString(), historical: false, limitation: '', source: 'pagespeed-desktop',
    evidenceReference: { auditId: 'audit', executionId: String(index), pageUrl }, ...result,
  })), inFlight: false, pageCount: 1, connectionNotes: notes, now })
  return card.sources
}

describe('Performance evidence attribution', () => {
  it('names the recorded provider once across devices and observed field data', () => {
    expect(recordedSources([{ source: 'pagespeed-desktop' }, { source: 'pagespeed-mobile' },
      { source: 'pagespeed-mobile', status: 'observed' }])).toEqual([SITE_BOARD_COPY.pageSpeedSource])
  })
  it('retains independently observed browser work alongside provider measurements', () => {
    expect(recordedSources([{ source: 'rendered-dom', status: 'findings' }, { source: 'pagespeed-desktop' }]))
      .toEqual([SITE_BOARD_COPY.browserSource, SITE_BOARD_COPY.pageSpeedSource])
  })
  it('does not attribute missing, historical or execution-only measurements to a provider', () => {
    expect(recordedSources([{ status: 'unknown' }, { historical: true }, { kind: 'execution', status: 'completed' }])).toEqual([])
    expect(recordedSources([{ status: 'unknown' }, { source: 'rendered-dom' }])).toEqual([SITE_BOARD_COPY.browserSource])
  })
  it('keeps an observed failing measurement attributable without inventing provenance for an old source', () => {
    expect(recordedSources([{ status: 'findings' }])).toEqual([SITE_BOARD_COPY.pageSpeedSource])
    expect(recordedSources([{ source: 'DETERMINISTIC' }])).toEqual([])
  })
})

describe('recorded card sources', () => {
  it('distinguishes native HTTP evidence from rendered evidence', () => {
    expect(recordedSources([{ source: 'http' }], 'security')).toEqual([SEARCH_COPY.sources.http])
    expect(recordedSources([{ source: 'original-html' }], 'security')).toEqual([SEARCH_COPY.sources['original-html']])
    expect(recordedSources([{ source: 'http' }, { source: 'rendered-dom' }], 'conversion'))
      .toEqual([SEARCH_COPY.sources.http, SITE_BOARD_COPY.browserSource])
  })
  it('does not turn a prior label or absent observation into analytics evidence', () => {
    expect(recordedSources([], 'tracking')).toEqual([])
    expect(recordedSources([{ source: 'browser-network', status: 'observed' }], 'tracking')).toEqual([SITE_BOARD_COPY.browserSource])
  })
  it('attributes measured provider context even when a later connection state is unavailable', () => {
    expect(recordedSources([], 'tracking', { search: null, tracking: 'Previously reported traffic, provider unavailable.' }))
      .toEqual([SITE_BOARD_COPY.analyticsSource])
    expect(recordedSources([], 'search', { search: 'Previously reported impressions.', tracking: null }))
      .toEqual([SITE_BOARD_COPY.searchConsoleSource])
  })
})
