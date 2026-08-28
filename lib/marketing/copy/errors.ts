export const AUDIT_ERRORS = {
  checkFailedTitle: 'Check failed',
  retryCta: 'Retry',
  checkAnotherSite: 'Check another site',
  goHome: 'Go home',
  startCheck: 'Check My Site',
  reportNotFoundTitle: 'Report not found',
  reportNotFoundBody: 'This report does not exist or has been removed.',
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
  inProgress: 'Reviewing your site...',
  submitLoading: 'Reviewing…',
  bannerScanning: 'Reviewing',
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
  scanningBadge: (label: string) => `Reviewing · ${label}`,
  ariaScanning: 'Reviewing',
  ariaScanningPercent: (percent: number) => `Reviewing, ${percent} percent`,
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
