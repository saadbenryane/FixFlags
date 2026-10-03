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
  description: 'Paste a website URL. FixFlags opens your Site board and starts looking after what matters.',
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
  changeLabel: 'What did you change?',
  changeHint: 'Optional. FixFlags records this with the verification attempt so the history says what you actually did.',
  changePlaceholder: 'For example: moved the buy button above the fold',
  changeUndescribed: 'No change described',
  verificationStarted:
    'Verification started. This Flag stays open until the same page and action pass.',
  verifying: 'Verifying…',
  verificationFailed: 'Could not start verification',
  share: 'Share',
  pagesCardName: 'Pages',
  sampleLabel: 'Sample',
  flagStatus: 'Needs a fix',
  flagRecovered: 'Recovered',
  flagProofMissing: 'Couldn’t verify',
  flagProofObserved: 'That check no longer found the problem.',
  flagProofLead: 'An independent check on this Site no longer found the problem on',
  flagProofMissingBody:
    'The recovery proof is not a completed check on this Site. Verify looks at the same page again.',
  flagResolvedList:
    'Flags recorded as fixed. Open one for the completed check. If that check is missing, the Flag says so and offers Verify.',
  flagProofLastCheck: 'Last completed check',
  flagProofRunning:
    'A new verification is still running. This note is the last completed check, not the current result.',
  needsAttention: 'Needs attention',
  lastChecked: 'Last checked',
  notCheckedYet: 'Not checked yet',
  checkOutOfDate: 'Check out of date',
  checkOutOfDateDetail: 'Run a new check for current evidence',
  checkAgain: 'Check again',
  signInToCheckAgain: 'Sign in to check again',
  checkStarted: 'New check started',
  checkStartFailed: 'Could not start a new check',
  siteCheckOutOfDate: 'The last check is out of date. Run a new check for current evidence.',
  checking: 'Checking',
  browserSource: 'FixFlags browser',
  addCard: 'Add card',
  addTitle: 'Add to your board',
  addBody: 'Watch another public area of this website.',
  addEmpty: 'Those cards are already on your board.',
  pagesLoading: 'Pages are loading',
  learning: 'Learning your website',
  healthyEvidence: {
    conversion: {
      answer: 'Journey completed',
      detail: 'Latest browser journey reached its expected end',
    },
    search: {
      answer: 'Metadata checked',
      detail: 'Page metadata was available to inspect',
    },
    performance: {
      desktop: {
        answer: 'Desktop speed measured',
        detail: 'Desktop page speed evidence completed',
      },
      mobile: {
        answer: 'Mobile speed measured',
        detail: 'Mobile page speed evidence completed',
      },
      both: {
        answer: 'Desktop + mobile measured',
        detail: 'Page speed evidence completed on both viewports',
      },
    },
    uptime: {
      answer: 'Page reached',
      detail: 'The page loaded and produced inspectable metadata',
    },
    accessibility: {
      answer: 'Accessibility tested',
      detail: 'Automated accessibility tests completed',
    },
    fallback: {
      answer: 'Evidence checked',
      detail: 'Latest public evidence completed',
    },
  },
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
