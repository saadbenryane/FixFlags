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
  confirmedFlag: (rubric: string, problem: string) => {
    const label = rubricLabel(rubric)
    const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
    return `I found ${article} ${label} Flag: ${problem}`
  },
  additionalFlags: (count: number) =>
    `I confirmed ${count} more ${count === 1 ? 'Flag' : 'Flags'}. They’re available in the Report while I finish judging what matters most.`,
} as const

function rubricLabel(rubric: string): string {
  const normalized = rubric.trim().toLowerCase()
  if (!normalized) return 'new'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
