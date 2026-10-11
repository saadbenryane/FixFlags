import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DOCS_PAGES, getDocsPage, slugifyDocsHeading, buildDocsMetadata, docsStructuredData } from '@/lib/docs/catalog'
import { applyGeneratedBlocks } from '@/lib/docs/generated-blocks'
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { isParkedPowerToolPath } from '@/proxy'
import { searchKnowledge } from '@/lib/knowledge/search'

vi.mock('server-only', () => ({}))
import { buildDocsSearchIndex } from '@/lib/docs/content'

describe('published documentation', () => {
  it('resolves every table-of-contents entry to a real heading', () => {
    for (const page of DOCS_PAGES) {
      const markdown = applyGeneratedBlocks(readFileSync(path.join(process.cwd(), 'content/docs', page.source!), 'utf8'), page.source!)
      const anchors = new Set([...markdown.matchAll(/^#{2,3} (.+)$/gm)].map(match => slugifyDocsHeading(match[1])))
      for (const heading of page.headings) expect(anchors.has(heading.id), `${page.path}#${heading.id}`).toBe(true)
    }
  })

  it('links only to published docs and existing Help articles', () => {
    const paths = new Set([
      ...DOCS_PAGES.map(page => page.path), '/help',
      ...HELP_CATEGORIES.map(category => `/help/${category.id}`),
      ...HELP_ARTICLES.map(article => `/help/${article.categoryId}/${article.slug}`),
    ])
    for (const page of DOCS_PAGES) {
      const markdown = applyGeneratedBlocks(readFileSync(path.join(process.cwd(), 'content/docs', page.source!), 'utf8'), page.source!)
      expect(markdown).not.toMatch(/\]\(\/(?:install|protect)(?:[)#?])/)
      for (const match of markdown.matchAll(/\]\((\/(?:docs|help)[^)]*)\)/g)) {
        const [href, anchor] = match[1].split('#')
        expect(paths.has(href), `${page.path} links to ${href}`).toBe(true)
        if (anchor && href.startsWith('/docs')) {
          const target = DOCS_PAGES.find(candidate => candidate.path === href)!
          const source = readFileSync(path.join(process.cwd(), 'content/docs', target.source!), 'utf8')
          const anchors = [...source.matchAll(/^#{2,3} (.+)$/gm)].map(heading => slugifyDocsHeading(heading[1]))
          expect(anchors, match[1]).toContain(anchor)
        }
      }
    }
  })

  it('publishes and indexes every available integration guide', async () => {
    const entries = await buildDocsSearchIndex()
    for (const key of ['integrations', 'shopify', 'google-analytics', 'google-search-console'] as const) {
      const page = getDocsPage(key)
      expect(isParkedPowerToolPath(page.path)).toBe(false)
      expect(INDEXABLE_ROUTES.some(route => route.path === page.path)).toBe(true)
      expect(LLMS_SECTIONS.flatMap(section => section.links).some(link => link.path === page.path)).toBe(true)
      expect(buildDocsMetadata(page).alternates?.canonical).toMatch(new RegExp(`${page.path}$`))
      expect(buildDocsMetadata(page).robots).toMatchObject({ index: true, follow: true })
      const searchable = entries.map(entry => ({ ...entry, surface: 'docs' as const, surfaceLabel: 'Docs' }))
      expect(searchKnowledge(page.title, searchable).some(entry => entry.href === page.path)).toBe(true)
    }
    expect(docsStructuredData(getDocsPage('shopify'))['@graph'][0]).toMatchObject({
      itemListElement: [{ name: 'Docs' }, { name: 'Integration guides' }, { name: 'Shopify' }],
    })
    expect(isParkedPowerToolPath('/docs/mcp')).toBe(true)
    expect(isParkedPowerToolPath('/docs/cli')).toBe(true)
    expect(isParkedPowerToolPath('/api/integrations/github')).toBe(true)
    for (const article of HELP_ARTICLES) for (const key of article.relatedDocs ?? []) {
      expect(DOCS_PAGES).toContain(getDocsPage(key))
    }
  })
})
