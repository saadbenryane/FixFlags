import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import type { AxeViolation } from './accessibility'
import type { CheckAssertion } from './assertion'
import { PAGE_CHECKS, pageCheckApplicable, type PageCheckContext } from './catalog'
import { logger } from '@/lib/logger'
import { filterToolingPathFlags } from '../tooling-path-filter'
import { detectPagePurpose } from '../page-purpose'
import { suppressOverlappingFlags } from '../suppression'
import { recordCheckObservations } from './observations'
import { SEARCH_HANDLED_CHECK_IDS } from '../search/inventory'

export type { DeterministicFlag } from '../flag-types'
export type { AxeViolation } from './accessibility'
export interface RunAllChecksResult {
  flags: DeterministicFlag[]
  failedModules: string[]
  executions: Array<{ module: string; passed: boolean; applicable: boolean; failed?: boolean; complete?: boolean; limitation?: string; assertions?: CheckAssertion[] }>
}

/** Legacy adapter and progressive tasks invoke the same validated registrations. */
export async function runAllChecks(
  url: string, metadata: PageMetadata, desktop: PageSpeedResult | null, mobile: PageSpeedResult | null,
  consoleErrors: Array<{ type: string; text: string }>, onAreaComplete?: (index: number) => void,
  captureMetrics?: CaptureMetrics | null, responseHeaders?: Record<string, string> | null,
  axeViolations?: AxeViolation[], searchHandled = false, selectedModules?: readonly string[],
  runtimeEvidence?: { tracking?: import('../tracking/contracts').TrackingEvidence },
): Promise<RunAllChecksResult> {
  if (selectedModules?.some(id => !PAGE_CHECKS.has(id))) throw new Error('Unregistered page check requested')
  const selected = [...PAGE_CHECKS.values()].filter(check => !selectedModules || selectedModules.includes(check.id))
  const purpose = detectPagePurpose(metadata, url)
  const results = await Promise.all(selected.map(async (check, index) => {
    const assertions: CheckAssertion[] = []
    const input: PageCheckContext = { url, metadata, desktop, mobile, consoleErrors, purpose,
      scope: {}, tracking: runtimeEvidence?.tracking, metrics: captureMetrics, headers: responseHeaders, axe: axeViolations, record: assertion => assertions.push(assertion) }
    try {
      const flags = await check.evaluate(input)
      if (check.id !== 'metadata' && check.id !== 'measurement') assertions.push(...recordCheckObservations(check.id, {
        url, metadata, desktop, mobile, headers: responseHeaders, axe: axeViolations,
      }))
      return { flags, execution: { module: check.id, passed: flags.length === 0 && input.scope.complete !== false, ...input.scope,
        applicable: pageCheckApplicable(check.definition, input), assertions } }
    } catch (error) {
      logger.error(`Check module "${check.id}" failed`, error)
      return { flags: [] as DeterministicFlag[], execution: { module: check.id,
        passed: false, applicable: false, failed: true, assertions: [] } }
    } finally { onAreaComplete?.(index) }
  }))
  const seen = new Set<string>()
  const flags = results.flatMap(result => result.flags).filter(flag => {
    if (seen.has(flag.checkId)) return false
    seen.add(flag.checkId); return true
  })
  return { flags: filterToolingPathFlags(suppressOverlappingFlags(searchHandled
      ? flags.filter(flag => !SEARCH_HANDLED_CHECK_IDS.has(flag.checkId)) : flags)),
    failedModules: results.filter(result => result.execution.failed).map(result => result.execution.module),
    executions: results.map(result => result.execution) }
}

export { SCAN_STEP_FAILURE_PENALTY, computeRubricScores } from './rubric-scoring'
export type { RubricScoreContext } from './rubric-scoring'
export { suppressOverlappingFlags } from '../suppression'
