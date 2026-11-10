export const FLAG_STATUS_LABELS = {
  OPEN: { label: 'Open', description: 'Not fixed yet' },
  FIXED: { label: 'Verified', description: 'Independent check of the same behavior passed' },
  IGNORED: { label: 'Ignored', description: 'Acknowledged and skipped' },
  REGRESSED: { label: 'Regressed', description: 'Same Flag, worse than before' },
} as const

export const RECHECK_DIFF_COPY = {
  title: 'See what changed in this recheck',
  celebrationTitle: (n: number) =>
    n === 1 ? '1 Flag Fixed' : `${n} Flags Fixed`,
    celebrationBody:
    'These Flags were not observed on pages this recheck rechecked. Verification receipts show whether an attempted Improvement worked.',
  nextFixHint: 'Next up',
  cleared: 'Fixed',
  remaining: 'Still open',
  newIssues: 'New',
  regressed: 'Regressed',
  inconclusive: 'Inconclusive',
  /** Short muted note under the summary line - not a second hero banner. */
  inconclusiveNotePartial: (count: number) =>
    `${count} ${count === 1 ? 'Flag needs' : 'Flags need'} pages that were not rechecked in this review before Fixed can be credited.`,
  inconclusiveNoteGeneric: (count: number) =>
    `${count} ${count === 1 ? 'Flag has' : 'Flags have'} insufficient comparable coverage between reviews.`,
  /** @deprecated Prefer inconclusiveNotePartial; kept for compare page until aligned. */
  inconclusiveBody: (count: number) =>
    `${count} ${count === 1 ? 'Flag needs' : 'Flags need'} pages that were not rechecked in this review before Fixed can be credited.`,
  inconclusiveBodyPartial: (count: number) =>
    `${count} ${count === 1 ? 'Flag needs' : 'Flags need'} pages that were not rechecked in this review before Fixed can be credited.`,
  inconclusiveBodyGeneric: (count: number) =>
    `${count} ${count === 1 ? 'Flag has' : 'Flags have'} insufficient comparable coverage between reviews.`,
  empty: 'No Flag changes in this recheck.',
  scoreOffsetLabel: 'Why the score moved',
  compareCta: 'Compare',
  compareProHint: 'See the evidence side by side.',
  compareProCta: 'Compare',
  fixedInfoLabel: 'What Fixed means',
  fixedInfoIntro:
    'Not observed in this recheck on pages that were rechecked:',
  compareProGateDescription:
    'Before/after comparison is included on every plan. Rechecks use the monthly product review allowance.',
  summaryLine: (parts: {
    stillOpen: number
    newlyFound: number
    inconclusive: number
    cleared: number
    regressed: number
  }) => {
    const bits: string[] = []
    if (parts.cleared > 0) bits.push(`${parts.cleared} Fixed`)
    if (parts.stillOpen > 0) bits.push(`${parts.stillOpen} still open`)
    if (parts.newlyFound > 0) bits.push(`${parts.newlyFound} new`)
    if (parts.regressed > 0) bits.push(`${parts.regressed} regressed`)
    if (parts.inconclusive > 0) bits.push(`${parts.inconclusive} inconclusive`)
    return bits.join(' · ')
  },
  foundOnNewPage: 'Found on a newly reviewed page',
  foundOnReviewedPage: 'Found on a page already reviewed',
  newSplit: (reviewed: number, fresh: number) =>
    `${reviewed} on pages already reviewed · ${fresh} on newly reviewed pages`,
  newInfoLabel: 'What New means',
  newInfoIntro:
    'Not observed in the previous Review. Pages already reviewed should have been caught the first time. Newly reviewed pages are extra coverage.',
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

export const SAVED_FINDING_COPY = {
  recommendation: 'Recommendation',
  observation: 'Observation',
  flag: (severity?: string | null) => severity ? `${severity.toLowerCase()} Flag` : 'Flag',
  summary: 'Recorded website observations',
} as const
