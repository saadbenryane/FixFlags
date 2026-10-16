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
import { SECURITY_HEADER_LIMITATION } from './security-headers'
import { summarizeCheckAssertions } from './receipt'
import { scopeRenderedPageEvidence } from './rendered-page-evidence'

export type { DeterministicFlag } from '../flag-types'
export type { AxeViolation } from './accessibility'
export interface RunAllChecksResult {
  flags: DeterministicFlag[]
  failedModules: string[]
  executions: Array<{ module: string; passed: boolean; applicable: boolean; failed?: boolean; complete?: boolean; limitation?: string; collectedAt?: string; assertions?: CheckAssertion[] }>
}

/** Legacy adapter and progressive tasks invoke the same validated registrations. */
export async function runAllChecks(
  url: string, metadata: PageMetadata | null, desktop: PageSpeedResult | null, mobile: PageSpeedResult | null,
  consoleErrors: Array<{ type: string; text: string }>, onAreaComplete?: (index: number) => void,
  captureMetrics?: CaptureMetrics | null, responseHeaders?: Record<string, string> | null,
  axeViolations?: AxeViolation[], searchHandled = false, selectedModules?: readonly string[],
  runtimeEvidence?: { renderedCopy?: import('../browser/rendered-copy').RenderedCopy | null; tracking?: import('../tracking/contracts').TrackingEvidence; consoleCoverage?: import('../console-evidence').ConsoleCoverage;
    head?: import('./head-metadata').HeadMetadataObservation;
    publicDocument?: import('../search/contracts').PublicDocument;
    accessibilityEvidence?: import('../browser/accessibility-evidence').AccessibilityEvidence; renderedScope?: import('../browser/observation-scope').CaptureObservationScope; deadline?: number;
    allowedCheckIds?: readonly string[]; area?: import('@/lib/sites/card-areas').SiteCardArea },
): Promise<RunAllChecksResult> {
  if (selectedModules?.some(id => !PAGE_CHECKS.has(id))) throw new Error('Unregistered page check requested')
  const selected = [...PAGE_CHECKS.values()].filter(check => !selectedModules || selectedModules.includes(check.id))
  const purpose: PageCheckContext['purpose'] = metadata ? detectPagePurpose(metadata, url) : { purpose: 'unknown', reasons: ['Page metadata is unavailable'] }
  const results = await Promise.all(selected.map(async (check, index) => {
    const assertions: CheckAssertion[] = []
    const input: PageCheckContext = { url, metadata, desktop, mobile, consoleErrors, purpose,
      head: runtimeEvidence?.head,
      scope: {}, deadline: runtimeEvidence?.deadline, tracking: runtimeEvidence?.tracking, consoleCoverage: runtimeEvidence?.consoleCoverage,
      accessibilityEvidence: runtimeEvidence?.accessibilityEvidence, renderedCopy: runtimeEvidence?.renderedCopy, renderedScope: runtimeEvidence?.renderedScope,
      publicDocument: runtimeEvidence?.publicDocument, metrics: captureMetrics, headers: responseHeaders, axe: axeViolations, record: assertion => {
        const definition = check.definition.assertions[assertion.key]
        if (!runtimeEvidence?.allowedCheckIds || definition && (definition.area === runtimeEvidence.area ||
          definition.verifies.some(id => runtimeEvidence.allowedCheckIds!.includes(id)))) assertions.push(assertion)
      } }
    try {
      const evaluated = await check.evaluate(input)
      let flags = runtimeEvidence?.allowedCheckIds ? evaluated.filter(flag => runtimeEvidence.allowedCheckIds!.includes(flag.checkId.split('::page:')[0])) : evaluated
      if (check.id !== 'metadata' && check.id !== 'measurement' && check.id !== 'accessibility') assertions.push(...recordCheckObservations(check.id, {
        url, metadata, desktop, mobile, headers: responseHeaders, consoleCoverage: runtimeEvidence?.consoleCoverage,
      }))
      if (runtimeEvidence?.allowedCheckIds) {
        const permitted = assertions.filter(assertion => {
          const definition = check.definition.assertions[assertion.key]
          return definition && (definition.area === runtimeEvidence.area || definition.verifies.some(id => runtimeEvidence.allowedCheckIds!.includes(id)))
        })
        assertions.splice(0, assertions.length, ...permitted)
      }
      if (check.id === 'security-headers') {
        input.scope.complete = assertions.every(assertion => assertion.complete !== false)
        if (!input.scope.complete) input.scope.limitation = SECURITY_HEADER_LIMITATION
      }
      const scoped = scopeRenderedPageEvidence({ module: check.id, flags, assertions,
        desktop: check.id === 'metadata' ? runtimeEvidence?.head?.scope ?? runtimeEvidence?.renderedScope : runtimeEvidence?.renderedScope,
        mobile: captureMetrics?.loadingObservation?.scope })
      flags = scoped.flags
      assertions.splice(0, assertions.length, ...scoped.assertions)
      const summary = summarizeCheckAssertions({ passed: flags.length === 0, complete: input.scope.complete, assertions })
      if (summary.complete === false) {
        input.scope.complete = false
        input.scope.limitation ??= 'A required observation could not be completed. Missing evidence does not establish a passing result.'
      }
      return { flags, execution: { module: check.id, ...input.scope, ...summary,
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
