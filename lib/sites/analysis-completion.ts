const COLLECTION_FAILURES = new Set(['browser', 'http', 'pagespeed', 'captures', 'finalize'])

function pageWasCaptured(evidenceCoverage: unknown): boolean {
  if (!evidenceCoverage || typeof evidenceCoverage !== 'object' || Array.isArray(evidenceCoverage)) return false
  const evidence = evidenceCoverage as Record<string, unknown>
  return ['metadata', 'desktopScreenshot', 'mobileScreenshot', 'desktopPageSpeed', 'mobilePageSpeed']
    .some(key => evidence[key] === true)
}

/** Collection completion is independent of bounded gaps in the recorded coverage. */
export function analysisDidNotFinish(input: {
  failureCode: string | null
  reportCompleteness?: string | null
  failedModules?: unknown
  evidenceCoverage?: unknown
}): boolean {
  if (input.failureCode) return true
  const modules = Array.isArray(input.failedModules) ? input.failedModules.filter((module): module is string => typeof module === 'string') : []
  if (modules.some(module => COLLECTION_FAILURES.has(module))) return true
  return !pageWasCaptured(input.evidenceCoverage) && (input.reportCompleteness === 'PARTIAL' || modules.length > 0)
}
