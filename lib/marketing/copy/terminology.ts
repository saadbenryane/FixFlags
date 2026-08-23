/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use re-check, scan, audit, journey enums.
 */

export const CUSTOMER_TERMS = {
  category: 'Product QA',
  categoryLine: 'Product QA for what you shipped',
  tagline: 'Finish what your AI started.',
  primaryCta: 'Review my site',
  compactPrimaryCta: 'Review site',
  productReview: 'product review',
  productReviews: 'product reviews',
  updateReview: 'Recheck',
  updateReviews: 'Rechecks',
  deepReview: 'deep review',
  deepReviews: 'deep reviews',
  funnel: 'Funnel',
  path: 'path',
  flag: 'Flag',
  flags: 'Flags',
} as const

/** Shared pricing numbers for marketing, help, and FAQ. Must match `lib/billing/plans.ts` enforcement. */
export const PRICING_COPY = {
  freeProductReviewsLifetime: 3,
  freeDeepReviewTeaserLifetime: 1,
  proPrice: '$69',
  proPeriod: '/mo',
  proProductReviewsPerMonth: 25,
  proDeepReviewsPerMonth: 4,
  studioPrice: '$199',
  studioPeriod: '/mo',
  studioProductReviewsPerMonth: 80,
  studioDeepReviewsPerMonth: 10,
} as const

export const CORE_LOOP_LABEL = 'Flag → Fix → Recheck'

/** Regex patterns that must not appear in customer-facing copy surfaces. */
export const BANNED_CUSTOMER_PHRASES = [
  /\bre-checks?\b/i,
  /\bunlimited re-checks?\b/i,
  /\bnew URL checks?\b/i,
  /\bjourneys per month\b/i,
  /\bjourneys \/ month\b/i,
  /\bpolish pass\b/i,
  /\bpolish scan\b/i,
] as const
