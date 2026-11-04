import { expect, it } from 'vitest'
import { projectPageResults } from '../page-results'
import { siteFlagFixture } from './site-view-fixture'

const home = 'https://example.com/'
const pricing = 'https://example.com/pricing'
const contact = 'https://example.com/contact'

it('keeps recorded order, the first capture, and incomplete evidence when inventory records overlap', () => {
  const recorded = [
    { url: home, title: 'Original home', status: 'PARTIAL', checkedAt: '2026-11-03T12:00:00Z',
      capture: { url: '/api/screenshots/first', viewport: 'desktop', recordedAt: null } },
    { url: pricing, title: 'Pricing', status: 'COMPLETED', checkedAt: '2026-11-03T12:00:00Z' },
    { url: home, title: 'Later home', status: 'COMPLETED', checkedAt: '2026-11-03T12:00:00Z',
      capture: { url: '/api/screenshots/later', viewport: 'mobile', recordedAt: null } },
  ]
  const result = projectPageResults(recorded, [siteFlagFixture({ affectedPaths: [contact, home, contact] })])
  expect(result.map(page => page.url)).toEqual([home, pricing, contact])
  expect(result[0]).toMatchObject({ status: 'PARTIAL', capture: { src: '/api/screenshots/first', alt: 'Original home' } })
  expect(result[1]).toMatchObject({ status: 'COMPLETED', capture: null, flags: [] })
  expect(result[2]).toMatchObject({ status: 'UNKNOWN', capture: null })
  expect(result.map(page => page.flags.map(flag => flag.id))).toEqual([['flag-1'], [], ['flag-1']])
})

it('keeps priority and stable ties on every affected page without changing input order', () => {
  const common = { affectedPaths: [home, pricing], latestOccurrenceAt: '2026-11-03T12:00:00Z' }
  const flags = [
    siteFlagFixture({ ...common, id: 'lower', priorityScore: 10 }),
    siteFlagFixture({ ...common, id: 'earlier', priorityScore: 100, latestOccurrenceAt: '2026-11-01T12:00:00Z' }),
    siteFlagFixture({ ...common, id: 'first-tie', priorityScore: 100 }),
    siteFlagFixture({ ...common, id: 'second-tie', priorityScore: 100 }),
  ]
  const original = structuredClone(flags)
  const result = projectPageResults([], flags)
  expect(result.map(page => page.flags.map(flag => flag.id))).toEqual([
    ['first-tie', 'second-tie', 'earlier', 'lower'], ['first-tie', 'second-tie', 'earlier', 'lower'],
  ])
  expect(flags).toEqual(original)
})

it('uses each finding’s selected page scope and keeps an unlocated finding out of invented pages', () => {
  const flags = [
    siteFlagFixture({ id: 'scoped', pageUrl: home, affectedPaths: [pricing] }),
    siteFlagFixture({ id: 'fallback', pageUrl: contact, affectedPaths: [] }),
    siteFlagFixture({ id: 'unlocated', pageUrl: null, affectedPaths: [] }),
  ]
  const result = projectPageResults([], flags)
  expect(result.map(page => [page.url, page.flags.map(flag => flag.id)])).toEqual([
    [pricing, ['scoped']], [contact, ['fallback']],
  ])
  expect(result.every(page => page.status === 'UNKNOWN' && page.capture === null)).toBe(true)
})

it('disambiguates hosts, queries, and fragments only across distinct recorded addresses', () => {
  const urls = ['https://example.com/pricing?plan=a#top', 'https://example.com/pricing?plan=b#form', 'https://other.example/pricing', '/recorded-relative']
  const checked = urls.map(url => ({ url, title: null, status: 'FAILED', checkedAt: '2026-11-03T12:00:00Z' }))
  expect(projectPageResults(checked, []).map(page => page.label)).toEqual([
    'example.com/pricing?plan=a#top', 'example.com/pricing?plan=b#form', 'other.example/pricing', '/recorded-relative',
  ])
  expect(projectPageResults([checked[0], checked[0]], [siteFlagFixture({ affectedPaths: [urls[0], urls[0]] })])[0].label).toBe('/pricing')
})
