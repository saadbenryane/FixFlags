import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { FlagPriorityBand, FlagVerificationState } from '@/lib/sites/presentation'

export type CoverageFact = {
  area: SiteCardArea
  state: CardHealthState
  label: string
  detail: string | null
  checkedAt: string | null
  openFlagCount: number
  /** True when this area had enough evidence to answer health. */
  evidenced: boolean
  /** Evidence exists but is too old to support a current healthy answer. */
  stale?: boolean
}

/** A completed broad Site check is current for one weekly Watch cycle plus a day of grace. */
export const SITE_COVERAGE_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000

export function siteCoverageIsStale(checkedAt: Date | string | null, now: Date): boolean {
  if (!checkedAt) return true
  const checkedAtMs = checkedAt instanceof Date ? checkedAt.getTime() : Date.parse(checkedAt)
  return !Number.isFinite(checkedAtMs) || now.getTime() - checkedAtMs >= SITE_COVERAGE_MAX_AGE_MS
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
  resolvedInId: string | null
  area: SiteCardArea
  affectedPaths: string[]
  affectedPageCount: number
  priorityBand: FlagPriorityBand
  priorityScore: number
  relatedOutcome: { id: string; name: string } | null
  verificationState: FlagVerificationState
  latestOccurrenceAt: string | null
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

function healthyEvidenceCopy(
  area: SiteCardArea,
  evidence: EvidenceCoverageShape
): { answer: string; detail: string } {
  switch (area) {
    case 'conversion':
      return SITE_BOARD_COPY.healthyEvidence.conversion
    case 'search':
      return SITE_BOARD_COPY.healthyEvidence.search
    case 'performance':
      if (evidence.desktopPageSpeed && evidence.mobilePageSpeed) {
        return SITE_BOARD_COPY.healthyEvidence.performance.both
      }
      if (evidence.mobilePageSpeed) return SITE_BOARD_COPY.healthyEvidence.performance.mobile
      return SITE_BOARD_COPY.healthyEvidence.performance.desktop
    case 'uptime':
      return SITE_BOARD_COPY.healthyEvidence.uptime
    case 'security':
      return SITE_BOARD_COPY.healthyEvidence.security
    case 'tracking':
      return SITE_BOARD_COPY.healthyEvidence.tracking
    case 'accessibility':
      return SITE_BOARD_COPY.healthyEvidence.accessibility
    default:
      return SITE_BOARD_COPY.healthyEvidence.fallback
  }
}

/** Completed check-module receipts Home must load. A Flag is not required. */
export const AREA_EVIDENCE_MODULE_KEYS = [
  'module:accessibility',
  'module:trust',
  'module:security',
  'module:measurement',
] as const

function completedModule(executions: Array<{ targetKey: string; status: string }>, key: string): boolean {
  return executions.some((execution) => execution.targetKey === key && execution.status === 'COMPLETED')
}

/** Areas that received concrete public evidence for this analysis. */
export function evidencedAreasFromCoverage(
  evidenceCoverage: unknown,
  flags: Array<{ checkId: string | null; rubric: string; impactTag: string | null }>,
  verifierExecutions: Array<{ targetKey: string; status: string }> = []
): Set<SiteCardArea> {
  const evidenced = new Set<SiteCardArea>()
  const evidence = parseEvidence(evidenceCoverage)

  if (evidence.desktopPageSpeed || evidence.mobilePageSpeed) evidenced.add('performance')
  if (evidence.metadata) evidenced.add('search')
  if (evidence.flowScan || evidence.journeyWalk) evidenced.add('conversion')
  if (evidence.desktopScreenshot && evidence.metadata) evidenced.add('uptime')
  if (completedModule(verifierExecutions, 'module:accessibility')) evidenced.add('accessibility')
  if (
    completedModule(verifierExecutions, 'module:trust') &&
    completedModule(verifierExecutions, 'module:security')
  ) {
    evidenced.add('security')
  }
  if (completedModule(verifierExecutions, 'module:measurement')) evidenced.add('tracking')

  for (const flag of flags) {
    evidenced.add(cardAreaForCheck(flag))
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
  now: Date
  evidenceCoverage: unknown
  flags: Array<{
    checkId: string | null
    rubric: string
    severity: string
    impactTag: string | null
    status?: string | null
  }>
  verifierExecutions?: Array<{ targetKey: string; status: string }>
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
    input.verifierExecutions
  )
  const evidence = parseEvidence(input.evidenceCoverage)
  const journeyRan = Boolean(evidence.flowScan || evidence.journeyWalk)
  const pageSpeedRan = Boolean(evidence.desktopPageSpeed || evidence.mobilePageSpeed)

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

    if ((inFlight || input.auditStatus === 'FAILED') && input.retainLastKnownWhileChecking && prior) {
      if (prior.state === 'healthy' && siteCoverageIsStale(prior.checkedAt, input.now)) {
        return { ...prior, state: 'unknown' as const, label: SITE_BOARD_COPY.checkOutOfDate,
          detail: SITE_BOARD_COPY.checkOutOfDateDetail, stale: true }
      }
      return {
        ...prior,
        state: prior.state,
        label: prior.label,
        detail: prior.detail,
        evidenced: prior.evidenced,
      }
    }

    if (inFlight) {
      return {
        area,
        state: 'unknown' as const,
        label: 'Waiting for evidence',
        detail: null,
        checkedAt: prior?.checkedAt ?? null,
        openFlagCount: prior?.openFlagCount ?? 0,
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
        evidenced: false,
      }
    }

    const areaEvidenced = evidenced.has(area) || openFlagCount > 0
    const requiredCheckRan =
      area === 'conversion' ? journeyRan : area === 'performance' ? pageSpeedRan : true

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
        evidenced: true,
      }
    }

    if (!areaEvidenced || !requiredCheckRan) {
      if (prior?.evidenced) {
        return {
          ...prior,
          state: 'unknown' as const,
          label: SITE_BOARD_COPY.checkOutOfDate,
          detail: 'Previous evidence retained. This area was not verified by the latest check.',
          openFlagCount,
          evidenced: true,
          stale: true,
        }
      }
      return {
        area,
        state: 'unknown' as const,
        label: 'Not checked yet',
        detail: 'No public evidence for this area yet',
        checkedAt: null,
        openFlagCount: 0,
        evidenced: false,
      }
    }

    if (siteCoverageIsStale(input.completedAt, input.now)) {
      return {
        area,
        state: 'unknown' as const,
        label: SITE_BOARD_COPY.checkOutOfDate,
        detail: SITE_BOARD_COPY.checkOutOfDateDetail,
        checkedAt,
        openFlagCount: 0,
        evidenced: true,
        stale: true,
      }
    }

    const copy = healthyEvidenceCopy(area, evidence)
    return {
      area,
      state: 'healthy' as const,
      label: copy.answer,
      detail: copy.detail,
      checkedAt,
      openFlagCount: 0,
      evidenced: true,
    }
  })
}
