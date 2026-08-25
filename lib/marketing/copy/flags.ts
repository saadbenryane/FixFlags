export const FLAG_STATUS_LABELS = {
  OPEN: { label: 'Open', description: 'Not fixed yet' },
  FIXED: { label: 'No longer observed', description: 'Not observed in this update review' },
  IGNORED: { label: 'Ignored', description: 'Acknowledged and skipped' },
  REGRESSED: { label: 'Regressed', description: 'Same Flag, worse than before' },
} as const

export const RECHECK_DIFF_COPY = {
  title: 'See what changed in this update review',
  celebrationTitle: (n: number) =>
    n === 1 ? '1 Flag no longer observed' : `${n} Flags no longer observed`,
  celebrationBody:
    'This review did not observe these Flags. Verification receipts show whether an attempted Improvement worked.',
  nextFixHint: 'Next up',
  cleared: 'No longer observed',
  remaining: 'Still open',
  newIssues: 'New',
  regressed: 'Regressed',
  inconclusive: 'Inconclusive',
  inconclusiveBody: (count: number) =>
    `${count} ${count === 1 ? 'Flag has' : 'Flags have'} insufficient comparable coverage. Inspect the verification receipt for coverage and remaining risk.`,
  empty: 'No Flag changes in this update review.',
  compareCta: 'Open full before/after',
  compareProHint: 'See the evidence side by side.',
  compareProCta: 'Open comparison',
  outcomesHint:
    'Outcomes: no longer observed, still open, unchanged severity, regressed, or inconclusive.',
  compareProGateDescription:
    'Before/after comparison is included on every plan. Update reviews use the monthly product review allowance.',
} as const

export const FLAG_DISMISS_REASONS = [
  { id: 'WRONG', label: 'Wrong' },
  { id: 'ALREADY_KNOWN', label: 'Already known' },
  { id: 'LOW_IMPACT', label: 'Low impact' },
  { id: 'POOR_TIMING', label: 'Poor timing' },
  { id: 'TOO_COSTLY', label: 'Too costly' },
  { id: 'WEAK_RECOMMENDATION', label: 'Weak recommendation' },
  { id: 'MISUNDERSTOOD_PRODUCT_CONTEXT', label: 'Misunderstood Product context' },
] as const

export type FlagDismissReasonId = (typeof FLAG_DISMISS_REASONS)[number]['id']

export const FLAG_FEEDBACK_COPY = {
  thanksUp: 'Thanks for the feedback!',
  thanksDown: "Got it, we'll improve this.",
  saveFailed: 'Failed to save feedback',
  dismissPrompt: 'Why are you not acting on this recommendation?',
  dismissed: 'Recommendation declined.',
} as const

export const FLOW_SCAN_STATUS = {
  success: {
    label: 'Passed',
    description: 'The primary CTA navigated to a meaningful destination.',
  },
  no_cta: {
    label: 'No CTA found',
    description: 'No clickable signup, pricing, or get-started control was visible in the viewport.',
  },
  unclickable: {
    label: 'CTA not clickable',
    description: 'A CTA was detected but could not be clicked (overlay, disabled, or obscured).',
  },
  error_response: {
    label: 'Error page',
    description: 'The CTA destination returned a 4xx or 5xx HTTP status.',
  },
  dead_end: {
    label: 'Dead end',
    description: 'Clicking the CTA did not change the URL or page content meaningfully.',
  },
  external_leave: {
    label: 'Left your domain',
    description: 'The CTA sent users to an external site instead of signup or pricing on your domain.',
  },
  skipped: {
    label: 'Skipped',
    description: 'The CTA flow test could not run during this review. Run a product review again to try.',
  },
  timeout: {
    label: 'Timed out',
    description: 'The CTA flow test exceeded the time limit before completing the click-through.',
  },
} as const
