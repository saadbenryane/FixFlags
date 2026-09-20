import type { HelpArticlePath, HelpArticleSlug, HelpCategoryId } from './types'
import { helpArticlePath } from './types'

export type HelpSurface =
  | 'audit_failure'
  | 'audit_limit'
  | 'billing_past_due'
  | 'billing_error'
  | 'mcp_setup'
  | 'api_keys'
  | 'score_help'
  | 'lighthouse'

const ARTICLE_CATEGORY: Record<HelpArticleSlug, HelpCategoryId> = {
  'analyze-a-website': 'getting-started',
  'save-your-site': 'getting-started',
  'read-site-coverage': 'sites-and-coverage',
  'coverage-limitations': 'sites-and-coverage',
  'read-a-flag': 'flags-fix-verify',
  'send-a-fix-to-your-ai': 'flags-fix-verify',
  'verify-a-flag': 'flags-fix-verify',
  'weekly-watch': 'watch-and-notifications',
  'notification-preferences': 'watch-and-notifications',
  'connect-shopify': 'shopify',
  'shopify-access-and-removal': 'shopify',
  'free-and-pro': 'account-and-billing',
  'manage-an-existing-subscription': 'account-and-billing',
  'sign-in-and-account-security': 'account-and-billing',
  'privacy-and-evidence': 'privacy-and-security',
  'delete-your-account': 'privacy-and-security',
  'check-failed-or-stuck': 'troubleshooting',
  'contact-support': 'troubleshooting',
}

export function helpHrefForSlug(slug: HelpArticleSlug): HelpArticlePath {
  return helpArticlePath(ARTICLE_CATEGORY[slug], slug)
}

export function helpHrefForFailureCode(failureCode?: string | null): HelpArticlePath {
  return helpHrefForSlug(
    failureCode === 'HTTP_FORBIDDEN' || failureCode === 'SITE_FORBIDDEN'
      ? 'coverage-limitations'
      : 'check-failed-or-stuck'
  )
}

export function helpHrefForLimitAction(action?: string | null): HelpArticlePath {
  void action
  return helpHrefForSlug('free-and-pro')
}

export function helpHrefForSurface(surface: HelpSurface): HelpArticlePath {
  if (surface === 'billing_past_due' || surface === 'billing_error') return helpHrefForSlug('manage-an-existing-subscription')
  if (surface === 'audit_limit') return helpHrefForSlug('free-and-pro')
  if (surface === 'audit_failure') return helpHrefForSlug('check-failed-or-stuck')
  if (surface === 'score_help' || surface === 'lighthouse') return helpHrefForSlug('read-site-coverage')
  return helpHrefForSlug('contact-support')
}
