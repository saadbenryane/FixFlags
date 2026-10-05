import { REPORT_COPY } from './report-workspace'

/** Workspace chrome copy extracted from report surfaces. */
export const WORKSPACE_COPY = REPORT_COPY.workspace

export const OUTCOME_DETAIL_COPY = {
  back: 'Back to Site home',
  state: 'Current answer',
  expectedResult: 'Expected customer result',
  lastSuccessfulVerification: 'Last successful verification',
  paused: 'Paused',
  neverVerified: 'No completed verification yet',
  evidenceHeading: 'Independent evidence',
  noEvidence: 'This method has not produced evidence yet.',
  limitationHeading: 'What FixFlags could not establish',
  flagsHeading: 'Flags',
  noFlags: 'No open Flag is tied to this Outcome.',
  pagesHeading: 'Covered pages',
  historyHeading: 'History',
  noHistory: 'No verification history yet.',
  mechanismHeading: 'How this is checked',
  pause: 'Pause Outcome',
  enable: 'Enable Outcome',
  pauseHelp: 'Pausing preserves existing evidence and stops new scheduled or manual verification.',
} as const
