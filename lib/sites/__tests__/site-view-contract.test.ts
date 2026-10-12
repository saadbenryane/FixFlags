import { describe, expect, it } from 'vitest'
import { readSiteHomeView } from '../site-view-contract'
import { siteViewFixture } from './site-view-fixture'

describe('authoritative Site refresh contract', () => {
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
    expect(() => readSiteHomeView({ ...fixture, captures: [{ ...fixture.captures[0], device: 'tablet' }] }, 'fixture-site')).toThrow()
    expect(() => readSiteHomeView({ ...fixture, uptime: { ...fixture.uptime, segments: [{ ...fixture.uptime!.segments[0], checked: -1 }] } }, 'fixture-site')).toThrow()
  })

})
