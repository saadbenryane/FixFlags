import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { helpArticlePath } from '@/lib/help/types'
import type { DocsSearchEntry } from '@/lib/docs/content'
import type { KnowledgeSearchEntry } from '@/lib/knowledge/search'

export function buildHelpKnowledgeEntries(): KnowledgeSearchEntry[] {
  return HELP_ARTICLES.map((article) => {
    const category = HELP_CATEGORIES.find((candidate) => candidate.id === article.categoryId)
    const bodyText = article.body
      .map((block) => {
        if (block.type === 'p' || block.type === 'h2' || block.type === 'callout') return block.text
        if (block.type === 'ul' || block.type === 'ol' || block.type === 'steps') return block.items.join(' ')
        if (block.type === 'link') return `${block.text} ${block.href}`
        if (block.type === 'code') return block.text
        if (block.type === 'image') return block.alt
        return ''
      })
      .join(' ')

    return {
      surface: 'help',
      surfaceLabel: category?.title ?? 'Help',
      title: article.title,
      description: article.excerpt,
      href: helpArticlePath(article.categoryId, article.slug),
      keywords: [category?.title, bodyText, ...(article.searchTokens ?? [])].join(' '),
    }
  })
}

export function docsEntriesToKnowledge(entries: readonly DocsSearchEntry[]): KnowledgeSearchEntry[] {
  return entries.map((entry) => ({
    surface: 'docs',
    surfaceLabel: 'Docs',
    title: entry.title,
    description: entry.description,
    href: entry.href,
    keywords: entry.keywords,
  }))
}

export function mergeKnowledgeEntries(
  helpEntries: readonly KnowledgeSearchEntry[],
  docsEntries: readonly KnowledgeSearchEntry[]
): KnowledgeSearchEntry[] {
  return [...helpEntries, ...docsEntries]
}
