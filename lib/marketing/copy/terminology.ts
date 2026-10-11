/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use re-check, scan, audit, journey enums.
 * Needs attention is wrong as customer face copy. Flag. Fix. Verify. is the loop.
 */

export const ANALYZE_CTA = 'Analyze'

export const SITE_ACTIVITY_COPY = {
  milestones: ['Reached', 'Captured', 'Checked', 'Reviewed', 'Saved'],
  partial: 'Review incomplete',
  partialHint: 'Results saved. Review incomplete.',
  stages: ['Waiting to start', 'Capturing pages', 'Running checks', 'Reviewing findings', 'Saving results', 'Check finished'],
  recorded: ['Check accepted', 'Page captures recorded', 'Check results recorded', 'Review findings recorded', 'Results recorded', 'Check finished'],
  interrupted: ['Check could not start', 'Page capture interrupted', 'Checks interrupted', 'Review interrupted', 'Results could not be saved', 'Check interrupted'],
} as const

export const REVIEW_ENTRY = {
  cta: ANALYZE_CTA,
  compactCta: ANALYZE_CTA,
  href: '/new',
  description: 'Paste a website URL. FixFlags opens your Site board and starts looking after what matters.',
  urlPlaceholder: 'yourwebsite.com',
  trySampleCta: 'See how it works',
} as const

export const SITE_BOARD_COPY = {
  cardsHeading: 'Website overview',
  visitorActions: 'Visitor actions',
  cardGuidance: 'Choose what should keep working, such as opening a page, signing up, or reaching checkout.',
  cardExamples: 'Page availability, Signup, Checkout, and connected context.',
  compactHeadlines: {
    'Primary CTA is hidden below the fold on mobile': 'Main button off-screen on mobile',
    'Page stays blank too long on slow 3G': 'Blank screen on slow 3G',
  },
  smallTouchTargets: 'Hard-to-tap controls',
  watchOff: 'Not monitored',
  watchSetup: 'Set up monitoring',
  reviewIncomplete: 'Review couldn’t finish',
  cardCheckIncomplete: 'Some checks unfinished',
  cardReviewIncomplete: 'Review incomplete',
  cardRetryExplanation: 'The saved results are still available. A new check will try the missing work again.',
  watchCard: 'Monitoring',
  watchCardOff: 'Off',
  watchCardDaily: 'Daily',
  watchCardWeekly: 'Weekly',
  watchCardPaused: 'Paused',
  watchCardDelayed: 'Delayed',
  watchCardQuota: 'Needs attention',
  watchNext: (when: string) => `Next analysis ${when}`,
  siteFlagCount: (count: number) => `${count} ${count === 1 ? 'Flag' : 'Flags'}`,
  siteCoverageIncomplete: 'Coverage incomplete',
  siteChecking: 'Checking',
  findingGroups: {
    critical: 'Fix first',
    important: 'Other Flags',
    other: 'Other Flags',
    recommendations: 'Suggestions',
  },
  findingPriority: 'Finding priority',
  findingLocationUnknown: 'Page not recorded',
  findingEvidence: 'Evidence and scope',
  findingPageScope: (count: number) => `Findings on ${count} ${count === 1 ? 'page' : 'pages'}`,
  settingsActionsBody: 'Choose the visitor actions FixFlags should verify. Each card records what happened and whether it still works.',
  partialReview: 'Results saved. Review incomplete.',
  activityTitle: 'Run details',
  activityDescription: 'Technical details from this analysis.',
  viewDetails: 'View details',
  checkedScope: 'What was checked',
  websiteCheck: 'Website check',
  capture: 'Captured page',
  sources: 'Source',
  noCapture: 'No page capture is available for this check.',
  noFreshness: 'No completed check recorded yet.',
  noPages: 'No page-level results were recorded for this check.',
  openFlag: 'See what happened',
  flagEvidence: 'What FixFlags saw',
  flagObserved: 'Observed',
  flagExpected: 'Expected after the fix',
  flagScope: 'Checked scope',
  fixThis: 'Fix this',
  fixAndVerify: 'Fix and verify',
  fixStep: 'Fix the problem',
  fixStepBody: 'Use the guidance yourself, or give it to your developer or AI.',
  verifyStep: 'Verify on the live Site',
  verifyStepBody: 'Published the fix? Let FixFlags check the same page and action again.',
  copyDoesNotResolve: 'Copying is a handoff. Only Verify can close this Flag.',
  verifyFix: 'Verify fix',
  copyPrompt: 'Copy fix prompt',
  copyPromptCopied: 'Fix prompt copied',
  setupMcp: 'Set up MCP',
  copyPromptFailed: 'Could not load the fix prompt. Try again.',
  manualCopyTitle: 'Copy fix prompt manually',
  manualCopyBody: 'Clipboard access is unavailable. The complete prompt is selected below.',
  fixPromptLabel: 'Fix prompt',
  selectPrompt: 'Select prompt',
  sendFlagToAi: 'Copy fix prompt',
  changeLabel: 'What did you change?',
  changeHint: 'Optional. Saved with this verification attempt.',
  changePlaceholder: 'For example: moved the buy button above the fold',
  changeUndescribed: 'No change described',
  verificationStarted: 'Verification started. This Flag stays open until the same page and action pass.',
  verificationHistory: 'Verification history',
  noVerificationYet: 'No verification yet',
  noVerificationBody: 'Independent results and change notes will appear here.',
  verifying: 'Verifying…',
  verificationFailed: 'Could not start verification',
  verificationConnectionLost: 'We lost the connection. Refresh to see whether the check started.',
  verifyDescription: 'FixFlags checks the same page and action again. The Flag stays open until a fresh check proves recovery.',
  share: 'Share',
  pagesCardName: 'Pages',
  sampleLabel: 'Sample',
  flagStatus: 'Needs a fix',
  flagRecovered: 'Recovered',
  flagProofMissing: 'Couldn’t verify',
  flagProofObserved: 'That check no longer found the problem.',
  flagCaptureAlt: 'Page captured when this problem was found.',
  captureUnavailable: 'This capture is unavailable. The recorded results are still available.',
  flagProofLead: 'Checked again on',
  checkoutRecovered: 'Checkout opened again.',
  pageRecovered: 'This page opened again.',
  problemRecovered: 'This problem was not found in the recovery check.',
  recoveredBody: 'A fresh check verified recovery. The earlier problem and recovery proof remain below.',
  previousFailure: 'Before the fix',
  captureRecorded: 'Evidence recorded',
  flagProofMissingBody: 'The recovery proof is not a completed check on this Site. Verify looks at the same page again.',
  flagResolvedList: 'Flags recorded as fixed. Open one for the completed check. If that check is missing, the Flag says so and offers Verify.',
  flagProofLastCheck: 'Last completed check',
  flagProofRunning: 'A new verification is still running. This note is the last completed check, not the current result.',
  needsAttention: 'Needs attention',
  lastChecked: 'Last checked',
  notCheckedYet: 'Not checked yet',
  checkOutOfDate: 'Check out of date',
  checkOutOfDateDetail: 'Run a new check for current evidence',
  checkAgain: 'Check again',
  starting: 'Starting…',
  flagListNoOpen: 'No open Flags',
  flagListIncomplete: 'No Flags found. Coverage is incomplete.',
  flagListStale: 'This result is out of date.',
  flagListRunning: 'Analyzing',
  flagListFailed: 'Analysis incomplete',
  flagListNoFilter: 'No open Flags in this category.',
  flagListNoRecoveries: 'No verified recoveries yet',
  flagListNoRecoveriesBody: 'A recovery appears here after an independent check proves the same page and action.',
  flagListBack: 'Back to Overview',
  flagListRetry: 'Review check and retry',
  notificationsUnavailable: 'Notification preferences are saved on the Site. This Site has no saved preferences yet.',
  signInToCheckAgain: 'Sign in to check again',
  checkStarted: 'New check started',
  checkStartFailed: 'Could not start a new check',
  connectionInterrupted: 'The connection was interrupted. Your last recorded evidence is still available. Please try again.',
  recordedChecks: 'Recorded checks',
  recordedChecksBody: 'What actually ran, with its scope and result. A completed check does not certify the entire website.',
  previousEvidence: 'Previous evidence',
  verificationLimits: 'What this result establishes',
  checkResultStatuses: { passed: 'Passed', completed: 'Completed', findings: 'Findings recorded', failed: 'Could not complete', not_applicable: 'Not applicable' },
  siteCheckOutOfDate: 'The last check is out of date. Run a new check for current evidence.',
  checking: 'Checking',
  browserSource: 'FixFlags browser',
  addCard: 'Add to this Site',
  previewUnavailable: 'Website preview unavailable',
  addTitle: 'Add to this Site',
  addBody: 'Add an Outcome, more coverage, or an available connection.',
  addEmpty: 'Everything available is already configured.',
  broaderHealth: 'Broader health',
  broaderHealthWithRecommendations: 'Broader health and recommendations',
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
    security: {
      answer: 'Security checked',
      detail: 'HTTPS and mixed content checks completed',
    },
    tracking: {
      answer: 'Measurement checked',
      detail: 'Public measurement checks completed',
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

/**
 * Customer-ready labels for the four independent Site status axes. Components
 * render these facts; they do not translate storage or pipeline state.
 */
export const SITE_PRESENTATION_COPY = {
  result: {
    checking: 'Analyzing',
    flags: 'Flags found',
    clear: 'Clear',
    could_not_verify: 'Couldn’t verify',
    stale: 'Out of date',
    failed: 'Analysis incomplete',
  },
  monitoring: {
    not_monitored: 'Not monitored',
    weekly: 'Weekly',
    daily: 'Daily',
    hourly: 'Hourly',
    custom: 'Custom',
    paused: 'Paused',
    delayed: 'Delayed',
    quota_blocked: 'Plan limit reached',
  },
  run: {
    idle: 'Run details',
    queued: 'Analysis queued',
    running: 'Analyzing',
    partial: 'Analysis incomplete',
    failed: 'Analysis could not start',
    interrupted: 'Analysis interrupted',
    paused: 'Updates paused',
    disconnected: 'Updates disconnected',
  },
  verification: {
    verifying: 'Verifying',
    verified: 'Verified',
    still_open: 'Still open',
    regressed: 'Regressed',
    could_not_verify: 'Couldn’t verify',
    missing_evidence: 'Missing evidence',
    incomparable_scope: 'Incomparable scope',
  },
  flags: (count: number) => `${count} ${count === 1 ? 'Flag' : 'Flags'}`,
  pages: (reached: number, expected: number) => {
    if (expected > 0 && reached < expected) return `${reached} of ${expected} pages`
    const count = expected > 0 ? expected : reached
    return `${count} ${count === 1 ? 'page' : 'pages'}`
  },
  coverageIncomplete: 'Coverage incomplete',
  freshness: {
    none: 'No completed analysis',
    now: 'Checked just now',
    minutes: (count: number) => `Checked ${count} min ago`,
    hours: (count: number) => `Checked ${count} hr ago`,
    days: (count: number) => `Checked ${count} ${count === 1 ? 'day' : 'days'} ago`,
  },
} as const

export const WEBSITES_COPY = {
  analyzeTitle: 'Analyze a website',
  analyzeBody: 'Enter a public URL to add a Site and see what needs attention.',
  emptyTitle: 'No Sites yet',
  emptyBody: 'Enter a URL above to analyze your first Site.',
  count: (count: number) => `${count} ${count === 1 ? 'website' : 'websites'}`,
  monitoring: 'Monitoring',
  result: 'Result',
} as const

export const API_KEY_COPY = {
  title: 'API keys',
  description: 'Create a key for your own tools, then revoke it here whenever you need to.',
  createTitle: 'Create API key',
  createDescription: 'Keys can read evidence and use the Fix → Verify workflow for Sites owned by this account. The secret is shown once.',
  accessName: 'Fix and verify',
  accessDescription: 'Read Site evidence, start checks, and use the Flag → Fix → Verify workflow for Sites you own.',
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
export const BANNED_CUSTOMER_PHRASES = [/\bre-checks?\b/i, /\bunlimited re-checks?\b/i, /\bnew URL checks?\b/i, /\bjourneys per month\b/i, /\bjourneys \/ month\b/i, /\bpolish pass\b/i, /\bpolish scan\b/i] as const
