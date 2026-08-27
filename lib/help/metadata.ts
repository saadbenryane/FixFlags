import type { Metadata } from 'next'
import type { HelpArticle, HelpCategory } from '@/lib/help/types'
import { helpArticlePath } from '@/lib/help/types'
import { BRAND } from '@/lib/marketing/copy'
import { buildIndexableMetadata } from '@/lib/marketing/metadata'

export function buildHelpArticleMetadata(article: HelpArticle): Metadata {
  const path = helpArticlePath(article.categoryId, article.slug)
  return buildIndexableMetadata({
    title: `${article.title}: ${BRAND.name} Help`,
    description: article.excerpt,
    path,
    openGraphType: 'article',
    openGraphTitle: article.title,
  })
}

export function buildHelpCategoryMetadata(category: HelpCategory): Metadata {
  const path = `/help/${category.id}`
  return buildIndexableMetadata({
    title: `${category.title}: ${BRAND.name} Help`,
    description: category.description,
    path,
    openGraphTitle: category.title,
  })
}
