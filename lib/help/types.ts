import type { Route } from 'next'
import type { DocsPageKey } from '@/lib/docs/catalog'

export type HelpCategoryId =
  | 'getting-started'
  | 'sites-and-coverage'
  | 'flags-fix-verify'
  | 'watch-and-notifications'
  | 'shopify'
  | 'account-and-billing'
  | 'privacy-and-security'
  | 'troubleshooting'

export type HelpArticleSlug =
  | 'analyze-a-website'
  | 'save-your-site'
  | 'read-site-coverage'
  | 'coverage-limitations'
  | 'read-a-flag'
  | 'send-a-fix-to-your-ai'
  | 'verify-a-flag'
  | 'weekly-watch'
  | 'notification-preferences'
  | 'connect-shopify'
  | 'shopify-access-and-removal'
  | 'free-and-pro'
  | 'manage-an-existing-subscription'
  | 'sign-in-and-account-security'
  | 'privacy-and-evidence'
  | 'delete-your-account'
  | 'check-failed-or-stuck'
  | 'contact-support'

export interface HelpCategory {
  id: HelpCategoryId
  title: string
  description: string
  icon: 'rocket' | 'flag' | 'creditCard' | 'terminal' | 'user'
}

export interface HelpArticle {
  slug: HelpArticleSlug
  categoryId: HelpCategoryId
  title: string
  excerpt: string
  body: readonly HelpBlock[]
  related?: readonly HelpArticleSlug[]
  relatedDocs?: readonly DocsPageKey[]
  searchTokens?: readonly string[]
  popular?: boolean
  updatedAt?: string
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

export function helpArticlePath(categoryId: HelpCategoryId, slug: HelpArticleSlug): HelpArticlePath {
  return `/help/${categoryId}/${slug}` as Route
}

export function helpCategoryPath(categoryId: HelpCategoryId): HelpCategoryPath {
  return `/help/${categoryId}` as Route
}

export function docsPathForPageKey(key: DocsPageKey): string {
  switch (key) {
    case 'home': return '/docs'
    case 'getting-started': return '/docs/getting-started'
    case 'site-care': return '/docs/site-care'
    case 'troubleshooting': return '/docs/troubleshooting'
    default: return '/docs'
  }
}
