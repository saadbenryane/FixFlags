import { describe, expect, it } from 'vitest'
import { isParkedPowerToolPath } from '@/proxy'
import { FAQ } from '@/lib/marketing/copy/faq'
import { HELP_ARTICLES } from '@/lib/help/catalog'
import { DOCS_PAGES } from '@/lib/docs/catalog'

const PARKED_PREFIXES = [
  '/docs/integrations',
  '/docs/cli',
  '/docs/mcp',
  '/help/mcp-and-editors',
]

function collectHrefs(): string[] {
  const hrefs: string[] = []

  for (const item of FAQ) {
    if (item.learnMore?.href) hrefs.push(item.learnMore.href.split('#')[0]!)
  }

  for (const article of HELP_ARTICLES) {
    for (const block of article.body) {
      if (block.type === 'link') hrefs.push(block.href.split('#')[0]!)
    }
  }

  return hrefs
}

describe('help and docs link guard', () => {
  it('does not link to parked power-tool routes', () => {
    for (const href of collectHrefs()) {
      expect(isParkedPowerToolPath(href), href).toBe(false)
      expect(PARKED_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`)), href).toBe(
        false
      )
    }
  })

  it('resolves FAQ learnMore targets to live docs or help routes', () => {
    const livePaths = new Set([
      ...DOCS_PAGES.map((page) => page.path),
      ...HELP_ARTICLES.map((article) => `/help/${article.categoryId}/${article.slug}`),
      '/how-it-works',
    ])

    for (const item of FAQ) {
      const href = item.learnMore?.href.split('#')[0]
      if (!href) continue
      if (href.startsWith('/help/') || href.startsWith('/docs')) {
        expect(livePaths.has(href), href).toBe(true)
      }
    }
  })
})
