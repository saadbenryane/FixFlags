export const AGENT_SCAN_COPY = {
  preparing: 'I’m getting ready to experience the Product as a customer would.',
  capturing: 'I’m opening the Product on desktop and mobile to see what customers see.',
  capturePartial: 'I captured part of the experience. The report will identify what is missing.',
  captureUnavailable: 'I couldn’t capture the page evidence.',
  checking: 'I’m checking whether the message is clear, the experience works, and the Product can be reached.',
  journey: 'I’m following the primary customer path to see whether the next step stays clear.',
  prioritizing: 'I’m judging which confirmed Flags matter most to the customer experience.',
  finalizing: 'I’m connecting each recommendation to the evidence behind it.',
  ready: 'Your report is ready.',
  partiallyReady: 'Your report is ready with some evidence missing.',
  partialAi: 'The report is ready, but some fix guidance is still unavailable.',
  confirmedFlag: (rubric: string, problem: string, pathLabel?: string | null) => {
    const label = rubricLabel(rubric)
    const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
    if (pathLabel && pathLabel !== 'Home') {
      return `I found ${article} ${label} Flag on ${pathLabel}: ${problem}`
    }
    return `I found ${article} ${label} Flag: ${problem}`
  },
  additionalFlags: (count: number) =>
    `I confirmed ${count} more ${count === 1 ? 'Flag' : 'Flags'}. They’re available in the Report while I finish judging what matters most.`,
  updateOutcome: (counts: {
    fixed: number
    unchanged: number
    newIssues: number
    regressed: number
    inconclusive: number
  }) => {
    const parts: string[] = []
    if (counts.fixed > 0) {
      parts.push(
        `${counts.fixed} ${counts.fixed === 1 ? 'Flag from last time is gone' : 'Flags from last time are gone'}`
      )
    }
    if (counts.unchanged > 0) {
      parts.push(
        `${counts.unchanged} ${counts.unchanged === 1 ? 'is still open' : 'are still open'}`
      )
    }
    if (counts.newIssues > 0) {
      parts.push(
        `${counts.newIssues} new ${counts.newIssues === 1 ? 'observation appeared' : 'observations appeared'}`
      )
    }
    if (counts.regressed > 0) {
      parts.push(
        `${counts.regressed} ${counts.regressed === 1 ? 'Flag got worse' : 'Flags got worse'}`
      )
    }
    if (counts.inconclusive > 0) {
      parts.push(
        `${counts.inconclusive} ${counts.inconclusive === 1 ? 'Flag could not be compared' : 'Flags could not be compared'}`
      )
    }
    if (parts.length === 0) return 'This update review matches the last snapshot.'
    return `Update review: ${parts.join(', ')}.`
  },
  noAttention: (observationCount: number) =>
    observationCount > 0
      ? `I didn’t find anything that deserves action yet. ${observationCount} ${
          observationCount === 1 ? 'observation is' : 'observations are'
        } in the Report.`
      : 'I didn’t find anything that deserves action yet.',
} as const

function rubricLabel(rubric: string): string {
  const normalized = rubric.trim().toLowerCase()
  if (!normalized) return 'new'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
