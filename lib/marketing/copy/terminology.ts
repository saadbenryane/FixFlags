/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use re-check, scan, audit, journey enums.
 * Needs attention is wrong as customer face copy. Flag. Fix. Verify. is the loop.
 */

export const ANALYZE_CTA = 'Analyze'

export const REVIEW_ENTRY = {
  cta: ANALYZE_CTA,
  compactCta: ANALYZE_CTA,
  href: '/new',
  urlPlaceholder: 'yourwebsite.com',
  trySampleCta: 'See how it works',
} as const

export const SITE_BOARD_COPY = {
  viewDetails: 'View details',
  checkedScope: 'What was checked',
  capture: 'Captured page',
  sources: 'Source',
  noCapture: 'No page capture is available for this check.',
  noFreshness: 'No completed check recorded yet.',
  noPages: 'No page-level results were recorded for this check.',
  openFlag: 'See what happened',
  fixThis: 'Fix this',
  verifyFix: 'Verify fix',
  copyPrompt: 'Copy prompt',
  sendFlagToAi: 'Send a Flag to your AI',
  share: 'Share',
  pagesCardName: 'Pages',
  sampleLabel: 'Sample',
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
  primaryCta: ANALYZE_CTA,
  compactPrimaryCta: ANALYZE_CTA,
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
  freeFrequency: 'weekly',
  paidFrequency: 'every day',
} as const

export const CORE_LOOP_LABEL = 'Flag. Fix. Verify.'

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
