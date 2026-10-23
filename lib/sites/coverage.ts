import type { RepairGuidanceState } from '@/lib/improvements/repair-guidance'
import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { FlagPriorityBand, FlagVerificationState } from '@/lib/sites/presentation'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import { checkAssertionsForVersion, CHECK_MODULES } from '@/lib/audit/check-registry'
import { searchEvidence } from './search-evidence'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { isResolvedFlagStatus } from '@/lib/audit/attention'
import { siteCoverageIsStale } from './evidence-freshness'

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
  /** Missing work in the current analysis, independent of confirmed findings. */
  incompleteReason?: string | null
}

export type SiteFlagSeed = {
  supportingEvidenceUnreadable?: boolean
  attentionPolicy?: unknown
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
  repairGuidance?: RepairGuidanceState
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

function passedAssertion(executions: Array<{ targetKey: string; status: string; detail?: unknown }>, module: string, assertion: string, historicalAssertion?: string): boolean {
  return executions.some(execution => {
    if (execution.targetKey !== 'module:' + module || execution.status !== 'COMPLETED') return false
    const receipt = readCheckReceipt(execution.detail)
    if (receipt.legacy || !('applicable' in receipt) || !receipt.applicable || receipt.failed || receipt.module !== module) return false
    const observed = receipt.assertions.find(item => item.key === assertion) ?? receipt.assertions.find(item => item.key === historicalAssertion)
    return observed?.passed === true && observed.complete !== false && observed.disposition !== 'observed'
  })
}

export type CoverageExecution = { targetKey: string; status: string; detail?: unknown; workKind?: string | null; pageUrl?: string | null }

function failedModuleArea(module: string): SiteCardArea | undefined {
  if (module.startsWith('search-')) return 'search'
  if (module === 'pagespeed' || module === 'slow-replay') return 'performance'
  if (module === 'journeys') return 'conversion'
  return CHECK_MODULES[module]?.area
}

function moduleAreas(module: string, version?: number): SiteCardArea[] {
  const areas = Object.values(checkAssertionsForVersion(module, version)).map(assertion => assertion.area)
  const fallback = failedModuleArea(module)
  return [...new Set(areas.length ? areas : fallback ? [fallback] : [])]
}

/** Completed runs can retain useful observations without establishing health. */
function incompleteAreaReason(input: {
  area: SiteCardArea; openFlagCount: number; evidenced: boolean;
  auditStatus: string | null; failureCode?: string | null; incomplete: boolean;
  triageCompleted?: boolean; extraReviewCompleted?: boolean;
}): string | null {
  if (input.auditStatus !== 'COMPLETED') return null
  if (input.incomplete) {
    return SITE_BOARD_COPY.cardCheckIncomplete
  }
  // Prescription enriches findings without invalidating an observed check.
  if (input.triageCompleted && !input.extraReviewCompleted && input.openFlagCount > 0 && input.area !== 'site' &&
    ['AI_CONTRACT_INVALID', 'AI_REVIEW_FAILED'].includes(input.failureCode ?? '')) return SITE_BOARD_COPY.cardReviewIncomplete
  if (input.failureCode && !input.evidenced && input.area !== 'site') return SITE_BOARD_COPY.cardCheckIncomplete
  return null
}

/** Current task plans define the expected keyboard scope. Historical axe-only
 * observations retain their original contract rather than acquiring new tasks. */
export function keyboardScopeComplete(executions: CoverageExecution[]) {
  return executions.filter(execution => execution.workKind === 'keyboard').every(task => executions.some(execution => {
    if (execution.targetKey !== 'module:keyboard' || execution.status !== 'COMPLETED' || execution.pageUrl !== task.pageUrl) return false
    const receipt = readCheckReceipt(execution.detail)
    return !receipt.legacy && 'complete' in receipt && receipt.complete === true &&
      (!receipt.applicable || ['focus-styles', 'keyboard-exit', 'tab-sequence'].every(key => receipt.assertions.some(assertion => assertion.key === key && assertion.passed)))
  }))
}

/** Areas that received concrete public evidence for this analysis. */
export function evidencedAreasFromCoverage(
  evidenceCoverage: unknown,
  flags: Array<{ checkId: string | null; rubric: string; impactTag: string | null }>,
  verifierExecutions: CoverageExecution[] = []
): Set<SiteCardArea> {
  const evidenced = new Set<SiteCardArea>()
  const evidence = parseEvidence(evidenceCoverage)

  if (evidence.desktopPageSpeed || evidence.mobilePageSpeed) evidenced.add('performance')
  if (evidence.metadata) evidenced.add('search')
  if (evidence.flowScan || evidence.journeyWalk) evidenced.add('conversion')
  if (evidence.desktopScreenshot && evidence.metadata) evidenced.add('uptime')
  if (passedAssertion(verifierExecutions, 'accessibility', 'automated-accessibility') && keyboardScopeComplete(verifierExecutions)) evidenced.add('accessibility')
  if (
    passedAssertion(verifierExecutions, 'security', 'https') &&
    passedAssertion(verifierExecutions, 'security', 'resource-transport', 'image-transport')
  ) {
    evidenced.add('security')
  }
  if (passedAssertion(verifierExecutions, 'measurement', 'analytics-markup')) evidenced.add('tracking')

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
  coverageMaxAgeMs?: number
  evidenceCoverage: unknown
  failureCode?: string | null
  failedModules?: unknown
  triageCompleted?: boolean
  extraReviewCompleted?: boolean
  flags: Array<{
    checkId: string | null
    rubric: string
    severity: string
    impactTag: string | null
    status?: string | null
  }>
  verifierExecutions?: CoverageExecution[]
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
  const openFlags = input.flags.filter(flag => !isResolvedFlagStatus(flag.status?.toUpperCase()))
  const lastKnownByArea = new Map(
    (input.lastKnown ?? []).map((fact) => [fact.area, fact] as const)
  )

  for (const flag of openFlags) {
    const area = cardAreaForCheck(flag)
    openByArea.set(area, (openByArea.get(area) ?? 0) + 1)
  }

  const evidenced = evidencedAreasFromCoverage(
    input.evidenceCoverage,
    openFlags,
    input.verifierExecutions
  )
  const evidence = parseEvidence(input.evidenceCoverage)
  const journeyRan = Boolean(evidence.flowScan || evidence.journeyWalk)
  const pageSpeedRan = Boolean(evidence.desktopPageSpeed || evidence.mobilePageSpeed)
  const executions = input.verifierExecutions ?? []
  const search = searchEvidence(executions)
  const incompleteAreas = new Set<SiteCardArea>()
  const gapsByModule = new Map<string, Set<SiteCardArea>>()
  const runtimeTracking = executions.some(execution => {
    if (execution.targetKey !== 'module:measurement' || execution.status !== 'COMPLETED') return false
    const receipt = readCheckReceipt(execution.detail)
    return !receipt.legacy && 'execution' in receipt && receipt.execution?.source === 'browser-network'
  })
  for (const execution of executions) {
    if (!execution.targetKey.startsWith('module:') || execution.status === 'NOT_APPLICABLE') continue
    const moduleKey = execution.targetKey.slice('module:'.length)
    const receipt = readCheckReceipt(execution.detail)
    const missing = receipt.assertions.filter(assertion => assertion.complete === false)
    const failed = execution.status === 'FAILED' || !receipt.legacy && 'failed' in receipt && receipt.failed === true
    const incomplete = !receipt.legacy && 'complete' in receipt && receipt.complete === false
    // A shared module can inspect several customer areas. Attribute explicit
    // gaps to their assertions; an unavailable collector leaves all of its
    // registered responsibilities unknown. The customer reason stays generic.
    const version = !receipt.legacy && 'execution' in receipt ? receipt.execution?.checkVersion : undefined
    if (!failed && !incomplete && !missing.length) continue
    const areas = failed || !missing.length ? moduleAreas(moduleKey, version) : missing.flatMap(assertion => {
      const area = checkAssertionsForVersion(moduleKey, version)[assertion.key]?.area
      return area ? [area] : moduleAreas(moduleKey, version)
    })
    const gaps = gapsByModule.get(moduleKey) ?? new Set<SiteCardArea>()
    for (const area of areas) { gaps.add(area); incompleteAreas.add(area) }
    gapsByModule.set(moduleKey, gaps)
  }
  for (const moduleKey of Array.isArray(input.failedModules) ? input.failedModules : []) {
    if (typeof moduleKey !== 'string') continue
    for (const area of gapsByModule.get(moduleKey) ?? moduleAreas(moduleKey)) incompleteAreas.add(area)
  }

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
    const incompleteReason = (area === 'search' && search && !search.complete && !inFlight
      ? SITE_BOARD_COPY.cardCheckIncomplete : null)
      ?? incompleteAreaReason({ area, openFlagCount, evidenced: evidenced.has(area), auditStatus: input.auditStatus,
        failureCode: input.failureCode, incomplete: incompleteAreas.has(area),
        triageCompleted: input.triageCompleted, extraReviewCompleted: input.extraReviewCompleted })
      ?? (!inFlight && incompleteAreas.has(area) ? SITE_BOARD_COPY.cardCheckIncomplete : null)

    // A committed failure is immediately useful even while unrelated work is
    // still running. A previous healthy card cannot conceal this execution's Flag.
    if (openFlagCount > 0) {
      const important = openFlags.some(flag => cardAreaForCheck(flag) === area && ['CRITICAL', 'IMPORTANT'].includes(flag.severity))
      return { area, state: (important ? 'problem' : 'attention') as CardHealthState,
        label: openFlagCount === 1 ? '1 thing needs attention' : `${openFlagCount} things need attention`,
        detail: null, checkedAt, openFlagCount, evidenced: true, incompleteReason }
    }

    if (area === 'search' && search) {
      const stale = search.receipts.some(receipt => siteCoverageIsStale(receipt.collectedAt, input.now, input.coverageMaxAgeMs))
      const complete = search.complete && !search.excluded && !incompleteReason && !stale
      return { area, state: complete ? 'healthy' : 'unknown',
        label: stale ? SITE_BOARD_COPY.checkOutOfDate : search.excluded ? SEARCH_COPY.summary.excluded : search.complete ? SEARCH_COPY.summary.recorded : SEARCH_COPY.summary.partial,
        detail: stale ? SITE_BOARD_COPY.checkOutOfDateDetail : search.excluded ? SEARCH_COPY.summary.restriction : search.complete ? SEARCH_COPY.summary.scope(search.receipts.length) : SEARCH_COPY.partial,
        checkedAt: search.checkedAt, openFlagCount: 0, evidenced: search.evidenced, stale, incompleteReason }
    }

    // A loaded library or attempted request cannot prove delivery or consent.
    if (incompleteReason || incompleteAreas.has(area) || (area === 'tracking' && runtimeTracking)) {
      return { area, state: 'unknown', label: incompleteReason ?? 'Couldn’t verify',
        detail: null, checkedAt, openFlagCount: 0, evidenced: area === 'tracking' && runtimeTracking ? false : evidenced.has(area), incompleteReason }
    }

    if (inFlight && evidenced.has(area) && ['security', 'tracking', 'accessibility'].includes(area)) {
      const copy = healthyEvidenceCopy(area, evidence)
      const collected = (input.verifierExecutions ?? []).flatMap(execution => {
        if (CHECK_MODULES[execution.targetKey.replace(/^module:/, '')]?.area !== area) return []
        const receipt = readCheckReceipt(execution.detail)
        return !receipt.legacy && 'execution' in receipt && receipt.execution ? [receipt.execution.collectedAt] : []
      }).sort().at(-1) ?? null
      return { area, state: 'healthy' as const, label: copy.answer, detail: copy.detail,
        checkedAt: collected, openFlagCount: 0, evidenced: true }
    }

    if ((inFlight || input.auditStatus === 'FAILED') && input.retainLastKnownWhileChecking && prior) {
      if (prior.state === 'healthy' && siteCoverageIsStale(prior.checkedAt, input.now, input.coverageMaxAgeMs)) {
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

    if (siteCoverageIsStale(input.completedAt, input.now, input.coverageMaxAgeMs)) {
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
