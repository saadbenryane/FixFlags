import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import { runMetadataChecks } from './metadata-checks'
import { runPerformanceChecks } from './performance'
import { runAccessibilityChecks } from './accessibility'
import { runSeoChecks } from './seo'
import { runTrustChecks } from './trust'
import { runMobileChecks } from './mobile'
import { runContentChecks } from './content'

export interface DeterministicFinding {
  checkId: string
  area: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  problem: string
  evidence: string
  fix: string
  confidence: number
  source: 'DETERMINISTIC'
}

export async function runAllChecks(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  consoleErrors: Array<{ type: string; text: string }>
): Promise<DeterministicFinding[]> {
  const allFindings: DeterministicFinding[] = []

  const checkers = [
    () => runMetadataChecks(metadata),
    () => runPerformanceChecks(desktop, mobile),
    () => runAccessibilityChecks(metadata),
    () => runSeoChecks(url, metadata),
    () => runTrustChecks(url, metadata, consoleErrors),
    () => runMobileChecks(mobile),
    () => runContentChecks(metadata),
  ]

  for (const checker of checkers) {
    try {
      const findings = await checker()
      allFindings.push(...findings)
    } catch (err) {
      console.error('Check module failed:', err)
    }
  }

  // Deduplicate by checkId
  const seen = new Set<string>()
  return allFindings.filter((f) => {
    if (seen.has(f.checkId)) return false
    seen.add(f.checkId)
    return true
  })
}

export function computeAreaScores(
  findings: DeterministicFinding[],
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null
): Record<string, number | null> {
  const perf = desktop?.score ?? null
  const a11yScore = computeA11yScore(
    findings.filter((f) => f.area === 'ACCESSIBILITY')
  )
  const seoScore = computeSeoScore(
    findings.filter((f) => f.area === 'SEO'),
    desktop
  )
  const mobileScore = mobile?.score ?? null

  return {
    PERFORMANCE: perf,
    ACCESSIBILITY: a11yScore,
    SEO: seoScore,
    MOBILE: mobileScore,
    CONVERSION: null,
    TRUST: null,
    CONTENT: null,
  }
}

function computeA11yScore(findings: DeterministicFinding[]): number {
  let score = 100
  for (const f of findings) {
    if (f.severity === 'CRITICAL') score -= 25
    else if (f.severity === 'HIGH') score -= 15
    else if (f.severity === 'MEDIUM') score -= 8
    else if (f.severity === 'LOW') score -= 3
  }
  return Math.max(0, score)
}

function computeSeoScore(
  findings: DeterministicFinding[],
  desktop: PageSpeedResult | null
): number {
  let score = desktop?.score ? Math.round(desktop.score * 0.3) + 70 : 70
  for (const f of findings) {
    if (f.severity === 'CRITICAL') score -= 20
    else if (f.severity === 'HIGH') score -= 12
    else if (f.severity === 'MEDIUM') score -= 6
    else if (f.severity === 'LOW') score -= 2
  }
  return Math.max(0, Math.min(100, score))
}
