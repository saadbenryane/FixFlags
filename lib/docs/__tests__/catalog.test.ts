import { describe, expect, it } from 'vitest'
import {
  DOCS_PAGE_DEFINITIONS,
  DOCS_PAGES,
  slugifyDocsHeading,
} from '@/lib/docs/catalog'

describe('documentation catalog', () => {
  it('defines every docs route once', () => {
    const paths = DOCS_PAGE_DEFINITIONS.map((page) => page.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/site-care',
      '/docs/mcp',
      '/docs/troubleshooting',
    ])
  })

  it('publishes a subset of what it defines', () => {
    // A page can be defined and withheld, but never published without a definition.
    for (const page of DOCS_PAGES) {
      expect(DOCS_PAGE_DEFINITIONS).toContain(page)
    }
  })

  it('creates stable heading anchors', () => {
    expect(slugifyDocsHeading('Update review & Compare')).toBe('update-review-and-compare')
  })
})
