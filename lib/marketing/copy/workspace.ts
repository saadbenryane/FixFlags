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
  currentEvidenceMissing: 'This method needs a fresh check. Earlier results are in History.',
  methodPassed: 'FixFlags completed this check.',
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

export const SITE_WORKSPACE_COPY = {
  attempts: (count: number) => `${count} ${count === 1 ? 'attempt' : 'attempts'}`,
  remaining: (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'} remaining`,
  milestones: { done: 'Recorded', current: 'In progress', pending: 'Queued', partial: 'Incomplete' },
  disconnected: 'Updates disconnected', queued: 'Queued', analyzing: 'Analyzing',
  findings: 'Findings',
  siteMenu: 'Website navigation', accountMenu: 'Account navigation',
  preview: 'Website preview', desktop: 'Desktop', mobile: 'Mobile',
  noCapture: 'No screenshot yet', captureUnavailable: 'Screenshot unavailable',
  latestCapture: 'Latest capture', previousCapture: 'Previous capture', timeUnknown: 'Capture time unavailable',
  openCapture: (host: string) => `Open captured page for ${host}`,
  analysisCadence: 'Website analysis', monitoringOff: 'Not scheduled',
  technicalDetails: 'Technical details',
} as const
