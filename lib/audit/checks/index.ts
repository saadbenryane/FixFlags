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
import { logger } from '@/lib/logger'

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
  onAreaComplete?: (index: number) => void
): Promise<RunAllChecksResult> {
  const allFindings: DeterministicFlag[] = []
  const failedModules: string[] = []

  const checkers: Array<{ name: string; run: () => DeterministicFlag[] | Promise<DeterministicFlag[]> }> = [
    { name: 'metadata', run: () => runMetadataChecks(metadata) },
    { name: 'og-image', run: () => runOgImageUrlCheck(url, metadata) },
    { name: 'performance', run: () => runPerformanceChecks(desktop, mobile) },
    { name: 'accessibility', run: () => runAccessibilityChecks(metadata, desktop ?? mobile) },
    { name: 'seo', run: () => runSeoChecks(url, metadata) },
    { name: 'trust', run: () => runTrustChecks(url, metadata, consoleErrors) },
    { name: 'mobile', run: () => runMobileChecks(mobile) },
    { name: 'content', run: () => runContentChecks(metadata) },
    { name: 'slop', run: () => runSlopChecks(metadata) },
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

export function computeRubricScores(
  findings: DeterministicFlag[],
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null
): Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number | null> {
  const messageFindings = findings.filter((f) => f.rubric === 'MESSAGE')
  const experienceFindings = findings.filter((f) => f.rubric === 'EXPERIENCE')
  const reachFindings = findings.filter((f) => f.rubric === 'REACH')

  const perfScores = [desktop?.score, mobile?.score].filter((s): s is number => s !== null)

  let experience: number | null = null
  if (perfScores.length > 0) {
    let score = Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
    for (const f of experienceFindings) {
      score -= rubricPenalty(f.severity)
    }
    experience = Math.max(0, Math.min(100, score))
  } else if (experienceFindings.length > 0) {
    experience = scoreFromFindings(experienceFindings)
  }

  const message = messageFindings.length > 0 ? scoreFromFindings(messageFindings) : null
  const reach = reachFindings.length > 0 ? scoreFromFindings(reachFindings) : null

  return { MESSAGE: message, EXPERIENCE: experience, REACH: reach }
}

function rubricPenalty(severity: DeterministicFlag['severity']): number {
  switch (severity) {
    case 'CRITICAL':
      return 25
    case 'IMPORTANT':
      return 15
    case 'POLISH':
      return 5
  }
}

function scoreFromFindings(findings: DeterministicFlag[]): number {
  let score = 100
  for (const f of findings) {
    score -= rubricPenalty(f.severity)
  }
  return Math.max(0, Math.min(100, score))
}
