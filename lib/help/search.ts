import { HELP_ARTICLES, HELP_CATEGORIES } from './catalog'
import type { HelpArticle, HelpArticleSlug, HelpCategory, HelpCategoryId } from './types'
import { helpArticlePath } from './types'

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s/-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function articleSearchBlob(article: HelpArticle): string {
  const bodyText = article.body
    .map((block) => {
      if (block.type === 'p' || block.type === 'h2' || block.type === 'callout') return block.text
      if (block.type === 'ul' || block.type === 'ol') return block.items.join(' ')
      return ''
    })
    .join(' ')
  const tokens = article.searchTokens?.join(' ') ?? ''
  return normalize(`${article.title} ${article.excerpt} ${bodyText} ${tokens}`)
}

export interface HelpSearchHit {
  article: HelpArticle
  category: HelpCategory
  href: string
  score: number
}

export function searchHelpArticles(query: string, limit = 12): HelpSearchHit[] {
  const q = normalize(query)
  if (!q) return []

  const terms = q.split(' ').filter(Boolean)
  const hits: HelpSearchHit[] = []

  for (const article of HELP_ARTICLES) {
    const blob = articleSearchBlob(article)
    let score = 0
    for (const term of terms) {
      if (normalize(article.title).includes(term)) score += 8
      if (normalize(article.excerpt).includes(term)) score += 4
      if (blob.includes(term)) score += 2
      if (article.searchTokens?.some((t) => normalize(t).includes(term))) score += 3
    }
    if (score > 0) {
      const category = HELP_CATEGORIES.find((c) => c.id === article.categoryId)
      if (!category) continue
      hits.push({
        article,
        category,
        href: helpArticlePath(article.categoryId, article.slug),
        score,
      })
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title)).slice(0, limit)
}

export function getHelpArticle(slug: HelpArticleSlug): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug)
}

export function getHelpCategory(id: HelpCategoryId): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id)
}

export function getArticlesForCategory(id: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categoryId === id)
}

export function getPopularArticles(): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.popular)
}

export function getRelatedArticles(slug: HelpArticleSlug): HelpArticle[] {
  const article = getHelpArticle(slug)
  if (!article?.related) return []
  return article.related
    .map((s) => getHelpArticle(s))
    .filter((a): a is HelpArticle => Boolean(a))
}

/** FAQ projection: question/answer pairs derived from article title + excerpt. */
export function helpArticlesAsFaq(): ReadonlyArray<{ question: string; answer: string }> {
  return HELP_ARTICLES.map((a) => ({
    question: a.title,
    answer: a.excerpt,
  }))
}
