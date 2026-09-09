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

export const SITE_BOARD_COPY = {
  openFlag: 'See what happened',
  fixThis: 'Fix this',
  verifyFix: 'Verify fix',
  copyPrompt: 'Copy prompt',
  share: 'Share',
  flagStatus: 'Needs a fix',
  needsAttention: 'Needs attention',
  lastChecked: 'Last checked',
  notCheckedYet: 'Not checked yet',
  checking: 'Checking',
  browserSource: 'FixFlags browser',
  addCard: 'Add card',
  addTitle: 'Add to your board',
  addBody: 'Watch another public area of this website.',
  addEmpty: 'Those cards are already on your board.',
  pagesLoading: 'Pages are loading',
  learning: 'Learning your website',
  lookingGood: 'Looking good',
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

/**
 * Public packaging numbers. Check-pool counts still match `lib/billing/plans.ts`
 * enforcement (hidden from /pricing). Display prices are the public list, not
 * the live Stripe SKU.
 */
export const PRICING_COPY = {
  freeProductReviewsPerMonth: 3,
  proPrice: '$49',
  proPeriod: '/website/mo',
  proProductReviewsPerMonth: 30,
  studioPrice: 'Volume',
  studioPeriod: '',
  studioProductReviewsPerMonth: 90,
  freeFrequency: 'every 24 hours',
  paidFrequency: 'up to every hour',
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
