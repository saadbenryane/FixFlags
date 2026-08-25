import { describe, expect, it } from 'vitest'
import { DOCS_PAGES, slugifyDocsHeading } from '@/lib/docs/catalog'

describe('documentation catalog', () => {
  it('defines every public docs route once', () => {
    expect(DOCS_PAGES.map((page) => page.path)).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/reports',
      '/docs/deep-review',
      '/docs/troubleshooting',
    ])
    expect(new Set(DOCS_PAGES.map((page) => page.path)).size).toBe(DOCS_PAGES.length)
  })

  it('creates stable heading anchors', () => {
    expect(slugifyDocsHeading('Update review & Compare')).toBe('update-review-and-compare')
  })
})
