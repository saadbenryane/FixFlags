import type { Route } from 'next'

export type HelpCategoryId =
  | 'getting-started'
  | 'checks-and-reports'
  | 'billing-and-plans'
  | 'mcp-and-editors'
  | 'account'

export type HelpArticleSlug =
  | 'first-check'
  | 'reading-your-report'
  | 'flag-fix-recheck'
  | 'scores-and-severity'
  | 'why-check-failed'
  | 'public-urls-only'
  | 'vs-lighthouse'
  | 'free-vs-pro'
  | 'what-counts-as-a-check'
  | 'update-review-credits'
  | 'credits'
  | 'cancel-or-manage'
  | 'payment-past-due'
  | 'mcp-setup'
  | 'railway-deploy-check'
  | 'lovable-bolt-paste'
  | 'api-keys'
  | 'sign-in-and-security'
  | 'report-privacy'
  | 'contact-us'

export interface HelpCategory {
  id: HelpCategoryId
  title: string
  description: string
  /** Lucide icon name key for UI mapping */
  icon: 'rocket' | 'flag' | 'creditCard' | 'terminal' | 'user'
}

export interface HelpArticle {
  slug: HelpArticleSlug
  categoryId: HelpCategoryId
  title: string
  excerpt: string
  /** Paragraphs and optional headings. Rendered as prose. */
  body: readonly HelpBlock[]
  related?: readonly HelpArticleSlug[]
  /** Extra search tokens beyond title/excerpt/body */
  searchTokens?: readonly string[]
  /** Show on hub popular list */
  popular?: boolean
}

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: readonly string[] }
  | { type: 'ol'; items: readonly string[] }
  | { type: 'callout'; text: string }

export type HelpArticlePath = Route
export type HelpCategoryPath = Route

export function helpArticlePath(
  categoryId: HelpCategoryId,
  slug: HelpArticleSlug
): HelpArticlePath {
  return `/help/${categoryId}/${slug}` as Route
}

export function helpCategoryPath(categoryId: HelpCategoryId): HelpCategoryPath {
  return `/help/${categoryId}` as Route
}
