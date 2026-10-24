import { describe, expect, it } from 'vitest'
import { projectPageResults } from '../page-results'
import { readWorkspaceLocation, siteWorkspaceHref } from '../workspace-location'
import { projectSiteBoard } from '../board-view'
import { siteFlagFixture, siteViewFixture } from './site-view-fixture'

const root = 'https://example.com/'
const pricing = 'https://example.com/pricing'
describe('workspace projections', () => {
  it('keeps one shared Flag on each affected page with only that page’s capture', () => {
    const shared = siteFlagFixture({ affectedPaths: [root, pricing] })
    const pages = projectPageResults([{ url: root, title: 'Home', status: 'COMPLETED', checkedAt: '2026-10-24T12:00:00Z',
      capture: { url: '/api/screenshots/home', viewport: 'desktop', recordedAt: null } }], [shared])
    expect(pages).toHaveLength(2)
    expect(pages.map(page => page.flags.map(flag => flag.id))).toEqual([['flag-1'], ['flag-1']])
    expect(pages[0].capture?.src).toBe('/api/screenshots/home')
    expect(pages[1]).toMatchObject({ status: 'UNKNOWN', capture: null })
    expect(shared.affectedPaths).toEqual([root, pricing])
  })
  it('disambiguates recorded query and host identity without inventing page evidence', () => {
    const urls = ['https://example.com/pricing?plan=a', 'https://example.com/pricing?plan=b', 'https://other.example/pricing']
    const pages = projectPageResults(urls.map(url => ({ url, title: null, status: 'FAILED', checkedAt: '2026-10-24T12:00:00Z' })), [])
    expect(pages.map(page => page.label)).toEqual(['example.com/pricing?plan=a', 'example.com/pricing?plan=b', 'other.example/pricing'])
    expect(pages.every(page => page.capture === null && page.flags.length === 0)).toBe(true)
    expect(projectPageResults([], [siteFlagFixture({ pageUrl: null, affectedPaths: [] })])).toEqual([])
  })
  it('parses only supported navigation and bounded Flag identity', () => {
    expect(readWorkspaceLocation(new URLSearchParams('view=pages&category=performance&flag=one'))).toEqual({ viewMode: 'pages', selectedCard: null, selectedFlag: 'one' })
    expect(readWorkspaceLocation(new URLSearchParams({ view: 'unknown', category: 'unknown', flag: 'x'.repeat(201) }))).toEqual({ viewMode: 'home', selectedCard: null, selectedFlag: null })
    expect(siteWorkspaceHref('site with space', 'pages')).toBe('/sites/site%20with%20space?view=pages#pages')
    expect(siteWorkspaceHref('one', 'settings')).toBe('/sites/one/settings')
  })
  it('distinguishes same-day checks and keeps incomplete observations as gaps', () => {
    const view = siteViewFixture()
    view.monitoringTrend = [
      { checkedAt: '2026-10-24T12:00:00Z', flagCount: 5, scope: 'SITE', evidenceAt: '2026-10-24T12:00:00Z', completionState: 'COMPLETED' },
      { checkedAt: '2026-10-24T12:05:00Z', flagCount: 0, scope: 'SITE', evidenceAt: '2026-10-24T12:05:00Z', completionState: 'PARTIAL' },
      { checkedAt: '2026-10-24T12:10:00Z', flagCount: 0, scope: 'CATEGORY', evidenceAt: '2026-10-24T12:10:00Z', completionState: 'COMPLETED' },
    ]
    const { monitoringPoints } = projectSiteBoard(view, view.site.siteId, true, false, null)
    expect(monitoringPoints).toHaveLength(2)
    expect(monitoringPoints[0].label).not.toBe(monitoringPoints[1].label)
    expect(monitoringPoints.map(point => point.flagCount)).toEqual([5, null])
    expect(monitoringPoints.every(point => point.label.includes('UTC'))).toBe(true)
  })
})
