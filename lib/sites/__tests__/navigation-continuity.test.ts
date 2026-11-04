import { describe, expect, it } from 'vitest'
import { parseSiteContinuation, SITE_CONTINUATION_LIFETIME_MS, siteNavigationRoot } from '../navigation-continuity'

const current = new URL('https://fixflags.com/sites/site-1?category=accessibility')
const state = { version: 1, destination: current.pathname + current.search, recordedAt: 1000,
  x: 0, y: 420, dialogTop: 180, focus: 'check' }
describe('browser-local Site continuation contract', () => {
  it('retains only a current exact destination with bounded coordinates', () => {
    expect(parseSiteContinuation(JSON.stringify(state), current, 1001)).toEqual(state)
    expect(siteNavigationRoot('/sites/site-1/flags/flag-1')).toBe('/sites/site-1')
    expect(siteNavigationRoot('/sign-in')).toBeNull()
  })
  it.each([true, false])('retains the check disclosure state: %s', checkDetailsOpen => {
    const saved = { ...state, checkDetailsOpen }
    expect(parseSiteContinuation(JSON.stringify(saved), current, 1001)).toEqual(saved)
  })
  it.each([
    { destination: 'https://other.example/sites/site-1?category=accessibility' },
    { destination: '/sites/another?category=accessibility' }, { destination: '/sites/site-1?category=pages' },
    { x: -1 }, { y: '420' }, { dialogTop: -1 }, { focus: '[arbitrary-selector]' }, { version: 2 },
    { checkDetailsOpen: 'open' }, { checkDetailsOpen: [] },
  ])('rejects another scope or malformed state: %j', change => {
    expect(parseSiteContinuation(JSON.stringify({ ...state, ...change }), current, 1001)).toBeNull()
  })
  it('rejects stale, future and unreadable state', () => {
    expect(parseSiteContinuation(JSON.stringify(state), current, 1001 + SITE_CONTINUATION_LIFETIME_MS)).toBeNull()
    expect(parseSiteContinuation(JSON.stringify(state), current, 999)).toBeNull()
    expect(parseSiteContinuation('{invalid', current, 1001)).toBeNull()
    expect(parseSiteContinuation('null', current, 1001)).toBeNull()
  })
})
