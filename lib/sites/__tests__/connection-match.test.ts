import { describe, expect, it } from 'vitest'
import {
  cardContext,
  chooseAnalyticsProperty,
  chooseSearchProperty,
  contextLinesForPage,
  factsFromAnalyticsRows,
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
      ...factsFromSearchRows([{ keys: ['https://shop.example/pricing', 'plans'], clicks: 4, impressions: 80, position: 6 }]),
      ...factsFromAnalyticsRows([{ pagePath: '/pricing', sessions: 12 }]),
    ]
    const lines = contextLinesForPage(facts, 'https://shop.example/pricing/')
    expect(lines.join(' ')).toContain('80 impressions')
    expect(lines.join(' ')).toContain('12 sessions')
    expect(lines.join(' ').toLowerCase()).not.toContain('clear')
    expect(cardContext(facts).search).toContain('plans')
    expect(cardContext(facts).tracking).toContain('12 sessions')
  })

  it('ignores rows that are not tied to a page', () => {
    expect(factsFromSearchRows([{ keys: ['not a url'], clicks: 1, impressions: 1 }])).toEqual([])
  })
})
