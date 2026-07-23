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

/** Map audit failure codes to the most relevant help article. */
const FAILURE_CODE_ARTICLES: Record<string, HelpArticleSlug> = {
  AUDIT_TIMEOUT: 'why-check-failed',
  DESKTOP_CAPTURE_FAILED: 'why-check-failed',
  AI_CONTRACT_INVALID: 'why-check-failed',
  AI_REVIEW_FAILED: 'why-check-failed',
  AI_PROVIDER_NOT_CONFIGURED: 'why-check-failed',
  AUDIT_PIPELINE_FAILED: 'why-check-failed',
  AUDIT_JOB_FAILED: 'why-check-failed',
  QUEUE_ENQUEUE_FAILED: 'why-check-failed',
  BROWSER_LAUNCH_FAILED: 'why-check-failed',
  STORAGE_NOT_CONFIGURED: 'why-check-failed',
  STORAGE_UPLOAD_FAILED: 'why-check-failed',
  HTTP_FORBIDDEN: 'public-urls-only',
  HTTP_RATE_LIMIT: 'why-check-failed',
  HTTP_ERROR: 'why-check-failed',
  NON_HTML_RESPONSE: 'why-check-failed',
  CAPTURE_FAILED: 'why-check-failed',
}

const LIMIT_ACTION_ARTICLES: Record<string, HelpArticleSlug> = {
  signup: 'first-check',
  upgrade: 'free-vs-pro',
  buy_credits: 'credits',
}

const SURFACE_ARTICLES: Record<HelpSurface, HelpArticleSlug> = {
  audit_failure: 'why-check-failed',
  audit_limit: 'what-counts-as-a-check',
  billing_past_due: 'payment-past-due',
  billing_error: 'cancel-or-manage',
  mcp_setup: 'mcp-setup',
  api_keys: 'api-keys',
  score_help: 'scores-and-severity',
  lighthouse: 'vs-lighthouse',
}

const ARTICLE_CATEGORY: Record<HelpArticleSlug, HelpCategoryId> = {
  'first-check': 'getting-started',
  'reading-your-report': 'getting-started',
  'flag-fix-recheck': 'getting-started',
  'scores-and-severity': 'checks-and-reports',
  'why-check-failed': 'checks-and-reports',
  'public-urls-only': 'checks-and-reports',
  'vs-lighthouse': 'checks-and-reports',
  'free-vs-pro': 'billing-and-plans',
  'what-counts-as-a-check': 'billing-and-plans',
  'rechecks-are-free': 'billing-and-plans',
  credits: 'billing-and-plans',
  'cancel-or-manage': 'billing-and-plans',
  'payment-past-due': 'billing-and-plans',
  'mcp-setup': 'mcp-and-editors',
  'railway-deploy-check': 'mcp-and-editors',
  'lovable-bolt-paste': 'mcp-and-editors',
  'api-keys': 'mcp-and-editors',
  'sign-in-and-security': 'account',
  'report-privacy': 'account',
  'contact-us': 'account',
}

export function helpHrefForSlug(slug: HelpArticleSlug): HelpArticlePath {
  return helpArticlePath(ARTICLE_CATEGORY[slug], slug)
}

export function helpHrefForFailureCode(failureCode?: string | null): HelpArticlePath {
  const slug =
    (failureCode && FAILURE_CODE_ARTICLES[failureCode]) || SURFACE_ARTICLES.audit_failure
  return helpHrefForSlug(slug)
}

export function helpHrefForLimitAction(action?: string | null): HelpArticlePath {
  const slug = (action && LIMIT_ACTION_ARTICLES[action]) || SURFACE_ARTICLES.audit_limit
  return helpHrefForSlug(slug)
}

export function helpHrefForSurface(surface: HelpSurface): HelpArticlePath {
  return helpHrefForSlug(SURFACE_ARTICLES[surface])
}
