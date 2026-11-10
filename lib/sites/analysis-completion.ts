const COLLECTION_FAILURES = new Set(['browser', 'http', 'pagespeed', 'captures', 'finalize'])

export function hasEnrichmentFailure(input: { failureCode?: string | null; failureStage?: string | null }): boolean {
  switch (input.failureCode) {
    case 'AI_PROVIDER_NOT_CONFIGURED':
    case 'AI_CONTRACT_INVALID':
    case 'AI_BUDGET_UNAVAILABLE':
    case 'AI_PROVIDER_UNAVAILABLE':
    case 'AI_PROVIDER_REJECTED':
    case 'AI_REVIEW_FAILED':
      return true
    case 'AUDIT_TIMEOUT':
    case 'AUDIT_PIPELINE_FAILED':
      return input.failureStage === 'judging'
    default:
      return false
  }
}

function pageWasCaptured(evidenceCoverage: unknown): boolean {
  if (!evidenceCoverage || typeof evidenceCoverage !== 'object' || Array.isArray(evidenceCoverage)) return false
  const evidence = evidenceCoverage as Record<string, unknown>
  return ['metadata', 'desktopScreenshot', 'mobileScreenshot', 'desktopPageSpeed', 'mobilePageSpeed']
    .some(key => evidence[key] === true)
}

/** Collection completion is independent of bounded gaps in the recorded coverage. */
export function analysisDidNotFinish(input: {
  failureCode: string | null
  failureStage?: string | null
  reportCompleteness?: string | null
  failedModules?: unknown
  evidenceCoverage?: unknown
}): boolean {
  if (input.failureCode && !hasEnrichmentFailure(input)) return true
  const modules = Array.isArray(input.failedModules) ? input.failedModules.filter((module): module is string => typeof module === 'string') : []
  if (modules.some(module => COLLECTION_FAILURES.has(module))) return true
  return !pageWasCaptured(input.evidenceCoverage) && (input.reportCompleteness === 'PARTIAL' || modules.length > 0)
}
