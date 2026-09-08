/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use re-check, scan, audit, journey enums.
 */

export const REVIEW_ENTRY = {
  cta: 'Check my website',
  compactCta: 'Check site',
  href: '/new',
  urlPlaceholder: 'yoursite.com',
  trySampleCta: 'See how it works',
} as const

export const CUSTOMER_TERMS = {
  category: 'Website care',
  categoryLine: 'Your website, looked after.',
  tagline: 'Know how your website is doing, what needs attention, and what to do next.',
  primaryCta: 'Check my website',
  compactPrimaryCta: 'Check',
  productReview: 'Site check',
  productReviews: 'Site checks',
  productReviewTitle: 'Site',
  updateReview: 'Update review',
  updateReviews: 'Update reviews',
  watchRun: 'Watch run',
  watchReview: 'Watch check',
  funnel: 'Path',
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

export const CORE_LOOP_LABEL = 'Find → Understand → Fix → Verify'

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
