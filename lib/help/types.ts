import type { Route } from 'next'
import type { DocsPageKey } from '@/lib/docs/catalog'

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
  | 'anonymous-report-access'
  | 'claiming-a-report'
  | 'sharing-a-report'
  | 'scores-and-severity'
  | 'why-check-failed'
  | 'public-urls-only'
  | 'vs-lighthouse'
  | 'finish-plan-vs-fix-list'
  | 'evidence-and-screenshots'
  | 'stuck-running-review'
  | 'free-vs-pro'
  | 'what-counts-as-a-check'
  | 'update-review-credits'
  | 'credits'
  | 'cancel-or-manage'
  | 'payment-past-due'
  | 'upgrade-or-downgrade'
  | 'invoices-and-receipts'
  | 'when-credits-run-out'
  | 'mcp-setup'
  | 'railway-deploy-check'
  | 'lovable-bolt-paste'
  | 'api-keys'
  | 'sign-in-and-security'
  | 'report-privacy'
  | 'contact-us'
  | 'delete-account'
  | 'change-email'
  | 'oauth-sign-in-issues'

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
  /** Deeper product guides in /docs */
  relatedDocs?: readonly DocsPageKey[]
  /** Extra search tokens beyond title/excerpt/body */
  searchTokens?: readonly string[]
  /** Show on hub popular list */
  popular?: boolean
  /** ISO date for display and sitemap lastModified */
  updatedAt?: string
  /** Estimated read time in minutes */
  estimatedReadMinutes?: number
}

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: readonly string[] }
  | { type: 'ol'; items: readonly string[] }
  | { type: 'steps'; items: readonly string[] }
  | { type: 'callout'; text: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'code'; text: string }
  | { type: 'image'; src: string; alt: string }

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

export function docsPathForPageKey(key: DocsPageKey): string {
  switch (key) {
    case 'home':
      return '/docs'
    case 'getting-started':
      return '/docs/getting-started'
    case 'reports':
      return '/docs/reports'
    case 'troubleshooting':
      return '/docs/troubleshooting'
    default:
      return '/docs'
  }
}
