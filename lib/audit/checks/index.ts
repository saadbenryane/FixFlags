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
import { runDesignLanguageChecks } from './design-language'
import { runMeasurementChecks } from './measurement'
import { runSecurityBasicsChecks } from './security'
import { runVisualPolishChecks } from './visual-polish'
import { logger } from '@/lib/logger'
import type { CaptureMetrics } from '../capture-metrics'

export interface DeterministicFlag {
  checkId: string
  rubric: 'MESSAGE' | 'EXPERIENCE' | 'REACH'
  impactTag?: 'CONVERSION' | 'REVENUE' | 'TRUST' | 'MEASUREMENT' | 'SHARING' | 'SEO' | 'ACCESSIBILITY' | null
  severity: 'CRITICAL' | 'IMPORTANT' | 'POLISH'
  problem: string
  evidence: string
  fix: string
  confidence: number
  source: 'DETERMINISTIC'
  pageUrl?: string
}

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
  captureMetrics?: CaptureMetrics | null
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
    { name: 'design-language', run: () => runDesignLanguageChecks(captureMetrics ?? null) },
    { name: 'measurement',     run: () => runMeasurementChecks(metadata) },
    { name: 'security',        run: () => runSecurityBasicsChecks(url, metadata) },
    { name: 'visual-polish',   run: () => runVisualPolishChecks(captureMetrics ?? null) },
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

  return { flags, failedModules }
}

export { SCAN_STEP_FAILURE_PENALTY, computeRubricScores } from './rubric'
export type { RubricScoreContext } from './rubric'
