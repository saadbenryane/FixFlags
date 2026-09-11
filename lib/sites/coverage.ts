import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { cardAreaForCheck } from '@/lib/sites/card-areas'

export type CoverageFact = {
  area: SiteCardArea
  state: CardHealthState
  label: string
  detail: string | null
  checkedAt: string | null
  openFlagCount: number
  score: number | null
  /** True when this area had enough evidence to answer health. */
  evidenced: boolean
}

export type SiteFlagSeed = {
  id: string
  sourceFlagId?: string | null
  confidence?: number | null
  improvementId: string | null
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  pageUrl: string | null
  status: string
  area: SiteCardArea
}

type EvidenceCoverageShape = {
  desktopScreenshot?: boolean
  mobileScreenshot?: boolean
  metadata?: boolean
  aiAssessment?: boolean
  desktopPageSpeed?: boolean
  mobilePageSpeed?: boolean
  flowScan?: boolean
  journeyWalk?: boolean
}

function parseEvidence(value: unknown): EvidenceCoverageShape {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as EvidenceCoverageShape
}

/** Areas that received concrete public evidence for this analysis. */
export function evidencedAreasFromCoverage(
  evidenceCoverage: unknown,
  flags: Array<{ checkId: string | null; rubric: string; impactTag: string | null }>,
  rubrics: Array<{ name: string; score: number | null }>
): Set<SiteCardArea> {
  const evidenced = new Set<SiteCardArea>()
  const evidence = parseEvidence(evidenceCoverage)

  if (evidence.desktopPageSpeed || evidence.mobilePageSpeed) evidenced.add('performance')
  if (evidence.metadata) evidenced.add('search')
  if (evidence.flowScan || evidence.journeyWalk) evidenced.add('conversion')

  for (const flag of flags) {
    evidenced.add(cardAreaForCheck(flag))
  }

  // Rubric scores only prove the areas they actually measure.
  for (const rubric of rubrics) {
    if (rubric.score == null) continue
    if (rubric.name === 'MESSAGE') evidenced.add('conversion')
    if (rubric.name === 'EXPERIENCE') evidenced.add('performance')
    // REACH is a mixed reachability rubric — do not paint Security/Search/Tracking healthy from it alone.
  }

  return evidenced
}

export function isAuditInFlight(status: string | null | undefined): boolean {
  if (!status) return true
  return !['COMPLETED', 'FAILED'].includes(status)
}

export function isAuditFinished(status: string | null | undefined): boolean {
  return status === 'COMPLETED'
}

export function buildCoverageFacts(input: {
  auditStatus: string
  completedAt: Date | null
  evidenceCoverage: unknown
  flags: Array<{
    checkId: string | null
    rubric: string
    severity: string
    impactTag: string | null
    status?: string | null
  }>
  rubrics: Array<{ name: string; score: number | null }>
  /**
   * When re-checking, pass last completed facts so cards keep prior health
   * while activity shows checking.
   */
  lastKnown?: CoverageFact[] | null
  retainLastKnownWhileChecking?: boolean
}): CoverageFact[] {
  const inFlight = isAuditInFlight(input.auditStatus)
  const checkedAt = input.completedAt?.toISOString() ?? null
  const openByArea = new Map<SiteCardArea, number>()
  const lastKnownByArea = new Map(
    (input.lastKnown ?? []).map((fact) => [fact.area, fact] as const)
  )

  for (const flag of input.flags) {
    if (flag.status && flag.status !== 'OPEN' && flag.status !== 'open') continue
    const area = cardAreaForCheck(flag)
    openByArea.set(area, (openByArea.get(area) ?? 0) + 1)
  }

  const evidenced = evidencedAreasFromCoverage(
    input.evidenceCoverage,
    input.flags,
    input.rubrics
  )

  const rubricScore = (name: string) =>
    input.rubrics.find((r) => r.name === name)?.score ?? null

  const areas: SiteCardArea[] = [
    'security',
    'search',
    'performance',
    'conversion',
    'tracking',
    'uptime',
    'accessibility',
  ]

  return areas.map((area) => {
    const openFlagCount = openByArea.get(area) ?? 0
    const prior = lastKnownByArea.get(area)
    let score: number | null = null
    if (area === 'conversion') score = rubricScore('MESSAGE')
    if (area === 'performance') score = rubricScore('EXPERIENCE')
    // Per-area scores only — never share one REACH score across three cards.
    if (area === 'search' && evidenced.has('search')) score = null

    if (inFlight && input.retainLastKnownWhileChecking && prior) {
      return {
        ...prior,
        state: prior.state === 'unknown' ? 'checking' : prior.state,
        label: prior.label,
        detail: prior.detail
          ? `${prior.detail} · Checking now`
          : 'Checking now — last known kept',
        score: null,
        evidenced: prior.evidenced,
      }
    }

    if (inFlight) {
      return {
        area,
        state: 'checking' as const,
        label: 'Checking now',
        detail: 'Live analysis in progress',
        checkedAt: prior?.checkedAt ?? null,
        openFlagCount: prior?.openFlagCount ?? 0,
        score: null,
        evidenced: false,
      }
    }

    if (input.auditStatus === 'FAILED') {
      return {
        area,
        state: 'unknown' as const,
        label: 'Couldn’t verify',
        detail: 'This analysis did not finish',
        checkedAt: null,
        openFlagCount,
        score: null,
        evidenced: false,
      }
    }

    const areaEvidenced = evidenced.has(area) || openFlagCount > 0

    if (openFlagCount > 0) {
      const criticalish = input.flags.some(
        (f) =>
          cardAreaForCheck(f) === area &&
          (f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')
      )
      return {
        area,
        state: (criticalish ? 'problem' : 'attention') as CardHealthState,
        label:
          openFlagCount === 1
            ? '1 thing needs attention'
            : `${openFlagCount} things need attention`,
        detail: null,
        checkedAt,
        openFlagCount,
        score: null,
        evidenced: true,
      }
    }

    if (!areaEvidenced) {
      return {
        area,
        state: 'unknown' as const,
        label: 'Not checked yet',
        detail: 'No public evidence for this area yet',
        checkedAt: null,
        openFlagCount: 0,
        score: null,
        evidenced: false,
      }
    }

    return {
      area,
      state: 'healthy' as const,
      label: 'Looking good',
      detail: score != null ? `Score ${score}` : 'Latest check passed for this area',
      checkedAt,
      openFlagCount: 0,
      score,
      evidenced: true,
    }
  })
}
