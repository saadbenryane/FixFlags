/**
 * Canonical customer-facing terminology. Wire marketing, product UI, and help from here.
 * Internal code may still use recheck, scan, audit, journey enums.
 * Monitor. Flag. Fix. is the customer loop. Verification supplies recovery proof.
 */

export const ANALYZE_CTA = 'Check your website'

export const SITE_ACTIVITY_COPY = {
  milestones: ['Reached', 'Captured', 'Checked', 'Prioritized', 'Saved'],
  partial: 'Prioritization incomplete',
  partialHint: 'Results saved. Prioritization incomplete.',
  stages: ['Waiting to start', 'Capturing pages', 'Running checks', 'Prioritizing Flags', 'Saving results', 'Check finished'],
  recorded: ['Check accepted', 'Page captures recorded', 'Check results recorded', 'Flag priorities recorded', 'Results recorded', 'Check finished'],
  interrupted: ['Check could not start', 'Page capture interrupted', 'Checks interrupted', 'Prioritization interrupted', 'Results could not be saved', 'Check interrupted'],
} as const

export const REVIEW_ENTRY = {
  cta: ANALYZE_CTA,
  compactCta: ANALYZE_CTA,
  href: '/new',
  description: 'Enter your website for a free check. Save it to get fix instructions you can copy and paste, plus scheduled checks.',
  urlPlaceholder: 'yourwebsite.com',
  trySampleCta: 'See how it works',
} as const

export const SITE_BOARD_COPY = {
  openFlagCount: (count: number) => `${count} open ${count === 1 ? 'Flag' : 'Flags'}`,
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
  reviewIncomplete: 'Prioritization couldn’t finish',
  cardCheckIncomplete: 'Some checks didn’t finish',
  /** A partial area with no Flags: never "0 Flags", which claims a clean result. */
  partialNoFlags: 'No Flags in what finished',
  cardRetryExplanation: 'The saved results are still available. A new check will try the missing work again.',
  watchCard: 'Monitoring',
  watchCardOff: 'Off',
  watchCardDaily: 'Daily',
  watchCardWeekly: 'Weekly',
  watchCardPaused: 'Paused',
  watchCardDelayed: 'Delayed',
  watchCardQuota: 'Needs attention',
  watchNext: (when: string) => `Next check ${when}`,
  siteFlagCount: (count: number) => `${count} ${count === 1 ? 'Flag' : 'Flags'}`,
  siteCoverageIncomplete: 'Coverage incomplete',
  siteChecking: 'Checking',
  findingGroups: {
    critical: 'Fix first',
    important: 'Other Flags',
    other: 'Other Flags',
    recommendations: 'Suggestions',
  },
  findingPriority: 'Flag priority',
  findingLocationUnknown: 'Page not recorded',
  findingEvidence: 'Evidence and scope',
  flagsSummary: 'Flags summary',
  findingPageScope: (count: number) => `Flags on ${count} ${count === 1 ? 'page' : 'pages'}`,
  settingsActionsBody: 'Choose the visitor actions FixFlags should verify. Each card records what happened and whether it still works.',
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
  fixAndVerify: 'Fix this problem',
  fixStep: 'Apply the fix',
  fixStepBody: 'Paste the fix instructions where you built your website, or send them to someone who can help.',
  readFixGuidance: 'Read fix instructions',
  verifyStep: 'Check the fix',
  verifyStepBody: 'Publish your changes, then check the same page and action again.',
  copyDoesNotResolve: 'After publishing the fix, check this page again to confirm it works.',
  verifyFix: 'Recheck',
  copyPrompt: 'Copy fix instructions',
  viewPrompt: 'View instructions',
  promptActionFor: (action: string, title: string) => `${action}: ${title}`,
  previewPromptBody: 'These are the complete instructions you can copy and paste to help fix the problem.',
  copyPromptCopied: 'Fix instructions copied',
  useFixPrompt: 'How to use these instructions',
  copyPromptFailed: 'Could not load the fix instructions. Try again.',
  manualCopyTitle: 'Copy fix instructions manually',
  manualCopyBody: 'Couldn’t copy automatically. The complete instructions are selected below.',
  fixPromptLabel: 'Fix instructions',
  selectPrompt: 'Select instructions',
  sendFlagToAi: 'Copy fix instructions',
  changeLabel: 'What did you change?',
  changeHint: 'Optional. Saved with this verification attempt.',
  changePlaceholder: 'For example: moved the buy button above the fold',
  changeUndescribed: 'No change described',
  verificationStarted: 'Check started. This Flag stays open until the same page and action pass.',
  verificationHistory: 'Verification history',
  noVerificationYet: 'No verification yet',
  noVerificationBody: 'Check the fix after publishing. The result and your change notes will appear here.',
  verifying: 'Checking…',
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
  flagProofMissingBody: 'The recovery proof is not a completed check on this Site. Recheck looks at the same page again.',
  flagResolvedList: 'Flags recorded as fixed. Open one for the completed check. If that check is missing, the Flag says so and offers Recheck.',
  flagProofLastCheck: 'Last completed check',
  flagProofRunning: 'A new verification is still running. This note is the last completed check, not the current result.',
  needsAttention: 'Needs attention',
  lastChecked: 'Last checked',
  notCheckedYet: 'Not checked yet',
  checkOutOfDate: 'Check out of date',
  checkOutOfDateDetail: 'Run a new check for current evidence',
  checkAgain: 'Check again',
  checkAreaAgain: (area: string) => `Check ${area} again`,
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
  verificationLimits: 'Technical details',
  checkResultStatuses: { passed: 'Passed', completed: 'Completed', findings: 'Findings recorded', failed: 'Could not complete', not_applicable: 'Not applicable', observed: 'Observed', unknown: 'Not verified' },
  siteCheckOutOfDate: 'The last check is out of date. Run a new check for current evidence.',
  checking: 'Checking',
  browserSource: 'FixFlags browser',
  pageSpeedSource: 'Google PageSpeed',
  searchConsoleSource: 'Search Console',
  analyticsSource: 'Google Analytics',
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
      answer: 'Public journey exercised',
      detail: 'Recorded steps cover this public journey, not every visitor action',
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
      answer: 'HTTPS observed',
      detail: 'HTTPS and captured image transport were checked; this is not a security certification',
    },
    tracking: {
      answer: 'Analytics markup detected',
      detail: 'An analytics snippet appeared in captured HTML; event delivery was not verified',
    },
    accessibility: {
      answer: 'No automated issues found',
      detail: 'Automated rules checked the top-level page; manual accessibility was not evaluated',
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
    checking: 'Checking',
    flags: 'Flags found',
    clear: 'Clear',
    could_not_verify: 'Couldn’t verify',
    stale: 'Out of date',
    failed: 'Check incomplete',
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
    queued: 'Check queued',
    running: 'Checking',
    partial: 'Check incomplete',
    failed: 'Check could not start',
    interrupted: 'Check interrupted',
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
    incomparable_scope: 'Couldn’t compare',
  },
  flags: (count: number) => `${count} ${count === 1 ? 'Flag' : 'Flags'}`,
  pages: (reached: number, expected: number) => {
    if (expected > 0 && reached < expected) return `${reached} of ${expected} pages`
    const count = expected > 0 ? expected : reached
    return `${count} ${count === 1 ? 'page' : 'pages'}`
  },
  coverageIncomplete: 'Coverage incomplete',
  freshness: {
    none: 'No completed check',
    now: 'Just now',
    minutes: (count: number) => `${count} min ago`,
    hours: (count: number) => `${count} hr ago`,
    days: (count: number) => `${count} ${count === 1 ? 'day' : 'days'} ago`,
  },
} as const

export const WEBSITES_COPY = {
  analyzeTitle: 'Add a website',
  analyzeBody: 'Check your public pages for problems, with clear steps to fix them.',
  firstTitle: 'Check your first website',
  firstSteps: [
    { title: 'Find problems', body: 'See what needs attention on your public pages.' },
    { title: 'Copy the fix instructions', body: 'Paste them where you built your website, or send them to someone who can help.' },
    { title: 'Keep monitoring', body: 'Get scheduled checks and email alerts about new problems.' },
  ],
  emptyTitle: 'No websites yet',
  emptyBody: 'Start with your website URL.',
  count: (count: number) => `${count} ${count === 1 ? 'website' : 'websites'}`,
  monitoring: 'Monitoring',
  result: 'Result',
  loading: 'Loading your websites…',
  refreshFailed: 'Couldn’t load your websites. Try again.',
  refreshFailedRetained: 'Couldn’t update your websites. Showing the last loaded results.',
  accountChanged: 'Your account changed. Refresh to continue.',
} as const

export const API_KEY_COPY = {
  title: 'API keys',
  description: 'Create a key for your own tools, then revoke it here whenever you need to.',
  createTitle: 'Create API key',
  createDescription: 'Choose the access your tool needs for Sites owned by this account. The secret is shown once.',
  accessName: 'Fix and verify',
  accessLabel: 'Access',
  accessDescription: 'Read Site evidence, start checks, and use the Monitor → Flag → Fix loop for Sites you own.',
  listFailed: 'Could not load developer keys.',
  retryList: 'Refresh keys',
  revokeFailed: 'Could not revoke this key.',
  createUnconfirmed: 'Couldn’t confirm key creation. Refresh the key list before creating another key.',
  copyUnconfirmed: 'Couldn’t confirm the copy. The key is selected so you can copy it manually.',
  accountChanged: 'Your account changed. Refresh to load its developer keys.',
  accountUnavailable: 'Sign in again to manage developer keys.',
  refreshAccount: 'Refresh account',
} as const

export const CUSTOMER_TERMS = {
  tagline: 'Know how your website is doing, what needs attention, and what to do next.',
  primaryCta: ANALYZE_CTA,
  compactPrimaryCta: ANALYZE_CTA,
  productReview: 'Site check',
  productReviews: 'Site checks',
  productReviewTitle: 'Site',
  updateReview: 'Recheck',
  updateReviews: 'Rechecks',
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
  studioPrice: '$99',
  studioPeriod: '/website/mo',
  studioProductReviewsPerMonth: 90,
  freeFrequency: 'any supported schedule during open beta',
  paidFrequency: 'every day',
} as const

export const CORE_LOOP_LABEL = 'Monitor. Flag. Fix.'

/** Regex patterns that must not appear in customer-facing copy surfaces. */
/** Recheck is the public word for a fresh check of a fix (docs/voice-and-copy.md); only its unlimited claim is banned. */
export const BANNED_CUSTOMER_PHRASES = [/\bunlimited rechecks?\b/i, /\bnew URL checks?\b/i, /\bjourneys per month\b/i, /\bjourneys \/ month\b/i, /\bpolish pass\b/i, /\bpolish scan\b/i] as const
export const CLIPBOARD_COPY = {
  success: 'Copied to clipboard',
  failure: 'Could not copy to clipboard',
  accountRequired: 'Create a free account to copy these fix instructions',
} as const
