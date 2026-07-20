import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import { runMetadataChecks, runOgImageUrlCheck } from './metadata-checks'
import { runPerformanceChecks } from './performance'
import { runAccessibilityChecks } from './accessibility'
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

export type { DeterministicFlag } from '../flag-types'

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
  responseHeaders?: Record<string, string> | null
): Promise<RunAllChecksResult> {
  const allFindings: DeterministicFlag[] = []
  const failedModules: string[] = []

const checkers: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }> = [
    { name: 'metadata',        run: () => runMetadataChecks(metadata) },
    { name: 'og-image',        run: () => runOgImageUrlCheck(url, metadata) },
    { name: 'performance',     run: () => runPerformanceChecks(desktop, mobile) },
    { name: 'accessibility',   run: () => runAccessibilityChecks(metadata, desktop ?? mobile) },
    { name: 'seo',             run: () => runSeoChecks(url, metadata) },
    { name: 'trust',           run: () => runTrustChecks(url, metadata, consoleErrors) },
    { name: 'mobile',          run: () => runMobileChecks(mobile) },
    { name: 'content',         run: () => runContentChecks(metadata) },
    { name: 'slop',            run: () => runSlopChecks(metadata) },
    { name: 'layout',          run: () => runLayoutChecks(captureMetrics ?? null) },
    { name: 'interaction',     run: () => runInteractionChecks(captureMetrics ?? null) },
    { name: 'cta-focus',       run: () => runCtaFocusChecks(captureMetrics ?? null) },
    { name: 'measurement',     run: () => runMeasurementChecks(metadata) },
    { name: 'auth-checkout',   run: () => runAuthCheckoutChecks(url, metadata) },
    { name: 'security',        run: () => runSecurityBasicsChecks(url, metadata) },
    { name: 'security-headers', run: () => runSecurityHeaderChecks(url, responseHeaders ?? null) },
    { name: 'visual-polish',   run: () => runVisualPolishChecks(captureMetrics ?? null) },
    { name: 'messaging-clarity', run: () => runMessagingClarityChecks(metadata) },
    { name: 'conversion-friction', run: () => runConversionFrictionChecks(metadata) },
    { name: 'trust-psychology', run: () => runTrustPsychologyChecks(metadata) },
    { name: 'visual-hierarchy', run: () => runVisualHierarchyChecks(metadata, captureMetrics ?? null) },
    { name: 'mobile-ux-quality', run: () => runMobileUXQualityChecks(metadata, captureMetrics ?? null) },
  ]

  for (let i = 0; i < checkers.length; i++) {
    const { name, run } = checkers[i]
    try {
      const findings = await run()
      allFindings.push(...findings)
    } catch (err) {
      logger.error(`Check module "${name}" failed`, err)
      failedModules.push(name)
    }
    onAreaComplete?.(i)
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

export { SCAN_STEP_FAILURE_PENALTY, computeRubricScores } from './rubric'
export type { RubricScoreContext } from './rubric'

function suppressOverlappingFlags(flags: DeterministicFlag[]): DeterministicFlag[] {
  // Suppression graph: [broader_flag, specific_flag] pairs.
  // When both flags are present, the broader one is suppressed.
  const SUPPRESSIONS: Array<[string, string]> = [
    ['no-contact-info', 'trust-no-direct-contact'],
    ['hierarchy-competing-actions', 'competing-ctas'],
    ['mobile-input-zoom', 'form-inputs-zoom-mobile'],
    ['mobile-stuck-loading', 'loading-indicator-stuck'],
    ['mobile-load-delay-content', 'loading-state-slow'],
    ['heading-hierarchy-missing', 'hierarchy-no-sections'],
    ['flow-cta-unclickable', 'overlay-blocks-cta'],
    ['flow-pricing-nav-broken', 'overlay-blocks-nav'],
    ['flow-form-no-validation', 'overlay-blocks-form'],
  ]
  const ids = new Set(flags.map((flag) => flag.checkId))
  return flags.filter((flag) => {
    for (const [broader, specific] of SUPPRESSIONS) {
      if (flag.checkId === broader && ids.has(specific)) return false
    }
    return true
  })
}
