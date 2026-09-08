/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use re-check, scan, audit, journey enums.
 */

export const REVIEW_ENTRY = {
  cta: 'Review my site',
  compactCta: 'Review site',
  href: '/new',
  urlPlaceholder: 'yourproduct.com',
  trySampleCta: 'See a sample review',
} as const

export const CUSTOMER_TERMS = {
  category: 'Website intelligence',
  categoryLine: 'Find what matters. Keep watching.',
  tagline: 'Find what is getting in the way of your next customer.',
  primaryCta: 'Review my site',
  compactPrimaryCta: 'Review',
  productReview: 'product review',
  productReviews: 'product reviews',
  productReviewTitle: 'Product review',
  updateReview: 'Update review',
  updateReviews: 'Update reviews',
  watchRun: 'Watch run',
  watchReview: 'Watch review',
  funnel: 'Funnel',
  path: 'path',
  flag: 'Flag',
  flags: 'Flags',
} as const

/** Shared pricing numbers for marketing, help, and FAQ. Must match `lib/billing/plans.ts` enforcement. */
export const PRICING_COPY = {
  freeProductReviewsPerMonth: 3,
  proPrice: '$29',
  proPeriod: '/mo',
  proProductReviewsPerMonth: 30,
  studioPrice: '$79',
  studioPeriod: '/mo',
  studioProductReviewsPerMonth: 90,
} as const

export const CORE_LOOP_LABEL = 'Product Review → Fix → Verify → Watch'

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
