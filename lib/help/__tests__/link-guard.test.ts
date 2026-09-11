import { describe, expect, it } from 'vitest'
import { isParkedPowerToolPath } from '@/proxy'
import { FAQ, faqEntryAnchor } from '@/lib/marketing/copy/faq'
import { PRICING_FAQ } from '@/lib/marketing/copy/plans'
import { HELP_ARTICLES } from '@/lib/help/catalog'
import { DOCS_PAGES } from '@/lib/docs/catalog'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'

const PARKED_PREFIXES = [
  '/docs/integrations',
  '/docs/cli',
  '/docs/mcp',
  '/help/mcp-and-editors',
]

const FAQ_SETS = [FAQ, PRICING_FAQ] as const

function collectHrefs(): string[] {
  const hrefs: string[] = []

  for (const items of FAQ_SETS) {
    for (const item of items) {
      if (item.learnMore?.href) hrefs.push(item.learnMore.href.split('#')[0]!)
    }
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

  it('resolves FAQ learnMore targets to live routes', () => {
    const livePaths = new Set([
      ...INDEXABLE_ROUTES.map((route) => route.path),
      ...DOCS_PAGES.map((page) => page.path),
      ...HELP_ARTICLES.map((article) => `/help/${article.categoryId}/${article.slug}`),
      '/waitlist',
      '/waitlist/pro',
      '/waitlist/studio',
    ])

    for (const items of FAQ_SETS) {
      for (const item of items) {
        const href = item.learnMore?.href.split('#')[0]
        expect(href, item.question).toBeTruthy()
        expect(livePaths.has(href!), href).toBe(true)
      }
    }
  })

  it('keeps FAQ anchors unique within each FAQ set', () => {
    for (const items of FAQ_SETS) {
      const anchors = items.map((item) => faqEntryAnchor(item.question))
      expect(new Set(anchors).size).toBe(anchors.length)
    }
  })
})
