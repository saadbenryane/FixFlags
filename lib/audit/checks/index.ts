import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import { runMetadataChecks, runOgImageUrlCheck } from './metadata-checks'
import { runPerformanceChecks } from './performance'
import { runAccessibilityChecks, type AxeViolation } from './accessibility'
import { runSeoChecks } from './seo'
import { runTrustChecks } from './trust'
import { runMobileChecks } from './mobile'
import { runContentChecks } from './content'
import { runSlopChecks } from './slop'
import { runLayoutChecks } from './layout'
import { runInteractionChecks } from './interaction'
import { runMeasurementChecks } from './measurement'
import { runSecurityBasicsChecks } from './security'
import { runSecurityHeaderChecks } from './security-headers'
import { runVisualPolishChecks } from './visual-polish'
import { runCtaFocusChecks } from './cta-focus'
import { runAuthCheckoutChecks } from './auth-checkout'
import { runMessagingClarityChecks } from './messaging-clarity'
import { runConversionFrictionChecks } from './conversion-friction'
import { runTrustPsychologyChecks } from './trust-psychology'
import { runVisualHierarchyChecks } from './visual-hierarchy'
import { runMobileUXQualityChecks } from './mobile-ux-quality'
import { logger } from '@/lib/logger'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { filterToolingPathFlags } from '../tooling-path-filter'
import { detectPagePurpose } from '../page-purpose'
import { suppressOverlappingFlags } from '../suppression'

export type { DeterministicFlag } from '../flag-types'
export type { AxeViolation } from './accessibility'

export interface RunAllChecksResult {
  flags: DeterministicFlag[]
  failedModules: string[]
}

export async function runAllChecks(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  consoleErrors: Array<{ type: string; text: string }>,
  onAreaComplete?: (index: number) => void,
  captureMetrics?: CaptureMetrics | null,
  responseHeaders?: Record<string, string> | null,
  axeViolations?: AxeViolation[],
  ariaSnapshot?: string | null
): Promise<RunAllChecksResult> {
  const failedModules: string[] = []

  // Detect the page's high-level purpose once. Conversion-friction, content,
  // and trust-psychology checks gate on this so they do not fire on docs,
  // articles, placeholder domains, or open-source project pages where the
  // "missing trial / contact / authority signal" is not actionable.
  const purpose = detectPagePurpose(metadata, url)

  // Group checks into independent buckets for parallel execution.
  // Each bucket reads from different data sources, so they can run concurrently.
  const bucketA: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }> = [
    { name: 'metadata',        run: () => runMetadataChecks(metadata) },
    { name: 'og-image',        run: () => runOgImageUrlCheck(url, metadata) },
    { name: 'accessibility',   run: () => runAccessibilityChecks(metadata, desktop ?? mobile, axeViolations) },
    { name: 'seo',             run: () => runSeoChecks(url, metadata) },
    { name: 'trust',           run: () => runTrustChecks(url, metadata, consoleErrors) },
    { name: 'content',         run: () => runContentChecks(metadata, purpose) },
    { name: 'slop',            run: () => runSlopChecks(metadata) },
    { name: 'measurement',     run: () => runMeasurementChecks(metadata) },
    { name: 'auth-checkout',   run: () => runAuthCheckoutChecks(url, metadata) },
    { name: 'security',        run: () => runSecurityBasicsChecks(url, metadata) },
    { name: 'security-headers', run: () => runSecurityHeaderChecks(url, responseHeaders ?? null) },
    { name: 'messaging-clarity', run: () => runMessagingClarityChecks(metadata) },
    { name: 'conversion-friction', run: () => runConversionFrictionChecks(metadata, purpose) },
    { name: 'trust-psychology', run: () => runTrustPsychologyChecks(metadata, purpose) },
  ]

  const bucketB: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }> = [
    { name: 'performance',     run: () => runPerformanceChecks(desktop, mobile) },
    { name: 'mobile',          run: () => runMobileChecks(mobile) },
    { name: 'mobile-ux-quality', run: () => runMobileUXQualityChecks(metadata, captureMetrics ?? null) },
  ]

  const bucketC: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }> = [
    { name: 'layout',          run: () => runLayoutChecks(captureMetrics ?? null) },
    { name: 'interaction',     run: () => runInteractionChecks(captureMetrics ?? null) },
    { name: 'cta-focus',       run: () => runCtaFocusChecks(captureMetrics ?? null) },
    { name: 'visual-polish',   run: () => runVisualPolishChecks(captureMetrics ?? null) },
    { name: 'visual-hierarchy', run: () => runVisualHierarchyChecks(metadata, captureMetrics ?? null) },
  ]

  async function runBucket(checkers: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }>): Promise<DeterministicFlag[]> {
    const findings: DeterministicFlag[] = []
    for (let i = 0; i < checkers.length; i++) {
      const { name, run } = checkers[i]
      try {
        const results = await run()
        findings.push(...results)
      } catch (err) {
        logger.error(`Check module "${name}" failed`, err)
        failedModules.push(name)
      }
    }
    return findings
  }

  // Run all three buckets in parallel.
  const [bucketAResults, bucketBResults, bucketCResults] = await Promise.allSettled([
    runBucket(bucketA),
    runBucket(bucketB),
    runBucket(bucketC),
  ])

  const allFindings: DeterministicFlag[] = []
  for (const result of [bucketAResults, bucketBResults, bucketCResults]) {
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value)
    } else {
      logger.error('Check bucket failed', result.reason)
    }
  }

  // Fire progress callbacks for all completed checkers.
  let globalIndex = 0
  for (const checker of [...bucketA, ...bucketB, ...bucketC]) {
    void checker // progress callbacks are informational; buckets ran in parallel
    onAreaComplete?.(globalIndex++)
  }

  // Deduplicate by checkId
  const seen = new Set<string>()
  const flags = allFindings.filter((f) => {
    if (seen.has(f.checkId)) return false
    seen.add(f.checkId)
    return true
  })

  return {
    flags: filterToolingPathFlags(suppressOverlappingFlags(flags)),
    failedModules,
  }
}

export { SCAN_STEP_FAILURE_PENALTY, computeRubricScores } from './rubric-scoring'
export type { RubricScoreContext } from './rubric-scoring'
export { suppressOverlappingFlags } from '../suppression'
