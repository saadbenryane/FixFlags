import { describe, expect, it } from 'vitest'
import { readSiteHomeView } from '../site-view-contract'
import { siteViewFixture } from './site-view-fixture'

describe('authoritative Site refresh contract', () => {
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
})
