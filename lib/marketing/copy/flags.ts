export const FLAG_STATUS_LABELS = {
  OPEN: { label: 'Open', description: 'Not fixed yet' },
  FIXED: { label: 'Fixed', description: 'Cleared on an update review' },
  IGNORED: { label: 'Ignored', description: 'Acknowledged and skipped' },
  REGRESSED: { label: 'Regressed', description: 'Same Flag, worse than before' },
} as const

export const RECHECK_DIFF_COPY = {
  title: 'Prove your fixes with an update review',
  celebrationTitle: (n: number) => (n === 1 ? '1 flag cleared' : `${n} flags cleared`),
  celebrationBody: 'Your update review confirms the fixes. Keep going on what is still open.',
  nextFixHint: 'Next up',
  cleared: 'Fixed',
  remaining: 'Still open',
  newIssues: 'New',
  regressed: 'Regressed',
  empty: 'No flag changes on this update review.',
  compareCta: 'Open full before/after',
  compareProHint: 'Want side-by-side screenshots?',
  compareProCta: 'See Pro compare',
  outcomesHint:
    'Outcomes: Fixed, still open, unchanged severity, regressed, or unable to verify.',
  compareProGateDescription:
    'Before/after comparison is available on Pro. Update reviews use product review credits.',
} as const

export const FLAG_DISMISS_REASONS = [
  { id: 'incorrect', label: 'Incorrect' },
  { id: 'intentional', label: 'Intentional' },
  { id: 'already_fixed', label: 'Already fixed' },
  { id: 'low_priority', label: 'Low priority' },
  { id: 'duplicate', label: 'Duplicate' },
] as const

export type FlagDismissReasonId = (typeof FLAG_DISMISS_REASONS)[number]['id']

export const FLAG_FEEDBACK_COPY = {
  thanksUp: 'Thanks for the feedback!',
  thanksDown: "Got it, we'll improve this.",
  saveFailed: 'Failed to save feedback',
  dismissPrompt: 'Why are you dismissing this flag?',
  dismissed: 'Flag dismissed.',
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
