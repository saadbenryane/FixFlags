export const AUDIT_ERRORS = {
  checkFailedTitle: 'Check failed',
  retryCta: 'Retry',
  checkAnotherSite: 'Check another site',
  goHome: 'Go home',
  startCheck: 'Check My Site',
  reportNotFoundTitle: 'Saved evidence not found',
  reportNotFoundBody: 'This saved evidence does not exist or has been removed.',
  accessDeniedTitle: 'Access denied',
  accessDeniedBody: 'You do not have access to this report.',
  pollErrorTitle: 'Could not load report',
  pollErrorBody: 'Something went wrong while loading this report. Try again in a moment.',
  timeout:
    'The review took longer than expected. This can happen with slow-loading sites. Try again, or try a different page on the site.',
  generic:
    "We couldn't complete this check. The site may be unreachable or blocking automated visits.",
  scannerUnavailable:
    'The scanner is temporarily unavailable. Try again in a few minutes.',
  captureFailed: 'We could not capture a screenshot of this page. Check that the URL is public and loads in a browser.',
  siteBlocked: 'This site blocked our automated visit. Try again later or check from a public URL.',
  rateLimited: 'This site is rate-limiting requests. Try again in a few minutes.',
  unreachable: 'We could not reach this page. Check the URL and try again.',
  notHtml: 'This URL did not return a normal web page. Check the link and try again.',
  aiReviewFailed: 'AI review could not finish. Try again.',
  partialAiReview:
    'Enhanced Fix prompts could not finish. Deterministic Tasks and evidence are still shown below - use Copy prompt when a Task is available.',
  partialAiReviewContract:
    'Enhanced Fix prompts failed a quality check and were skipped. Deterministic Tasks and evidence are still shown below.',
  triageDegradedAnonymous:
    'Automated checks are complete. AI summary was unavailable for this run. Sign up to retry with full AI review and fix prompts.',
  triageDegradedSignedIn:
    'Automated checks are complete. AI summary was unavailable for this run. Deterministic flags and screenshots are shown below.',
  triageDegradedTimeout:
    'This review ran out of time before the AI summary could finish. Deterministic checks and screenshots are shown below.',
  triageProviderNotConfigured:
    'AI summary is unavailable because no provider key is configured on the scanner. Deterministic checks and fix steps are shown below.',
  partialReport: 'Some optional evidence was unavailable. Unassessed rubrics are left unmeasured rather than inferred.',
  pageSpeedUnavailable: 'PageSpeed data was unavailable for this run.',
  urlRequired: 'Enter a URL like https://yoursite.com',
  urlMalformed: 'Enter a valid URL like https://yoursite.com',
  urlScheme: 'Only http:// and https:// URLs can be checked',
  urlLocalhost: 'FixFlags can only check publicly accessible URLs',
  scanErrorTitle: 'Something went wrong during the review',
  scanErrorBody: 'The review encountered an unexpected error. Try again.',
} as const

/**
 * Watch activation copy.
 *
 * Watch is what distinguishes FixFlags from a one-shot report, and it is off
 * until the customer turns it on, because turning it on sends email. Home
 * answers "what is FixFlags watching", so Home states this plainly rather than
 * leaving a customer to infer it. Nothing here claims a delivery guarantee, and
 * nothing here turns Watch on.
 */
export const WATCH_OFFER = {
  title: 'FixFlags is not watching this Site yet',
  body: 'Right now FixFlags checks this Site only when you ask. Turn on Watch and it keeps checking on a schedule, so a broken checkout or a dead page gets a Flag instead of waiting for you to look.',
  actionLabel: 'Turn on Watch',
} as const

/**
 * Watch alert delivery copy.
 *
 * A Site can be checked on schedule and still never tell the customer anything.
 * These strings exist so that failure is stated rather than implied by silence.
 * They say both facts plainly: Watch keeps checking, and it cannot warn you yet.
 */
/**
 * Outcome confirmation copy.
 *
 * A `kind` is not a label. It selects the execution mechanism that will verify
 * the Outcome: a browser journey for a purchase, a safe form for a signup, an
 * HTTP check for page availability. An Outcome confirmed without one would be an
 * agreement FixFlags recorded, could never verify, and never showed, so the
 * confirmation is refused rather than accepted and ignored.
 */
export const OUTCOME_CONFIRMATION = {
  kindRequired:
    'FixFlags cannot watch this yet. Confirm what should keep working: a purchase, a signup, or that the page loads.',
  /**
   * A kind is not enough either. `SIGNUP` names a safe-form mechanism whose
   * binding cannot validate, so accepting it records an agreement, enables
   * Verify, and then reports "Couldn't verify" on every run with no way forward.
   * The customer is told what is missing and what can be watched instead.
   */
  kindUnwatchable:
    'FixFlags cannot watch a signup on this Site yet. It needs an approved test account and a way to undo the signup before it can check one. Confirm a purchase or that the page loads instead.',
  /**
   * The choice a customer gets instead of the dead end "Inferred, confirmation
   * required", which named a requirement and offered no way to meet it. Each
   * button is one of the things FixFlags can really check, in customer words.
   */
  proposeHeading: 'Confirm what FixFlags should watch',
  proposeBody:
    'FixFlags read this from your site. Choose what it should keep checking, and FixFlags will verify it on every check.',
  inferredNote: 'Read from your site. Not being watched yet.',
  confirmedNote: 'Confirmed by you. FixFlags checks it on every run.',
  confirmedBadge: 'Confirmed',
  nameLabel: 'Outcome name',
  noneConfirmed: 'No Outcome has been confirmed for this Site yet.',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Confirmed. FixFlags will keep watching this.',
  saveFailed: 'Could not save this Outcome',
} as const

/** The watchable things, in customer words. Never "journey" or "binding". */
export const OUTCOME_KIND_LABELS = {
  CHECKOUT: 'A customer can reach checkout',
  SIGNUP: 'A visitor can create an account',
  AVAILABILITY: 'The page loads',
} as const

export const WATCH_ALERT_DELIVERY = {
  undeliveredTitle: 'Watch could not reach you',
  undeliveredBody: (when: string | null) =>
    when
      ? `FixFlags found a change on ${when}, but the alert did not reach your inbox. Watch keeps checking, but it cannot warn you until this is fixed.`
      : 'FixFlags found a change on this Site, but the alert did not reach your inbox. Watch keeps checking, but it cannot warn you until this is fixed.',
  undeliveredAction: 'Check the email FixFlags sends to',
  sidebarUndelivered: 'Last Watch alert was not delivered',
  sidebarDelivering: 'Sending your last Watch alert',
} as const

export const SYSTEM_COPY = {
  actions: {
    retry: 'Try again',
    home: 'Home',
    goHome: 'Go home',
    dashboard: 'Dashboard',
    billing: 'Billing',
    close: 'Close',
    docsHome: 'Documentation home',
  },
  errors: {
    genericRetry: 'Something went wrong. Try again.',
    criticalTitle: 'Something went wrong',
    criticalBody: 'A critical error occurred. Try again or refresh the page.',
    billingPortal: 'Could not open billing. Try again.',
    retryAudit: 'Could not retry the review. Try again.',
    root: {
      title: 'This page could not be loaded',
      body: 'Your data was not changed. Try again or return to the dashboard.',
    },
    marketing: {
      title: 'This page could not be loaded',
      body: 'Try again or return to the homepage.',
    },
    app: {
      title: 'Something went wrong',
      body: 'Your data was not changed. Try again or return to the dashboard.',
    },
    admin: {
      title: 'Something went wrong',
      body: 'Try again or return to the admin dashboard.',
    },
    auth: {
      title: 'Could not load this account page',
      body: 'Try again or return to the homepage.',
    },
    report: {
      title: 'Could not load report',
      body: 'Try again or return to the dashboard.',
    },
    repoReport: {
      title: 'Could not load repo report',
      body: 'Try again or return to the dashboard.',
    },
    comparison: {
      title: 'Could not load comparison',
      body: 'Try again or return to the dashboard.',
    },
    billing: {
      title: 'Billing unavailable',
      body: 'Could not load billing information. Try again or return to the dashboard.',
    },
    docs: {
      title: 'This page could not be loaded',
      body: 'Try the page again. Your product data was not changed.',
    },
  },
} as const

export const AUDIT_PROGRESS = {
  inProgress: 'Analyzing your website...',
  submitLoading: 'Analyzing…',
  bannerScanning: 'Analyzing',
  workerQueuedWarningDev:
    'Report is still preparing. In local dev, run npm run dev:all so the worker processes jobs.',
  workerQueuedWarningProd:
    'Review workers are restarting. Your report will continue automatically.',
  workerBacklogWarningProd:
    'Still preparing your report. It will continue shortly.',
  stages: [
    { status: 'QUEUED', label: 'Starting check', subtitle: 'Preparing your review…' },
    { status: 'CAPTURING', label: 'Capturing screenshots', subtitle: 'Desktop and mobile views…' },
    { status: 'CHECKING', label: 'Running checks', subtitle: 'Message, Experience, and Reach…' },
    { status: 'JUDGING', label: 'AI review', subtitle: 'Prioritizing Flags from evidence…' },
    { status: 'FINALIZING', label: 'Preparing review', subtitle: 'Scoring rubrics and packaging results…' },
  ],
  /** Shown only when pipeline progress crosses the matching real substep anchor. */
  substeps: {
    CAPTURE_DONE: 'Capture finished. Starting deterministic checks…',
    CHECKS_DONE: 'Checks finished. Preparing Funnel review…',
    FLOW_RUNNING: 'Reviewing the primary customer path…',
    JOURNEY_START: 'Walking the primary Funnel path…',
    JOURNEY_DONE: 'Funnel review finished. Starting AI review…',
  },
  formatStageStep: (current: number, total: number, label: string) =>
    `Step ${current} of ${total} · ${label}`,
  scanningBadge: (label: string) => `Analyzing · ${label}`,
  ariaScanning: 'Analyzing',
  ariaScanningPercent: (percent: number) => `Analyzing, ${percent} percent`,
  ariaScore: (score: number) => `Score ${score} percent`,
  ariaScoreUnavailable: 'Score unavailable',
  scoreNa: 'N/A',
  reviewProgress: {
    openingLinks: 'Opening public links',
    reviewingThisPage: 'Reviewing this page',
    reviewingPath: (path: string) => `Reviewing ${path}`,
    prioritizingFlags: 'Checking which Flags matter most',
  },
} as const

export function formatQueueWaitHint(seconds: number): string {
  if (seconds >= 60) {
    return `About ${Math.ceil(seconds / 60)} min before the review starts.`
  }
  return `About ${Math.max(1, Math.round(seconds))}s before the review starts.`
}

export function formatQueuePosition(position: number): string {
  return `Queue position ${position}.`
}
