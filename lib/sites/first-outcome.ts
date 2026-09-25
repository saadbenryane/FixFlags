export const FIRST_OUTCOME_COPY = {
  title: 'No Outcome yet',
  body: 'The page walk finished. FixFlags did not confirm a purchase path. Confirm this page if it should keep responding.',
  action: 'Confirm this page',
} as const

/** Home subtitle. Watching is stated only when Watch is actually on. */
export function homeBoardLead(input: {
  checking: boolean
  hasOutcomePrompt: boolean
  flagCount: number
  healthy: boolean
  coverageSummary: string
  watchCovered: boolean
}): string {
  if (input.checking) return 'Learning your website. Cards update as each area finishes.'
  if (input.hasOutcomePrompt) return 'The page walk finished. Confirm the page that should keep responding.'
  if (input.flagCount > 0) {
    return input.watchCovered
      ? 'Outcomes FixFlags is watching, then the Flags that need you.'
      : 'The Flags that need you.'
  }
  if (input.healthy) return 'Checked areas look good. Unchecked areas stay unknown.'
  return input.coverageSummary
}

export function walkFinishedFromCoverage(
  status: string | null | undefined,
  evidenceCoverage: unknown,
): boolean {
  if (status !== 'COMPLETED') return false
  if (!evidenceCoverage || typeof evidenceCoverage !== 'object' || Array.isArray(evidenceCoverage)) {
    return false
  }
  const evidence = evidenceCoverage as { flowScan?: boolean; journeyWalk?: boolean }
  return Boolean(evidence.flowScan || evidence.journeyWalk)
}

/** Home prompt when a finished walk did not confirm a customer Outcome. */
export function firstOutcomePrompt(input: {
  checking: boolean
  walkFinished: boolean
  customerOutcomeCount: number
}): typeof FIRST_OUTCOME_COPY | null {
  if (input.checking || !input.walkFinished || input.customerOutcomeCount > 0) return null
  return FIRST_OUTCOME_COPY
}
