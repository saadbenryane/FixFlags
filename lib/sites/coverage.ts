import type { RepairGuidanceState, RepairDefinition } from '@/lib/improvements/repair-guidance'
import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { cardAreaForCheck, PAGES_CARD_AREA, SITE_CARD_AREAS } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { FlagPriorityBand, FlagVerificationState } from '@/lib/sites/presentation'
import { readCheckReceipt, recordedCheckVersion } from '@/lib/audit/checks/receipt'
import { resolvedPublicLinkCoverageGaps } from '@/lib/audit/checks/public-link-coverage'
import { checkAssertionsForVersion, CHECK_MODULES, CHECK_ASSERTIONS } from '@/lib/audit/checks/definitions'
import { searchEvidence } from './search-evidence'
import type { PageObservationScope, RecordedPageEvidenceScope } from './page-coverage'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { isResolvedFlagStatus } from '@/lib/audit/attention'
import { siteCoverageIsStale } from './evidence-freshness'
import { isLocalSearchTarget, isSearchProviderModule } from '@/lib/audit/search/definitions'
import type { RecordedSearchExecution } from '@/lib/audit/search/contracts'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { primaryActionControlKey, primaryActionResponseControl } from '@/lib/audit/flow/action-context'
import { matchesRecordedVerifierTask } from '@/lib/improvements/verifier-scope'

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
  repairDefinition?: RepairDefinition | null
  repairEvidenceRevision?: string
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

function passedAssertion(modules: RecordedModule[], module: string, assertion: string): boolean {
  return modules.some(({ execution, module: recorded, receipt }) => {
    if (recorded !== module || execution.status !== 'COMPLETED' || receipt.legacy || !receipt.applicable || receipt.failed) return false
    const observed = receipt.assertions.find(item => item.key === assertion)
    return observed?.passed === true && observed.complete !== false && observed.disposition !== 'observed'
  })
}

type ModuleCoverageExecution = RecordedSearchExecution & { taskId?: string | null }
export type CoverageExecution = ModuleCoverageExecution & { status: string; workKind?: string | null; scopeKey?: string | null }

type PageCheckReceipt = Extract<ReturnType<typeof readCheckReceipt>, { legacy: false }>
type PageCheckVerdict = { complete: boolean; passed: boolean }
type RecordedModule = { execution: ModuleCoverageExecution; module: string; receipt: ReturnType<typeof readCheckReceipt> }

/** An explicit provenance mismatch can supply neither assurance nor a gap.
 * Unreadable or unavailable evidence still matters on its admitted ledger page. */
function recordedModules(executions: readonly ModuleCoverageExecution[], scope?: RecordedPageEvidenceScope): RecordedModule[] {
  const pages = scope && new Set(scope.pages)
  const pageBound = new Set<string>()
  if (scope?.securityTransport) pageBound.add('security')
  if (scope?.accessibility?.automated) pageBound.add('accessibility')
  if (scope?.accessibility?.keyboard) pageBound.add('keyboard')
  if (scope?.tracking) pageBound.add('measurement')
  if (scope?.conversion) pageBound.add('flow')
  if (scope?.performance) { pageBound.add('performance'); pageBound.add('mobile') }
  const recorded: RecordedModule[] = []
  for (const execution of executions) {
    if (!execution.targetKey.startsWith('module:') || execution.auditId && scope && execution.auditId !== scope.auditId) continue
    if (scope?.search && isLocalSearchTarget(execution.targetKey)) continue
    const moduleKey = execution.targetKey.slice('module:'.length)
    const receipt = readCheckReceipt(execution.detail)
    if (!receipt.legacy) {
      const sourceAuditId = receipt.execution?.auditId
      if (moduleKey !== receipt.module || execution.pageUrl != null && execution.pageUrl !== receipt.pageUrl ||
        receipt.execution && !matchesRecordedVerifierTask(execution.taskId, receipt.execution.taskId) ||
        sourceAuditId && (execution.auditId && execution.auditId !== sourceAuditId || scope && scope.auditId !== sourceAuditId)) continue
    }
    const page = receipt.legacy ? execution.pageUrl : receipt.pageUrl
    if (page && pageBound.has(moduleKey) && !pages?.has(page)) continue
    recorded.push({ execution, module: moduleKey, receipt })
  }
  return recorded
}

function matchesPageObservation(execution: RecordedSearchExecution, receipt: PageCheckReceipt, auditId?: string,
  pages?: ReadonlySet<string>): boolean {
  return (execution.pageUrl == null || execution.pageUrl === receipt.pageUrl) &&
    (execution.auditId === undefined || execution.auditId === receipt.execution?.auditId) &&
    (auditId === undefined || auditId === receipt.execution?.auditId) &&
    (pages === undefined || pages.has(receipt.pageUrl))
}

/** Receipt evidence is local to one observation, admitted page and run. */
function pageCheckEvidence(modules: RecordedModule[], checkModule: string, assess: (receipt: PageCheckReceipt) => PageCheckVerdict | undefined,
  scope?: PageObservationScope, requiredPages = scope?.pages): PageCheckVerdict {
  const pages = new Map<string, PageCheckVerdict>()
  const expectedPages = requiredPages && new Set(requiredPages)
  for (const { execution, module, receipt } of modules) {
    if (module !== checkModule || execution.status !== 'COMPLETED' || receipt.legacy ||
      !matchesPageObservation(execution, receipt, scope?.auditId, expectedPages)) continue
    const observed = assess(receipt)
    if (!observed) continue
    const prior = pages.get(receipt.pageUrl)
    pages.set(receipt.pageUrl, { complete: (prior?.complete ?? true) && observed.complete, passed: (prior?.passed ?? true) && observed.passed })
  }
  const expected = requiredPages ? requiredPages.map(page => pages.get(page)) : [...pages.values()]
  const complete = expected.length > 0 && expected.every(page => page?.complete)
  return { complete, passed: complete && expected.every(page => page?.passed) }
}

/** Lab receipts bind a checked page and device. Field INP has a separate
 * observation even though it shares the desktop module name. */
function performanceLabEvidence(modules: RecordedModule[], scope?: RecordedPageEvidenceScope) {
  const required = scope?.performance
  if (!required) return undefined
  const device = (strategy: 'desktop' | 'mobile') => {
    const assertions = Object.entries(required[strategy])
    if (!assertions.length) return undefined
    return pageCheckEvidence(modules, strategy === 'desktop' ? 'performance' : 'mobile', receipt => {
      if (receipt.execution?.source !== `pagespeed-${strategy}`) return undefined
      const observed = assertions.map(([key, checks]) => checks.every(([id, version]) => recordedCheckVersion(receipt, id) === version)
        ? receipt.assertions.find(item => item.key === key && item.complete === true && !item.disposition) : undefined)
      const complete = receipt.applicable && !receipt.failed && observed.every(Boolean)
      return { complete, passed: complete && observed.every(item => item?.passed) }
    }, scope)
  }
  const desktop = device('desktop'), mobile = device('mobile')
  return { complete: (desktop?.complete ?? true) && (mobile?.complete ?? true),
    passed: (desktop?.passed ?? true) && (mobile?.passed ?? true), desktop, mobile }
}

/** Connection and resource assertions must come from the same public receipt. */
function securityTransportEvidence(modules: RecordedModule[], scope?: PageObservationScope) {
  return pageCheckEvidence(modules, 'security', receipt => {
    const https = receipt.assertions.find(item => item.key === 'https')
    const resources = receipt.assertions.find(item => item.key === 'resource-transport') ?? receipt.assertions.find(item => item.key === 'image-transport')
    const complete = receipt.applicable && !receipt.failed && https !== undefined &&
      https.complete !== false && https.disposition !== 'observed' && (!https.passed ||
        resources !== undefined && resources.complete !== false && resources.disposition !== 'observed')
    return { complete, passed: complete && https.passed && resources?.passed === true }
  }, scope)
}

/** A completed task can still have skipped the primary action or collected only
 * pricing. Require the recorded click and advancement on each applicable page. */
function conversionJourneyEvidence(modules: RecordedModule[], scope: PageObservationScope,
  pages: NonNullable<RecordedPageEvidenceScope['conversion']>): PageCheckVerdict {
  const expected = new Set(pages.keys()), verified = new Map<string, Set<string>>()
  let exercised = false
  for (const { execution, module, receipt } of modules) {
    if (module !== 'flow' || execution.status !== 'COMPLETED' || receipt.legacy || receipt.failed || receipt.complete !== true ||
      receipt.execution?.source !== 'rendered-dom' || !matchesPageObservation(execution, receipt, scope.auditId, expected)) continue
    const presence = receipt.assertions.find(item => item.key === 'primary-action-presence')
    if (!receipt.applicable && presence?.complete === true && !presence.passed && presence.disposition === 'observed') {
      if (!verified.has(receipt.pageUrl)) verified.set(receipt.pageUrl, new Set())
      continue
    }
    if (!receipt.applicable) continue
    const click = receipt.assertions.find(item => item.key === 'primary-action-click')
    const navigation = receipt.assertions.find(item => item.key === 'primary-action-navigation')
    const response = receipt.assertions.find(item => item.key === 'primary-action-response')
    if ([presence, click, navigation].every(item => item?.complete === true && item.passed && !item.disposition) &&
      click?.context && primaryActionControlKey(click.context) && navigation?.context === click.context &&
      response?.complete === true && response.passed &&
      (response.context === click.context || primaryActionResponseControl(response.context) === click.context)) {
      const controls = verified.get(receipt.pageUrl) ?? new Set<string>()
      controls.add(click.context)
      verified.set(receipt.pageUrl, controls)
      exercised = true
    }
  }
  const complete = pages.size > 0 && [...pages].every(([url, controls]) => {
    const observed = verified.get(url)
    return observed && controls.every(control => observed.has(control))
  })
  return { complete, passed: complete && exercised }
}

/** An area's assurance is no newer than its oldest recorded observation.
 * Completion, another area or a later batch cannot renew those source facts. */
export function coverageObservationTimes(executions: readonly ModuleCoverageExecution[],
  pageScope?: RecordedPageEvidenceScope): Map<SiteCardArea, string> {
  const completed = executions.filter(execution => !execution.status || execution.status === 'COMPLETED')
  return observationTimes(recordedModules(completed, pageScope),
    searchEvidence(completed, pageScope?.search ? pageScope : undefined), pageScope)
}

function observationTimes(modules: RecordedModule[], search: ReturnType<typeof searchEvidence>, pageScope?: RecordedPageEvidenceScope) {
  const times = new Map<SiteCardArea, string>()
  const record = (area: SiteCardArea, collectedAt: string) => {
    if (!Number.isFinite(Date.parse(collectedAt))) return
    const prior = times.get(area)
    if (!prior || Date.parse(collectedAt) < Date.parse(prior)) times.set(area, collectedAt)
  }
  const expectedPages = pageScope && new Set(pageScope.pages)
  // Search's existing local responsibility boundary owns public assurance.
  // Provider reporting windows remain separate enrichment.
  for (const receipt of search?.receipts ?? []) record('search', receipt.collectedAt)
  for (const { execution, module, receipt } of modules) {
    if (execution.status && execution.status !== 'COMPLETED' || module.startsWith('search') ||
      receipt.legacy || !receipt.execution || !receipt.applicable || receipt.failed || !matchesPageObservation(execution, receipt)) continue
    const definitions = checkAssertionsForVersion(receipt.module, receipt.execution.checkVersion)
    const areas = receipt.assertions.length ? receipt.assertions.flatMap(assertion => definitions[assertion.key]?.area ?? [])
      : moduleAreas(receipt.module, receipt.execution.checkVersion)
    const inScope = matchesPageObservation(execution, receipt, pageScope?.auditId, expectedPages)
    for (const area of new Set(areas)) {
      if (!inScope && pageScope && (area === 'search' && pageScope.search || area === 'security' && pageScope.securityTransport ||
        area === 'accessibility' && pageScope.accessibility || area === 'tracking' && pageScope.tracking ||
        area === 'conversion' && pageScope.conversion || area === 'performance' && pageScope.performance)) continue
      record(area, receipt.execution.collectedAt)
    }
  }
  return times
}

function failedModuleArea(module: string): SiteCardArea | undefined {
  if (isSearchProviderModule(module)) return undefined
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

const EARLY_COVERAGE_AREAS: SiteCardArea[] = ['security', 'tracking', 'accessibility']

/** Discovery can add linked-page obligations. Once it settles, an unfinished
 * task holds back only the areas that rely on that task's observations. */
export function pendingCoverageAreas(executions: readonly CoverageExecution[], discoversLinkedPages: boolean): Set<SiteCardArea> {
  const settled = (execution: CoverageExecution) => ['COMPLETED', 'NOT_APPLICABLE'].includes(execution.status)
  const discoveries = executions.filter(execution => execution.workKind === 'discovery')
  const pending = new Set<SiteCardArea>()
  if (!discoveries.length) return new Set([...EARLY_COVERAGE_AREAS, 'search'])
  if (discoveries.some(execution => !settled(execution))) {
    if (discoversLinkedPages) return new Set([...EARLY_COVERAGE_AREAS, 'search'])
    pending.add('search')
  }
  for (const task of executions) {
    if (!task.workKind || settled(task)) continue
    if (task.workKind === 'check') {
      const checkModule = /^task:p\d+:([^:]+)$/.exec(task.targetKey)?.[1]
      if (checkModule) for (const area of moduleAreas(checkModule)) pending.add(area)
    }
    if (task.workKind === 'search' || task.workKind === 'cross-page') pending.add('search')
    if (task.workKind === 'keyboard') pending.add('accessibility')
    if (task.workKind === 'flow' && /^task:p\d+:(flow|pricing-navigation)$/.test(task.targetKey)) pending.add('tracking')
  }
  return pending
}

function keyboardEvidence(executions: CoverageExecution[], modules: RecordedModule[], scope?: PageObservationScope): PageCheckVerdict {
  const taskPages = executions.filter(execution => execution.workKind === 'keyboard').map(task => task.pageUrl)
  if (!scope && !taskPages.length) return { complete: true, passed: true }
  if (!scope && taskPages.some(page => !page)) return { complete: false, passed: false }
  return pageCheckEvidence(modules, 'keyboard', receipt => {
    const known = receipt.assertions.filter(assertion => assertion.disposition !== 'observed')
    const complete = receipt.complete === true && !receipt.failed && (!scope || receipt.execution?.source === 'keyboard') &&
      (!receipt.applicable || ['focus-styles', 'keyboard-exit', 'tab-sequence'].every(key => known.some(assertion => assertion.key === key)))
    return { complete, passed: complete && (!receipt.applicable || known.every(assertion => assertion.passed)) }
  }, scope, scope?.pages ?? taskPages.filter((page): page is string => Boolean(page)))
}

/** Historical axe-only observations retain their recorded scope. */
export function keyboardScopeComplete(executions: CoverageExecution[], scope?: PageObservationScope) {
  return keyboardEvidence(executions, recordedModules(executions), scope).complete
}

function accessibilityEvidence(executions: CoverageExecution[], modules: RecordedModule[], pageScope?: RecordedPageEvidenceScope): PageCheckVerdict {
  const scope = pageScope?.accessibility
  if (!scope) return { complete: true,
    passed: passedAssertion(modules, 'accessibility', 'automated-accessibility') && keyboardEvidence(executions, modules).passed }
  const automated = scope.automated ? pageCheckEvidence(modules, 'accessibility', receipt => {
    const assertion = receipt.assertions.find(item => item.key === 'automated-accessibility')
    const complete = receipt.applicable && !receipt.failed && Boolean(assertion && assertion.complete !== false &&
      assertion.disposition !== 'observed' && (receipt.execution?.source === 'browser-accessibility' || receipt.execution?.source === 'axe'))
    return { complete, passed: complete && assertion?.passed === true }
  }, pageScope) : { complete: true, passed: true }
  const keyboard = scope.keyboard ? keyboardEvidence(executions, modules, pageScope) : { complete: true, passed: true }
  return { complete: automated.complete && keyboard.complete, passed: automated.passed && keyboard.passed }
}

/** A browser attempt or library transfer is useful even when delivery remains
 * unknown. Only the recorded browser receipt can supply this observation. */
function trackingRuntimeEvidence(modules: RecordedModule[], scope?: PageObservationScope) {
  let captured = false, library = false, requests = false
  const expectedPages = scope && new Set(scope.pages)
  for (const { execution, module, receipt } of modules) {
    if (module !== 'measurement' || execution.status !== 'COMPLETED' || receipt.legacy || !receipt.applicable || receipt.failed ||
      receipt.execution?.source !== 'browser-network' || !matchesPageObservation(execution, receipt, scope?.auditId, expectedPages)) continue
    captured = true
    for (const assertion of receipt.assertions) {
      if (assertion.complete !== true || !assertion.passed) continue
      if (assertion.key === 'tracking-initiation' && assertion.disposition === 'observed') requests = true
      if (assertion.key === 'tracking-library' && assertion.disposition !== 'observed') library = true
    }
  }
  return { captured, observed: requests ? 'requests' : library ? 'library' : null }
}

function areaEvidence(
  evidenceCoverage: unknown,
  verifierExecutions: CoverageExecution[],
  modules: RecordedModule[],
  pageScope?: RecordedPageEvidenceScope,
) {
  const evidenced = new Set<SiteCardArea>()
  const evidence = parseEvidence(evidenceCoverage)

  const performance = performanceLabEvidence(modules, pageScope)
  if (performance?.passed ?? Boolean(evidence.desktopPageSpeed || evidence.mobilePageSpeed)) evidenced.add('performance')
  if (evidence.metadata) evidenced.add('search')
  const conversion = pageScope?.conversion ? conversionJourneyEvidence(modules, pageScope, pageScope.conversion) : undefined
  if (conversion?.passed ?? Boolean(evidence.flowScan || evidence.journeyWalk)) evidenced.add('conversion')
  if (evidence.desktopScreenshot && evidence.metadata) evidenced.add('uptime')
  const accessibility = accessibilityEvidence(verifierExecutions, modules, pageScope)
  if (accessibility.passed) evidenced.add('accessibility')
  const security = securityTransportEvidence(modules, pageScope?.securityTransport ? pageScope : undefined)
  if (security.passed) evidenced.add('security')
  if (!pageScope?.tracking && passedAssertion(modules, 'measurement', 'analytics-markup')) evidenced.add('tracking')
  return { evidenced, security, accessibility, conversion, performance }
}

/** Areas that received concrete public evidence for this analysis. */
export function evidencedAreasFromCoverage(
  evidenceCoverage: unknown,
  flags: Array<{ checkId: string | null; rubric: string; impactTag: string | null }>,
  verifierExecutions: CoverageExecution[] = [],
): Set<SiteCardArea> {
  const { evidenced } = areaEvidence(evidenceCoverage, verifierExecutions, recordedModules(verifierExecutions))
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
  failedModules?: unknown
  flags: Array<{
    checkId: string | null
    rubric: string
    severity: string
    impactTag: string | null
    status?: string | null
  }>
  verifierExecutions?: CoverageExecution[]
  pendingAreas?: ReadonlySet<SiteCardArea>
  pageScope?: RecordedPageEvidenceScope
  /**
   * When re-checking, pass last completed facts so cards keep prior health
   * while activity shows checking.
   */
  lastKnown?: CoverageFact[] | null
  retainLastKnownWhileChecking?: boolean
}): CoverageFact[] {
  const inFlight = isAuditInFlight(input.auditStatus)
  const executions = input.verifierExecutions ?? []
  const modules = recordedModules(executions, input.pageScope)
  const search = searchEvidence(executions, input.pageScope?.search ? input.pageScope : undefined)
  const checkedTimes = observationTimes(modules, search, input.pageScope)
  const openByArea = new Map<SiteCardArea, number>()
  const openFlags = input.flags.filter(flag => !isResolvedFlagStatus(flag.status?.toUpperCase()))
  const lastKnownByArea = new Map(
    (input.lastKnown ?? []).map((fact) => [fact.area, fact] as const)
  )

  for (const flag of openFlags) {
    const area = cardAreaForCheck(flag)
    openByArea.set(area, (openByArea.get(area) ?? 0) + 1)
  }

  const { evidenced, security, accessibility, conversion, performance } = areaEvidence(input.evidenceCoverage, executions, modules, input.pageScope)
  const evidence = { ...parseEvidence(input.evidenceCoverage), ...(performance ? {
    desktopPageSpeed: performance.desktop?.passed === true, mobilePageSpeed: performance.mobile?.passed === true,
  } : {}) }
  const journeyRan = conversion?.passed ?? Boolean(evidence.flowScan || evidence.journeyWalk)
  const pageSpeedRan = performance?.passed ?? Boolean(evidence.desktopPageSpeed || evidence.mobilePageSpeed)
  const incompleteAreas = new Set<SiteCardArea>()
  const gapsByModule = new Map<string, Set<SiteCardArea>>()
  const tracking = trackingRuntimeEvidence(modules, input.pageScope?.tracking ? input.pageScope : undefined)
  const retriedLinkGaps = resolvedPublicLinkCoverageGaps(modules.map(({ execution }) => execution), input.pageScope?.auditId)
  for (const { execution, module: moduleKey, receipt } of modules) {
    if (execution.status === 'NOT_APPLICABLE' || retriedLinkGaps.has(execution)) continue
    const missing = receipt.assertions.filter(assertion => assertion.complete === false)
    const failed = execution.status === 'FAILED' ||
      input.auditStatus === 'COMPLETED' && execution.status !== 'COMPLETED' ||
      receipt.unavailable && Object.hasOwn(CHECK_ASSERTIONS, moduleKey) || !receipt.legacy && 'failed' in receipt && receipt.failed === true
    const incomplete = 'complete' in receipt && receipt.complete === false
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
  if (input.pageScope?.search && !search && (!inFlight || input.pendingAreas && !input.pendingAreas.has('search')))
    incompleteAreas.add('search')
  if (input.pageScope?.securityTransport && !security.complete &&
    (!inFlight || input.pendingAreas && !input.pendingAreas.has('security'))) incompleteAreas.add('security')
  if (input.pageScope?.accessibility && !accessibility.complete &&
    (!inFlight || input.pendingAreas && !input.pendingAreas.has('accessibility'))) incompleteAreas.add('accessibility')
  if (input.pageScope?.tracking && !tracking.captured &&
    (!inFlight || input.pendingAreas && !input.pendingAreas.has('tracking'))) incompleteAreas.add('tracking')
  if (conversion && !conversion.complete && !inFlight) incompleteAreas.add('conversion')
  if (performance && !performance.complete && !inFlight) incompleteAreas.add('performance')

  // Every board area answers from check evidence except the Pages card, which
  // answers from the pages a Site discovered.
  const areas: SiteCardArea[] = SITE_CARD_AREAS.filter(area => area !== PAGES_CARD_AREA)

  return areas.map((area) => {
    const checkedAt = checkedTimes.get(area) ?? input.completedAt?.toISOString() ?? null
    const openFlagCount = openByArea.get(area) ?? 0
    const prior = lastKnownByArea.get(area)
    const pending = input.pendingAreas?.has(area)
    const knownGap = incompleteAreas.has(area) || (area === 'search' && search && !search.complete)
    const incompleteReason = (!inFlight || area === 'search' && input.pendingAreas && !pending) && knownGap
      ? SITE_BOARD_COPY.cardCheckIncomplete : null

    // A committed failure is immediately useful even while unrelated work is
    // still running. A previous healthy card cannot conceal this execution's Flag.
    if (openFlagCount > 0) {
      const important = openFlags.some(flag => cardAreaForCheck(flag) === area && ['CRITICAL', 'IMPORTANT'].includes(flag.severity))
      return { area, state: (important ? 'problem' : 'attention') as CardHealthState,
        label: openFlagCount === 1 ? '1 thing needs attention' : `${openFlagCount} things need attention`,
        detail: null, checkedAt, openFlagCount, evidenced: true, incompleteReason }
    }

    if (area === 'search' && search) {
      const searchCheckedAt = checkedTimes.get(area) ?? search.checkedAt
      const stale = siteCoverageIsStale(searchCheckedAt, input.now, input.coverageMaxAgeMs)
      const complete = !knownGap && !search.excluded && !stale && !pending
      return { area, state: complete ? 'healthy' : 'unknown',
        label: stale ? SITE_BOARD_COPY.checkOutOfDate : search.excluded ? SEARCH_COPY.summary.excluded
          : pending ? SITE_BOARD_COPY.checking : knownGap ? SEARCH_COPY.summary.partial : SEARCH_COPY.summary.recorded,
        detail: stale ? SITE_BOARD_COPY.checkOutOfDateDetail : search.excluded ? SEARCH_COPY.summary.restriction : knownGap ? SEARCH_COPY.partial : SEARCH_COPY.summary.scope(search.receipts.length),
        checkedAt: searchCheckedAt, openFlagCount: 0, evidenced: search.evidenced, stale, incompleteReason }
    }

    if (area === 'tracking' && tracking.captured) {
      const copy = SITE_ACTION_COPY.execution.tracking
      const stale = siteCoverageIsStale(checkedAt, input.now, input.coverageMaxAgeMs)
      return { area, state: 'unknown', label: stale ? SITE_BOARD_COPY.checkOutOfDate
        : tracking.observed === 'requests' ? copy.requestsObserved : tracking.observed === 'library' ? copy.libraryObserved : copy.runtimeUnknown,
        detail: stale ? SITE_BOARD_COPY.checkOutOfDateDetail : tracking.observed ? copy.deliveryLimit : null,
        checkedAt, openFlagCount: 0, evidenced: false, stale, incompleteReason }
    }

    if (incompleteReason || incompleteAreas.has(area)) {
      return { area, state: 'unknown', label: incompleteReason ?? 'Couldn’t verify',
        detail: null, checkedAt, openFlagCount: 0, evidenced: evidenced.has(area), incompleteReason }
    }

    if (inFlight && evidenced.has(area) && EARLY_COVERAGE_AREAS.includes(area) && !pending) {
      const copy = healthyEvidenceCopy(area, evidence)
      if (siteCoverageIsStale(checkedAt, input.now, input.coverageMaxAgeMs)) return { area, state: 'unknown',
        label: SITE_BOARD_COPY.checkOutOfDate, detail: SITE_BOARD_COPY.checkOutOfDateDetail,
        checkedAt, openFlagCount: 0, evidenced: true, stale: true }
      return { area, state: 'healthy' as const, label: copy.answer, detail: copy.detail,
        checkedAt, openFlagCount: 0, evidenced: true }
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

    if (siteCoverageIsStale(checkedAt, input.now, input.coverageMaxAgeMs)) {
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
