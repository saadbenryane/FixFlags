import { describe, expect, it } from 'vitest'
import { discoverCriticalPathUrls } from '@/lib/audit/critical-path'
import { runCorridorConsistencyChecks } from '@/lib/audit/checks/corridor-consistency'
import type { PageMetadata } from '@/lib/audit/metadata'

function meta(links: Array<{ href: string; text: string }>): PageMetadata {
  return {
    title: 'Home',
    description: null,
    ogTitle: 'Home OG',
    ogDescription: 'Shared description',
    ogImage: null,
    links,
  } as PageMetadata
}

describe('discoverCriticalPathUrls', () => {
  it('ranks pricing ahead of resources', () => {
    const pages = discoverCriticalPathUrls('https://example.com/', meta([
      { href: '/blog', text: 'Blog' },
      { href: '/pricing', text: 'Pricing' },
      { href: '/docs', text: 'Docs' },
    ]))
    expect(pages[0].category).toBe('primary')
    expect(pages.some((p) => p.category === 'pricing')).toBe(true)
  })
})

describe('runCorridorConsistencyChecks', () => {
  it('flags identical og titles across corridor pages', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Same Title',
        ogDescription: 'A',
        title: 'Same Title',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Same Title',
        ogDescription: 'B',
        title: 'Same Title',
      },
    ])
    expect(flags.some((f) => f.checkId === 'corridor-og-title-drift')).toBe(true)
  })

  it('passes when titles differ', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Home',
        ogDescription: 'Home desc that is long enough',
        title: 'Home',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Pricing',
        ogDescription: 'Pricing desc that is long enough',
        title: 'Pricing',
      },
    ])
    expect(flags).toHaveLength(0)
  })
})
