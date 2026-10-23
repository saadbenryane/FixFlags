import { describe, expect, it } from 'vitest'
import { presentObservedEvidence } from '../observed-evidence'

const lcp = [
  'https://saadbenryane.com/journal/what-i-learned-about-branding-at-founder-institute: Mobile Largest Contentful Paint: 4.35s',
  'https://saadbenryane.com/work/global-biodiversity-platform: Mobile Largest Contentful Paint: 6.30s',
  'https://saadbenryane.com/journal/when-ai-codes-the-developer-role-shifts: Mobile Largest Contentful Paint: 4.05s',
  'https://saadbenryane.com/journal?tag=design: Mobile Largest Contentful Paint: 4.24s Observed on 4 pages.',
].join(' ')

describe('presentObservedEvidence', () => {
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
