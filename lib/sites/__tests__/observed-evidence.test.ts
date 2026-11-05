import { describe, expect, it } from 'vitest'
import { presentObservedEvidence } from '../observed-evidence'

const lcp = [
  'https://saadbenryane.com/journal/what-i-learned-about-branding-at-founder-institute: Mobile Largest Contentful Paint: 4.35s',
  'https://saadbenryane.com/work/global-biodiversity-platform: Mobile Largest Contentful Paint: 6.30s',
  'https://saadbenryane.com/journal/when-ai-codes-the-developer-role-shifts: Mobile Largest Contentful Paint: 4.05s',
  'https://saadbenryane.com/journal?tag=design: Mobile Largest Contentful Paint: 4.24s Observed on 4 pages.',
].join(' ')

describe('presentObservedEvidence', () => {
  it('distinguishes hash-routed pages without dropping their query or recorded address', () => {
    const pricing = 'https://example.com/app/?lang=en#/pricing'
    const checkout = 'https://example.com/app/?lang=en#/checkout'
    const presented = presentObservedEvidence(`${pricing}: LCP: 4s ${checkout}: LCP: 5s`)
    expect(presented).toMatchObject({ kind: 'pages', pages: [
      { url: checkout, label: '/app/?lang=en#/checkout', valueLabel: '5s', share: 1 },
      { url: pricing, label: '/app/?lang=en#/pricing', valueLabel: '4s', share: 0.8 },
    ] })
  })

  it('keeps the full recorded context when page measurements follow an introduction', () => {
    const text = `Comparison conditions could not be confirmed. ${lcp}`
    expect(presentObservedEvidence(text)).toEqual({ kind: 'text', text })
  })

  it('interprets grouped digits as complete values while retaining their recorded formatting', () => {
    const presented = presentObservedEvidence('https://example.com/a: First Contentful Paint: 1,200ms https://example.com/b: First Contentful Paint: 1,500ms')
    expect(presented).toMatchObject({ kind: 'pages', summary: 'First Contentful Paint: 1,200ms to 1,500ms.' })
    if (presented.kind !== 'pages') return
    expect(presented.pages.map(page => [page.label, page.valueLabel, page.share])).toEqual([
      ['/b', '1,500ms', 1], ['/a', '1,200ms', 0.8],
    ])
  })

  it.each([
    ['-1', '-2'], ['−1', '−2'], ['- 1', '- 2'], ['1,20', '1,50'], ['1 200', '1 500'], ['1\u202f200', '1\u202f500'], ['9'.repeat(320), '2'],
  ])('does not turn ambiguous or invalid measurements into ranked positive values: %j', (first, second) => {
    const presented = presentObservedEvidence(`https://example.com/a: LCP: ${first}s https://example.com/b: LCP: ${second}s`)
    expect(presented.kind).toBe('pages')
    if (presented.kind !== 'pages') return
    expect(presented.pages.map(page => [page.valueLabel, page.share])).toEqual([[null, null], [null, null]])
    expect(presented.pages.map(page => page.note)).toEqual([`LCP: ${first}s`, `LCP: ${second}s`])
  })

  it('leaves a sentence untouched', () => {
    expect(presentObservedEvidence('Controls have no accessible name')).toEqual({
      kind: 'text', text: 'Controls have no accessible name',
    })
  })

  it('leaves one recorded page as the original text', () => {
    const text = 'https://saadbenryane.com/: Mobile Largest Contentful Paint: 4.35s'
    expect(presentObservedEvidence(text)).toEqual({ kind: 'text', text })
  })

  it('summarizes a repeated measurement and lists the slowest page first', () => {
    const presented = presentObservedEvidence(lcp)
    expect(presented).toMatchObject({
      kind: 'pages',
      summary: 'Mobile Largest Contentful Paint: 4.05s to 6.30s.',
      trailing: 'Observed on 4 pages.',
    })
    if (presented.kind !== 'pages') return
    expect(presented.pages.map(page => [page.label, page.valueLabel])).toEqual([
      ['/work/global-biodiversity-platform', '6.30s'],
      ['/journal/what-i-learned-about-branding-at-founder-institute', '4.35s'],
      ['/journal?tag=design', '4.24s'],
      ['/journal/when-ai-codes-the-developer-role-shifts', '4.05s'],
    ])
  })
})
