export const AGENT_SCAN_COPY = {
  preparing: 'I’m preparing your review.',
  capturing: 'I’m capturing the desktop and mobile experience.',
  capturePartial: 'I captured part of the experience. The report will identify what is missing.',
  captureUnavailable: 'I couldn’t capture the page evidence.',
  checking: 'I’m checking Message, Experience, and Reach.',
  journey: 'I’m reviewing the primary user journey.',
  prioritizing: 'I’m prioritizing the confirmed Flags by impact.',
  finalizing: 'I’m preparing your report.',
  ready: 'Your report is ready.',
  partiallyReady: 'Your report is ready with some evidence missing.',
  partialAi: 'The report is ready, but some fix guidance is still unavailable.',
  confirmedFlag: (rubric: string, problem: string) =>
    `I found a ${rubricLabel(rubric)} Flag: ${problem}`,
} as const

function rubricLabel(rubric: string): string {
  const normalized = rubric.trim().toLowerCase()
  if (!normalized) return 'new'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
