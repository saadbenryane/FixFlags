import { describe, expect, it } from 'vitest'
import { analyticsReportScope, searchReportScope } from '../connections/report-scope'
import {
  cardContext,
  chooseAnalyticsProperty,
  chooseSearchProperty,
  contextLinesForPage,
  factsFromAnalyticsRows,
  factsFromAnalyticsAudience,
  factsFromSearchRows,
} from '@/lib/sites/connections/match'

describe('Site connection matching', () => {
  it('matches a Search Console property only when the host is the same Site', () => {
    const properties = [
      { siteUrl: 'sc-domain:other.example' },
      { siteUrl: 'https://www.shop.example/' },
    ]
    expect(chooseSearchProperty(properties, 'shop.example')).toBe('https://www.shop.example/')
    expect(chooseSearchProperty([{ siteUrl: 'sc-domain:shop.example' }], 'shop.example')).toBe('sc-domain:shop.example')
    expect(chooseSearchProperty(properties, 'other.example')).toBe('sc-domain:other.example')
  })

  it('matches Analytics only through a stream on the Site host', () => {
    const match = chooseAnalyticsProperty([
      { propertyId: 'properties/1', label: 'Other', streamUrls: ['https://other.example'] },
      { propertyId: 'properties/2', label: 'Shop', streamUrls: ['https://shop.example/'] },
    ], 'www.shop.example')
    expect(match?.propertyId).toBe('properties/2')
    expect(chooseAnalyticsProperty([
      { propertyId: 'properties/1', label: 'Other', streamUrls: ['https://other.example'] },
    ], 'shop.example')).toBeNull()
  })

  it('keeps provider numbers as page context and off the verdict', () => {
    const facts = [
      ...factsFromSearchRows([{ keys: ['https://shop.example/pricing', 'plans'], clicks: 4, impressions: 80, position: 6 }], searchReportScope('shop.example', 'sc-domain:shop.example')),
      ...factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12 }], analyticsReportScope('shop.example', 'properties/1')),
    ]
    const lines = contextLinesForPage(facts, 'https://shop.example/pricing/')
    expect(lines.join(' ')).toContain('80 impressions')
    expect(lines.join(' ')).toContain('12 sessions')
    expect(lines.join(' ').toLowerCase()).not.toContain('clear')
    expect(cardContext(facts).search).toContain('plans')
    expect(cardContext(facts).tracking).toContain('1 recorded page')
  })

  it('ignores rows that are not tied to a page', () => {
    expect(factsFromSearchRows([{ keys: ['not a url'], clicks: 1, impressions: 1 }])).toEqual([])
  })
  it('rejects sibling, foreign, unscoped and out-of-property Search rows before page paths can lose their origin', () => {
    const scope = searchReportScope('shop.example', 'sc-domain:shop.example')
    const rows = [{ keys: ['https://shop.example/pricing', 'plans'], impressions: 80 },
      { keys: ['https://other.shop.example/pricing', 'other'], impressions: 900 },
      { keys: ['https://shop.example.evil.test/pricing', 'foreign'], impressions: 900 },
      { keys: ['/pricing', 'relative'], impressions: 900 },
      { keys: ['https://user@shop.example/pricing', 'credentials'], impressions: 900 }]
    const facts = factsFromSearchRows(rows, scope)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ impressions: 80, clicks: null, reportScope: { pageUrl: 'https://shop.example/pricing' } })
    expect(factsFromSearchRows(rows)).toEqual([])
    expect(factsFromSearchRows(rows, searchReportScope('shop.example', 'https://shop.example/blog/'))).toEqual([])
    expect(contextLinesForPage(facts, 'https://other.shop.example/pricing')).toEqual([])
    expect(contextLinesForPage(facts, '/pricing')).toEqual([])
    const line = contextLinesForPage(facts, 'https://www.shop.example/pricing').join(' ')
    expect(line).toContain('80 impressions')
    expect(line).not.toContain('0 clicks')
    expect(cardContext(facts).search).not.toContain('0 clicks')
    const missing = factsFromSearchRows([{ keys: ['https://shop.example/pricing', 'plans'] }], scope)
    expect(contextLinesForPage(missing, 'https://shop.example/pricing')).toEqual([])
    expect(cardContext(missing).search).toBeNull()
    const zero = factsFromSearchRows([{ keys: ['https://shop.example/pricing', 'plans'], impressions: 0, clicks: 0 }], scope)
    expect(contextLinesForPage(zero, 'https://shop.example/pricing').join(' ')).toContain('0 impressions and 0 clicks')
  })
  it('does not present unscoped, missing or other-host Analytics counts as page traffic', () => {
    const scope = analyticsReportScope('shop.example', 'properties/1')
    const scoped = factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12 }], scope)
    expect(contextLinesForPage(scoped, 'https://other.example/pricing')).toEqual([])
    expect(contextLinesForPage(scoped, '/pricing')).toEqual([])
    expect(contextLinesForPage(factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12 }]), 'https://shop.example/pricing')).toEqual([])
    const missing = factsFromAnalyticsRows([{ pagePath: '/pricing' }], scope)
    expect(contextLinesForPage(missing, 'https://shop.example/pricing')).toEqual([])
    expect(cardContext(missing).tracking).toBeNull()
    expect(cardContext([...scoped, ...factsFromAnalyticsRows([{ pagePath: '/', sessions: 12 }], scope)]).tracking).toContain('2 recorded pages')
    const audience = factsFromAnalyticsAudience({ sessions: 12, activeUsers: 3 }, scope)
    expect(cardContext([...scoped, ...factsFromAnalyticsRows([{ pagePath: '/', sessions: 12 }], scope), ...audience]).tracking).toContain('12 sessions and 3 active users')
    expect(factsFromAnalyticsAudience({}, scope)).toEqual([])
  })
  it('uses genuine page views without relabeling sessions or inventing absent counts', () => {
    const scope = analyticsReportScope('shop.example', 'properties/1')
    const facts = factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12, pageViews: 30 }], scope)
    const line = contextLinesForPage(facts, 'https://shop.example/pricing').join(' ')
    expect(line).toContain('30 page views')
    expect(line).not.toContain('12 page views')
    const sessionOnly = contextLinesForPage(factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12 }], scope), 'https://shop.example/pricing').join(' ')
    expect(sessionOnly).toContain('12 sessions')
    expect(sessionOnly).not.toContain('page views')
    const viewsOnly = factsFromAnalyticsRows([{ pagePath: '/pricing', pageViews: 0 }], scope)
    expect(contextLinesForPage(viewsOnly, 'https://shop.example/pricing').join(' ')).toContain('0 page views')
    expect(cardContext(viewsOnly).tracking).toContain('1 recorded page')
    expect(factsFromAnalyticsAudience({ pageViews: 0 }, scope)).toMatchObject([{ pageViews: 0, sessions: null, activeUsers: null }])
    expect(cardContext(factsFromAnalyticsAudience({ pageViews: 0 }, scope)).tracking).toContain('0 page views')
    const invalid = factsFromAnalyticsRows([{ pagePath: '/pricing', pageViews: -1 }, { pagePath: '/other', pageViews: NaN }], scope)
    expect(cardContext(invalid).tracking).toBeNull()
  })
})
