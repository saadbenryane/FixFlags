import { describe, expect, it } from 'vitest'
import { readSiteHomeView } from '../site-view-contract'
import { siteViewFixture } from './site-view-fixture'
import { buildBoardCards } from '../board-card'
import { categoryExecutionRecovery, executionRecovery } from '../execution-recovery'

describe('authoritative Site refresh contract', () => {
  it.each([
    { name: 'no recovery actions', recorded: [] },
    { name: 'one blocked protected form', recorded: [{ kind: 'flow', state: 'BLOCKED', reason: 'PROTECTED_ACTION_REQUIRES_FIXTURE' }] },
  ])('round-trips the actual sparse category recovery producer with $name', ({ recorded }) => {
    const fixture = siteViewFixture()
    fixture.executionProgress = { total: recorded.length, completed: 0, running: 0, pending: 0, recovering: 0,
      unknown: recorded.length, inapplicable: 0, recoveryUntil: null, eventCursor: null, tasks: [],
      recovery: executionRecovery(recorded), categoryRecovery: categoryExecutionRecovery(recorded) }
    expect(readSiteHomeView(JSON.parse(JSON.stringify(fixture)), 'fixture-site')).toEqual(fixture)
  })

  it('rejects unknown categories and malformed present recovery actions', () => {
    const fixture = siteViewFixture()
    const executionProgress = { total: 0, completed: 0, running: 0, pending: 0, recovering: 0,
      unknown: 0, inapplicable: 0, recoveryUntil: null, eventCursor: null, tasks: [] }
    for (const categoryRecovery of [
      { invented: { action: 'retry', reasons: [] } }, { site: { action: 'pretend_success', reasons: [] } },
      { site: { action: 'retry', reasons: 'unknown' } }, { site: null },
    ]) expect(() => readSiteHomeView({ ...fixture, executionProgress: { ...executionProgress, categoryRecovery } }, 'fixture-site')).toThrow()
  })

  it('preserves the physical action identity separately from a grouped incident link', () => {
    const fixture = siteViewFixture()
    fixture.cards = buildBoardCards({ siteId: 'fixture-site', inFlight: false, hasLastKnown: false,
      health: { state: 'unknown', answer: 'Not verified', statusLabel: 'Not verified' }, coverageByArea: new Map(),
      flags: [], outcomes: [], pageCount: 0, captureUrl: null, checkedAt: null })
    fixture.cards[0].flagChips = [{ id: 'incident', sourceFlagId: 'captured-flag', title: 'Recorded problem', href: '/sites/fixture-site/flags/incident', priorityBand: 'fix_first', repairGuidanceReady: false, repairGuidance: 'pending' }]
    expect(readSiteHomeView(fixture, 'fixture-site').cards[0].flagChips).toEqual(fixture.cards[0].flagChips)
    expect(() => readSiteHomeView({ ...fixture, cards: [{ ...fixture.cards[0], flagChips: [{ ...fixture.cards[0].flagChips[0], repairGuidanceReady: 'yes' }] }] }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, cards: [{ ...fixture.cards[0], flagChips: [{ ...fixture.cards[0].flagChips[0], priorityBand: 'invented' }] }] }, 'fixture-site')).toThrow()
  })
  it('reads older delivery labels conservatively as provider acceptance', () => {
    const fixture = siteViewFixture()
    const view = readSiteHomeView({ ...fixture, watch: { ...fixture.watch, alert: {
      ...fixture.watch.alert, status: 'SENT', attempts: 1, state: 'delivered',
    } } }, 'fixture-site')
    expect(view.watch.alert.state).toBe('accepted')
  })
  it('preserves scoped check history and rejects invalid scope metadata', () => {
    const fixture = siteViewFixture()
    const entry = { evidenceAt: '2026-10-11T09:00:00Z', flags: [], completionState: 'COMPLETED' as const, id: 'check-1', checkedAt: '2026-10-11T09:00:00Z', flagCount: 0, status: 'COMPLETED' as const,
      scope: 'OUTCOMES' as const, targetLabel: 'Reach checkout', trigger: 'MANUAL' as const, afterFix: true, result: 'CLEAR' as const }
    fixture.monitoringHistory = [entry]
    expect(readSiteHomeView(fixture, 'fixture-site').monitoringHistory).toEqual([entry])
    expect(() => readSiteHomeView({ ...fixture, monitoringHistory: [{ ...entry, scope: 'everything' }] }, 'fixture-site')).toThrow()
  })
  it('requires the current version and complete scope metadata on new history entries', () => {
    const fixture = siteViewFixture()
    expect(() => readSiteHomeView({ ...fixture, schemaVersion: 1 }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, monitoringHistory: [{ checkedAt: '2026-10-11T09:00:00Z', flagCount: 0 }] }, 'fixture-site')).toThrow()
  })
  it('accepts a complete view and restores Site schedule dates from the wire', () => {
    const fixture = siteViewFixture()
    fixture.site.watchNextRunAt = new Date('2026-10-11T10:00:00Z')
    expect(readSiteHomeView(JSON.parse(JSON.stringify(fixture)), 'fixture-site')).toEqual(fixture)
  })
  it('rejects missing state, malformed nested state, and mismatched identities', () => {
    expect(() => readSiteHomeView({ audit: {}, outcomes: [] }, 'fixture-site')).toThrow()
    const fixture = siteViewFixture()
    expect(() => readSiteHomeView({ ...fixture, outcomes: [{ ...fixture.outcomes[0], running: 'yes' }] }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView(fixture, 'another-site')).toThrow('identity mismatch')
    expect(() => readSiteHomeView({ ...fixture, watch: { ...fixture.watch, nextRunAt: 'not-a-time' } }, 'fixture-site')).toThrow()
  })
  it('validates optional Uptime and capture projections without changing older views', () => {
    const fixture = siteViewFixture()
    fixture.uptime = { enabled: true, targetUrl: fixture.site.url, state: 'unknown', lastCheckedAt: null, nextCheckAt: null, openIncidentCount: 0,
      segments: [{ startAt: '2026-10-12T10:00:00Z', endAt: '2026-10-12T10:30:00Z', state: 'unknown', checked: 0, expected: 6 }] }
    fixture.captures = [{ auditId: 'prior-audit', device: 'desktop', previous: true, url: '/api/screenshots/prior-audit/desktop', pageUrl: fixture.site.url, viewport: '1280 × 720', recordedAt: null }]
    expect(readSiteHomeView(fixture, 'fixture-site')).toEqual(fixture)
    expect(() => readSiteHomeView({ ...fixture, uptime: { ...fixture.uptime, state: '100%' } }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, captures: [{ ...fixture.captures![0], device: 'tablet' }] }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, uptime: { ...fixture.uptime, segments: [{ ...fixture.uptime!.segments[0], checked: -1 }] } }, 'fixture-site')).toThrow()
  })

  it('retains page captures across refresh and rejects unsafe URLs or invalid capture times', () => {
    const fixture = siteViewFixture()
    fixture.checkedPages = [
      { url: fixture.site.url, title: 'Home', status: 'COMPLETED', checkedAt: '2026-10-12T10:00:00Z', capture: { url: '/api/screenshots/fixture-audit/desktop?page=home', viewport: '1280 × 720', recordedAt: '2026-10-12T10:00:00Z' } },
      { url: 'https://example.com/contact', title: 'Contact', status: 'PARTIAL', checkedAt: '2026-10-12T10:00:00Z', capture: null },
    ]
    expect(readSiteHomeView(JSON.parse(JSON.stringify(fixture)), 'fixture-site').checkedPages).toEqual(fixture.checkedPages)
    const page = fixture.checkedPages[0]
    expect(() => readSiteHomeView({ ...fixture, checkedPages: [{ ...page, capture: { ...page.capture, url: 'javascript:alert(1)' } }] }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, checkedPages: [{ ...page, capture: { ...page.capture, recordedAt: 'unknown' } }] }, 'fixture-site')).toThrow()
  })

})
