import { executionTransaction } from '@/lib/audit/execution-ownership'
import { prisma } from '@/lib/db'
import { resolveMonitoringFlagStatus } from '@/lib/audit/flag-status-resolution'
import {
  observationIdentity,
  observationMatchKeys,
  parseAffectedPaths,
  baseCheckId,
  outcomeFlagOwner,
} from '@/lib/audit/flag-identity'
import { severityRank } from '@/lib/utils'
import type { Flag, FlagStatus, ReportCompleteness, Severity } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { FlagDiffSummaryItem } from './flag-types'
import { createRecordedRecoveryReader, type RecoveryExecution, type RecoveryFlag } from './recovery-evidence'
import { readExecutionSpec, type ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { loadRecoveryExecutions } from './recovery-executions'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { loadSupersededOutcomeFlagIds, outcomeMonitoringDiff } from '@/lib/sites/application/outcome-monitoring'
import { analysisEnvironmentWhere, siteAnalysisAuditWhere } from '@/lib/sites/application/analysis-scope'
import { FLAG_COMPARISON_TARGET, FlagComparisonUnavailable, assertFlagComparisonSite, flagComparisonAuditScopeSelect, flagComparisonSchema, readComparisonRecoveryIds, readFlagComparisonFacts, type FlagComparisonResult, type FlagDiffSummary } from './flag-comparison'
import { preparePublishedSiteAssessment } from '@/lib/sites/application/recorded-assessment'
import { hasUnreadableStoredSupportingObservations, readSupportingObservations } from './flag-observations'
import { loadAcceptedFlagRecoveries } from '@/lib/sites/application/accepted-flag-recoveries'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs } from '@/lib/sites/application/incident-proofs'
import { structuredFailureKeys } from './search/attention-scope'
import { searchAttentionSchema } from './search/contracts'
import { searchResourceKey } from './search/resource-identity'
import { DESTINATION_VERIFICATION_RULE, PUBLIC_LINK_VERIFICATION_RULE } from './checks/destination-evidence'
import { SECTION_LINK_VERIFICATION_RULE } from './checks/section-links'
import { SECURITY_HEADER_VERIFICATION_RULE, securityHeaderFailureScope } from './checks/security-headers'
import { FORM_VERIFICATION_RULE } from './flow/form-evidence'
import { currentTrackingRequestTarget, isComparableTrackingContext, TRACKING_VERIFICATION_RULE } from './tracking/identity'
import { ENGAGEMENT_CONTEXT, ENGAGEMENT_VERIFICATION_RULE } from './network-engagement-evidence'
import { ACCESSIBILITY_VERIFICATION_RULE, isComparableAccessibilityContext } from './checks/accessibility-rules'
import { PAGESPEED_LAB_RULE, readPerformanceContext, recordedPerformanceLabScope } from './performance-measurement'
import { TAP_TARGET_CONTEXT, TAP_TARGET_VERIFICATION_RULE } from './pagespeed-tap-targets'
import { PAGE_CHECK_DEFINITIONS } from './checks/definitions'

export type { FlagDiffSummaryItem } from './flag-types'

function summaryItem(flag: Flag): FlagDiffSummaryItem {
  return { id: flag.id, checkId: flag.checkId, problem: flag.problem, rubric: flag.rubric, severity: flag.severity,
    status: flag.status, confidence: flag.confidence, impactTag: flag.impactTag, attentionPolicy: flag.attentionPolicy, pageUrl: flag.pageUrl }
}

type FlagRow = {
  id: string
  checkId: string | null
  problem: string
  rubric: string
  severity: Severity
  status: FlagStatus
  pageUrl?: string | null
  affectedPaths?: unknown
  fingerprint?: string | null
  attentionPolicy?: unknown
  evidenceTargets?: unknown
  verificationRule?: string | null
  supportingObservations?: unknown
  resolvedInId?: string | null
}

type ChildPageCoverage = {
  url: string
  status: string
  completeness: ReportCompleteness
}

type ComparisonFlag = Pick<FlagRow, 'checkId' | 'problem' | 'rubric' | 'fingerprint' | 'attentionPolicy' | 'pageUrl' | 'affectedPaths' |
  'verificationRule' | 'evidenceTargets' | 'supportingObservations'>

function propertyKeys(flag: ComparisonFlag) {
  return baseCheckId(flag.checkId) === 'search-structured-feature' ? structuredFailureKeys(flag.attentionPolicy) : undefined
}

function crawlFailureKeys(flag: ComparisonFlag) {
  const policy = searchAttentionSchema.safeParse(flag.attentionPolicy)
  if (!policy.success && flag.attentionPolicy != null) return undefined
  const { pageScopes, resourceKeys } = policy.success ? policy.data : {}
  const pages = flagPageUrls(flag)
  const scopes = pageScopes ?? (resourceKeys && pages.length !== 1 ? [] : pages.map(pageUrl => ({ pageUrl, resourceKeys })))
  if (!scopes.length) return undefined
  // Before redirect evidence, the crawl observation concerned the requested
  // page only. A known legacy page scope can still match that initial URL.
  return new Set(scopes.flatMap(scope => (scope.resourceKeys ?? [searchResourceKey(scope.pageUrl)])
    .map(key => JSON.stringify([normalizeVerifierUrl(scope.pageUrl), key]))))
}

/** Verification retains the capture method separately. A section's identity
 * is its requested page and fragment even when the capture profile changes. */
function comparisonScope(flag: ComparisonFlag, scoped: boolean) {
  const checkId = baseCheckId(flag.checkId)
  if (scoped && checkId === 'search-crawl-access') return { conditions: crawlFailureKeys(flag) }
  if (!scoped || ![DESTINATION_VERIFICATION_RULE, PUBLIC_LINK_VERIFICATION_RULE, SECTION_LINK_VERIFICATION_RULE,
    SECURITY_HEADER_VERIFICATION_RULE, FORM_VERIFICATION_RULE, TRACKING_VERIFICATION_RULE, ENGAGEMENT_VERIFICATION_RULE,
    ACCESSIBILITY_VERIFICATION_RULE, PAGESPEED_LAB_RULE, TAP_TARGET_VERIFICATION_RULE]
    .includes(flag.verificationRule ?? '')) return { conditions: propertyKeys(flag) }
  if (flag.verificationRule === PAGESPEED_LAB_RULE) {
    const lab = recordedPerformanceLabScope(flag)
    return lab ? { conditions: lab.conditions, relatedChecks: new Set(PAGE_CHECK_DEFINITIONS[lab.module].assertions[lab.metric].verifies),
      family: `${lab.module}:${lab.metric}` } : {}
  }
  if (flag.verificationRule === DESTINATION_VERIFICATION_RULE && checkId === 'broken-internal-links') return {}
  const observations = readSupportingObservations(flag.supportingObservations)
  if (flag.supportingObservations != null && !observations) return {}
  const conditions = new Set<string>()
  const relatedChecks = new Set<string>()
  for (const item of observations?.items ?? [flag]) {
    if (item.verificationRule !== flag.verificationRule || !Array.isArray(item.evidenceTargets) || !item.evidenceTargets.length) return {}
    for (const target of item.evidenceTargets) {
      const context = target?.context
      if (typeof context !== 'string') return {}
      if (item.verificationRule === SECTION_LINK_VERIFICATION_RULE) {
        const match = /^section:(?:v2:)?[a-f0-9]{64}:([a-f0-9]{64})$/.exec(context)
        if (!match || !item.pageUrl || !observations && flagPageUrls(flag).length !== 1) return {}
        conditions.add(JSON.stringify([normalizeDiffUrl(item.pageUrl), match[1]]))
      } else if (item.verificationRule === SECURITY_HEADER_VERIFICATION_RULE) {
        const header = checkId && securityHeaderFailureScope(context, checkId)
        if (!header) return {}
        conditions.add(header.context)
        for (const id of header.checkIds) relatedChecks.add(id)
      } else if (item.verificationRule === TRACKING_VERIFICATION_RULE) {
        if (!isComparableTrackingContext(context)) return {}
        conditions.add(currentTrackingRequestTarget(context))
      } else if (item.verificationRule === ACCESSIBILITY_VERIFICATION_RULE) {
        if (!isComparableAccessibilityContext(context)) return {}
        // The verifier proves a rule responsibility for the whole capture.
        // A selector illustrates its failure and does not identify its scope.
        conditions.add(context)
      } else if (item.verificationRule === TAP_TARGET_VERIFICATION_RULE) {
        if (!TAP_TARGET_CONTEXT.test(readPerformanceContext(context)?.context ?? '')) return {}
        conditions.add(context)
      } else if ((item.verificationRule === ENGAGEMENT_VERIFICATION_RULE ? ENGAGEMENT_CONTEXT
        : item.verificationRule === FORM_VERIFICATION_RULE ? /^form:[a-f0-9]{64}$/ : /^destination:[a-f0-9]{64}$/).test(context)) {
        conditions.add(context)
      } else return {}
    }
  }
  return { conditions, relatedChecks }
}

function flagMatchKey(flag: ComparisonFlag, scoped: boolean): string {
  const { conditions, family } = comparisonScope(flag, scoped)
  const identity = family ?? diffMatchKey(flag)
  return conditions ? JSON.stringify([identity, [...conditions].sort()]) : identity
}

const headerRollups = new Set(['security-headers-missing', 'security-headers-hardening'])

function comparedSeverity(original: Flag, current: Flag, scoped: boolean): Severity {
  const before = baseCheckId(original.checkId) ?? '', after = baseCheckId(current.checkId) ?? ''
  // A header can move between an advisory bundle and its individual severity
  // without its measured condition changing.
  return scoped && before !== after && (headerRollups.has(before) || headerRollups.has(after))
    ? original.severity : current.severity
}

function indexByMatchKeys<T extends ComparisonFlag>(flags: readonly T[], scopePages = false) {
  const map = new Map<string, Array<{ flag: T; conditions?: Set<string>; pages: Set<string> }>>()
  const scopes = new WeakMap<ComparisonFlag, ReturnType<typeof comparisonScope>>()
  const scopeFor = (flag: ComparisonFlag) => {
    const stored = scopes.get(flag)
    if (stored) return stored
    const scope = comparisonScope(flag, scopePages)
    scopes.set(flag, scope)
    return scope
  }
  const matchKeys = (flag: ComparisonFlag, scope: ReturnType<typeof comparisonScope>) => [...observationMatchKeys(flag),
    ...(scope.relatedChecks?.size ? [...scope.conditions!].map(context => `watch:${context}`) : [])]
  const add = (flag: T) => {
    const scope = scopeFor(flag)
    const entry = { flag, conditions: scope.conditions, pages: new Set(scopePages ? flagPageUrls(flag) : []) }
    for (const key of matchKeys(flag, scope)) {
      const group = map.get(key)
      if (group) group.push(entry)
      else map.set(key, [entry])
    }
  }
  for (const flag of flags) add(flag)
  function* matches(flag: ComparisonFlag, condition?: string): Generator<T, undefined> {
    const scope = scopeFor(flag)
    const { conditions } = scope
    const pages = scopePages ? flagPageUrls(flag) : []
    const seen = new Set<T>()
    for (const key of matchKeys(flag, scope)) {
      for (const candidate of map.get(key) ?? []) {
        if (seen.has(candidate.flag)) continue
        seen.add(candidate.flag)
        // Searching for a missing historical condition requires recorded scope.
        if (condition !== undefined && !candidate.conditions?.has(condition)) continue
        if (conditions && candidate.conditions && ![...conditions].some(key => candidate.conditions!.has(key))) continue
        if (scopePages && (pages.length ? !pages.some(page => candidate.pages.has(page)) : candidate.pages.size > 0)) continue
        yield candidate.flag
      }
    }
    return undefined
  }
  return { add, matches, find: (flag: ComparisonFlag, condition?: string) => matches(flag, condition).next().value }
}

/**
 * Match key for diffing flags across reports. Per-page `::page:N` variants of
 * the same deterministic check collapse onto one site-level key so page-order
 * shifts do not make every variant look newly fixed/regressed and leak
 * duplicate findings into the re-check diff. Journey aliases and stored AI
 * identities use the same observation identity as persist and Improvements.
 */
export function diffMatchKey(input: {
  checkId: string | null
  problem: string
  rubric: string
  fingerprint?: string | null
}): string {
  return observationIdentity(input)
}

/** Compare the same resource, retaining meaningful path and query delimiters. */
export const normalizeDiffUrl = normalizeVerifierUrl

function flagPageUrls(flag: Pick<FlagRow, 'pageUrl' | 'affectedPaths'>): string[] {
  const fromPaths = parseAffectedPaths(flag.affectedPaths)
  const urls = [...fromPaths]
  if (flag.pageUrl) urls.push(flag.pageUrl)
  return [...new Set(urls.map(normalizeDiffUrl).filter(Boolean))]
}

function pageIsReobservationComparable(page: ChildPageCoverage | undefined): boolean {
  if (!page) return false
  // FAILED / not-started pages were not fairly re-observed.
  if (
    page.status === 'FAILED' ||
    page.status === 'QUEUED' ||
    page.status === 'CAPTURING' ||
    page.status === 'JUDGING'
  ) {
    return false
  }
  // COMPLETED = captured (post capture/PSI split). PARTIAL status historically
  // meant the page ran but optional evidence (e.g. PageSpeed) was incomplete -
  // still a fair re-observation for Flag absence.
  return page.status === 'COMPLETED' || page.status === 'PARTIAL'
}

/**
 * Credit Fixed when the Flag is absent and every page that owned it was
 * re-observed on the child. PageSpeed gaps may leave completeness PARTIAL and
 * the audit PARTIAL - that does not block Fixed. Product-scoped Flags (no page)
 * still need audit-level FULL. Never invent clears for pages that were not run.
 */
export function isPageComparableAbsence(input: {
  auditStatus: string | undefined
  reportCompleteness: ReportCompleteness | null | undefined
  childPages: ChildPageCoverage[]
  parentFlag: RecoveryFlag
  auditId?: string
  executionSpec?: unknown
  verifierExecutions?: RecoveryExecution[]
}): boolean {
  return pageAbsenceCheck(input)(input.parentFlag)
}

/** One comparison batch shares its recorded receipts and legacy page index. */
function pageAbsenceCheck(input: Omit<Parameters<typeof isPageComparableAbsence>[0], 'parentFlag'>): (flag: RecoveryFlag) => boolean {
  if (input.auditStatus !== 'COMPLETED') return () => false
  const spec = readExecutionSpec(input.executionSpec)
  if (input.executionSpec != null && !spec) return () => false
  if (spec?.engine === 'progressive-v1') {
    const reader = input.auditId && createRecordedRecoveryReader({
      auditId: input.auditId, executionSpec: input.executionSpec, executions: input.verifierExecutions ?? [],
    })
    return flag => Boolean(reader && reader.hasRecovery(flag))
  }
  const byUrl = new Map(
    input.childPages.map((page) => [normalizeDiffUrl(page.url), page])
  )
  return flag => {
    const ownedUrls = flagPageUrls(flag)
    return ownedUrls.length === 0 ? input.reportCompleteness === 'FULL'
      : ownedUrls.every(url => pageIsReobservationComparable(byUrl.get(url)))
  }
}

async function loadAuditCoverage(auditId: string | null, database: Prisma.TransactionClient = prisma): Promise<{
  status: string | undefined
  reportCompleteness: ReportCompleteness | null | undefined
  pages: ChildPageCoverage[]
  executionSpec?: unknown
  verifierExecutions?: RecoveryExecution[]
  projectId?: string | null
  createdAt?: Date
  parentId?: string | null
  parentProjectId?: string | null
  comparison?: FlagComparisonResult
}> {
  if (!auditId) return { status: undefined, reportCompleteness: null, pages: [] }
  const audit = await database.audit.findUnique({
    where: { id: auditId },
    select: {
      status: true,
      reportCompleteness: true,
      pages: { select: { url: true, status: true, completeness: true } },
      executionSpec: true, ...flagComparisonAuditScopeSelect, createdAt: true,
      verifierExecutions: { where: { targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product' }, select: { status: true, detail: true, evidenceReference: true } },
    },
  })
  if (audit?.verifierExecutions?.some(row => row.status !== 'COMPLETED')) throw new FlagComparisonUnavailable('The Flag comparison projection has not completed.')
  const receipt = audit?.verifierExecutions?.[0]
  const facts = audit && receipt ? readFlagComparisonFacts(receipt.detail, { id: auditId, ...audit }) : undefined
  return {
    status: audit?.status,
    reportCompleteness: audit?.reportCompleteness,
    pages: audit?.pages ?? [],
    executionSpec: audit?.executionSpec, projectId: audit?.projectId ?? null,
    createdAt: audit?.createdAt, parentId: audit?.parentId, parentProjectId: audit?.parent?.projectId,
    ...(facts ? { comparison: { summary: facts.summary, verifiedRecoveryIds: readComparisonRecoveryIds(receipt?.evidenceReference, facts) } } : {}),
  }
}

/** A gap carries the latest durable observation, rather than starting a new
 * incident. Completed recoveries return only when the responsibility fails again
 * or when this exact run closed it, keeping replay and healthy states quiet. */
async function diagnosticBaseline(input: {
  auditId: string; parentId: string | null; child: Awaited<ReturnType<typeof loadAuditCoverage>>;
  parentFlags: Flag[]; currentFlags: Flag[];
}, database: Prisma.TransactionClient = prisma) {
  const historyMatches = new Map<string, Set<string>>()
  const matchesBaseline = (original: Flag, current: Flag) => historyMatches.get(original.id)?.has(current.id) ?? true
  const spec = readExecutionSpec(input.child.executionSpec)
  if (!spec || !['SITE', 'CATEGORY'].includes(spec.scope) || !input.child.projectId || !input.child.createdAt || input.child.parentId !== input.parentId)
    return { baseline: input.parentFlags, matchesBaseline }
  // An incident belongs to its Site, including discoveries from a targeted or
  // historical analysis. Broad-run eligibility governs report baselines, not
  // whether a previously verified incident can recur.
  const historyAudit = {
    projectId: input.child.projectId, id: { not: input.auditId }, status: 'COMPLETED',
    createdAt: { lt: input.child.createdAt }, AND: [siteAnalysisAuditWhere, analysisEnvironmentWhere(spec.environment)],
  } satisfies Prisma.AuditWhereInput
  const admitted = (flag: Flag) => categoryAdmitsFlag(spec, flag)
  const history = await database.improvement.findMany({
    where: { projectId: input.child.projectId, outcomeId: null },
    select: { occurrences: {
      where: { audit: historyAudit },
      orderBy: [{ audit: { createdAt: 'desc' } }, { id: 'desc' }], take: 1,
      select: { flag: true },
    } },
  })
  const parentFlags = input.parentFlags.filter(admitted)
  const scopePages = spec.engine === 'progressive-v1'
  const improvement = { projectId: input.child.projectId, outcomeId: null }
  const unboundHistory = (checks: string[]): Prisma.FlagWhereInput[] => {
    if (!scopePages || !checks.length) return []
    const rollups = checks.filter(id => headerRollups.has(id))
    // A measured finding can predate its workflow projection. Retain admitted
    // deterministic failures and scoped header rollups from the Flag itself.
    return [{ source: 'DETERMINISTIC', severity: { in: ['CRITICAL', 'IMPORTANT'] }, improvementOccurrence: null,
      OR: [{ checkId: { in: checks } }, { fingerprint: { in: checks.map(id => `check:${id}`) } }] },
    ...(rollups.length ? [{ checkId: { in: rollups }, verificationRule: SECURITY_HEADER_VERIFICATION_RULE }] : [])]
  }
  const bound = { improvementOccurrence: { improvement } }
  const unbound = unboundHistory(Object.keys(spec.checks))
  const membership = unbound.length ? { AND: [{ OR: [bound, ...unbound] }] } : bound
  const previousIndex = indexByMatchKeys(parentFlags, scopePages), currentIndex = indexByMatchKeys(input.currentFlags, scopePages)
  const baseline = [...parentFlags]
  const sourceFlags = spec.category && spec.category.sourceAuditId !== input.parentId ? await database.flag.findMany({
    where: { auditId: spec.category.sourceAuditId, audit: { projectId: input.child.projectId, AND: [analysisEnvironmentWhere(spec.environment)] } },
  }) : []
  for (const previous of [...sourceFlags, ...history.flatMap(improvement => improvement.occurrences[0]?.flag ?? [])]) {
    if (!previous || !admitted(previous) || outcomeFlagOwner(previous.fingerprint) || previous.status === 'IGNORED') continue
    if (previousIndex.find(previous)) continue
    if (previous.status === 'FIXED' && previous.resolvedInId !== input.auditId && !currentIndex.find(previous)) continue
    baseline.push(previous)
    previousIndex.add(previous)
  }
  if (scopePages) {
    // The latest capture for an Improvement may be from a different page.
    // Find the nearest retained capture for each uncovered page or condition.
    const missing = input.currentFlags.flatMap<{ flag: Flag; condition?: string }>(flag => {
      const { conditions } = comparisonScope(flag, true)
      const pages = flagPageUrls(flag)
      return conditions ? [...conditions].map(condition => ({ flag, condition }))
        : !pages.length ? [{ flag }]
        : pages.map(pageUrl => ({ flag: { ...flag, pageUrl, affectedPaths: [] } }))
    }).filter(({ flag, condition }) => !previousIndex.find(flag, condition))
    const ids = new Set(baseline.map(flag => flag.id))
    function retain(previous: Flag) {
      if (!admitted(previous) || ids.has(previous.id) || outcomeFlagOwner(previous.fingerprint)) return
      baseline.push(previous)
      ids.add(previous.id)
      previousIndex.add(previous)
    }
    // The writer may already have closed an older Flag in this exact run.
    for (const previous of await database.flag.findMany({ where: { audit: historyAudit, ...membership, status: 'FIXED', resolvedInId: input.auditId } }))
      if (previous.status === 'FIXED' && previous.resolvedInId === input.auditId) retain(previous)
    const pages = [...new Set(missing.flatMap(({ flag }) => flagPageUrls(flag))
      .flatMap(pageUrl => URL.canParse(pageUrl) ? [pageUrl, new URL(pageUrl).href] : [pageUrl]))]
    const families = [...new Set([...new Set(missing.map(({ flag }) => flag))].flatMap(flag => [
      ...observationMatchKeys(flag), ...[...comparisonScope(flag, true).relatedChecks ?? []].map(id => `check:${id}`),
    ]))]
    const familyMembership = { improvementOccurrence: { improvement: { ...improvement, fingerprint: { in: families } } } }
    const matchingChecks = families.flatMap(key => key.startsWith('check:') && Object.hasOwn(spec.checks, key.slice(6)) ? [key.slice(6)] : [])
    const pageScope = [...(missing.some(({ flag }) => !flagPageUrls(flag).length) ? [{ pageUrl: null }] : []),
      { pageUrl: { in: pages } }, ...pages.map(page => ({ affectedPaths: { array_contains: [page] } }))]
    let afterId: string | undefined
    for (let pending = missing; pending.length > 0;) {
      const batch: Flag[] = await database.flag.findMany({ where: {
        audit: historyAudit, status: { in: ['OPEN', 'REGRESSED', 'FIXED'] },
        AND: [{ OR: [familyMembership, ...unboundHistory(matchingChecks)] }], OR: pageScope,
      }, ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      orderBy: [{ audit: { createdAt: 'desc' } }, { id: 'desc' }], take: 100 })
      const pendingIndex = indexByMatchKeys(pending.map(({ flag }) => flag), true)
      const pendingByFlag = Map.groupBy(pending, ({ flag }) => flag)
      for (const previous of batch) {
        if (ids.has(previous.id) || !admitted(previous) || outcomeFlagOwner(previous.fingerprint)) continue
        const { conditions } = comparisonScope(previous, true)
        const currentIds = new Set<string>()
        for (const current of pendingIndex.matches(previous)) {
          if (pendingByFlag.get(current)?.some(({ flag, condition }) =>
            (condition === undefined || conditions?.has(condition)) && !previousIndex.find(flag, condition))) currentIds.add(current.id)
        }
        if (!currentIds.size) continue
        retain(previous)
        historyMatches.set(previous.id, currentIds)
      }
      if (batch.length < 100) break
      pending = pending.filter(({ flag, condition }) => !previousIndex.find(flag, condition))
      afterId = batch.at(-1)!.id
    }
  }
  // Legacy comparisons retain their property-specific repaired scope lookup.
  const unmatchedProperties = new Set(scopePages ? [] : input.currentFlags.flatMap(flag => [...(propertyKeys(flag) ?? [])]))
  for (const previous of baseline) for (const property of propertyKeys(previous) ?? []) unmatchedProperties.delete(property)
  if (unmatchedProperties.size) {
    let afterId: string | undefined
    for (;;) {
      const batch: Flag[] = await database.flag.findMany({ where: { checkId: 'search-structured-feature', status: 'FIXED', resolvedInId: { not: null },
        improvementOccurrence: { improvement: { projectId: input.child.projectId, outcomeId: null } },
        audit: historyAudit }, ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
        orderBy: [{ audit: { createdAt: 'desc' } }, { id: 'desc' }], take: 100 })
      for (const previous of batch) {
        const scopes = propertyKeys(previous)
        if (!scopes || !admitted(previous) || ![...scopes].some(property => unmatchedProperties.has(property))) continue
        baseline.push(previous)
        for (const property of scopes) unmatchedProperties.delete(property)
      }
      if (!unmatchedProperties.size || batch.length < 100) break
      afterId = batch.at(-1)!.id
    }
  }
  const ids = new Set(baseline.map(flag => flag.id))
  // Every unresolved original condition needs its own recovery decision. A
  // newer occurrence cannot stand in for an older page, device or interaction,
  // including an older repair's source. Read those Flags once, independently
  // of how many attempts or sibling findings their source Audits contain.
  let afterId: string | undefined
  for (;;) {
    const batch: Flag[] = await database.flag.findMany({ where: { status: { in: ['OPEN', 'REGRESSED'] }, ...membership, audit: historyAudit,
      ...(afterId ? { id: { gt: afterId } } : {}) }, orderBy: { id: 'asc' }, take: 128 })
    for (const previous of batch) {
      if (!admitted(previous) || ids.has(previous.id) || outcomeFlagOwner(previous.fingerprint) || currentIndex.find(previous)) continue
      baseline.push(previous); ids.add(previous.id)
    }
    if (batch.length < 128) break
    afterId = batch.at(-1)!.id
  }
  return { baseline, matchesBaseline }
}

/** A comparison describes the captured failure at its own admission, while a
 * later accepted recovery still owns the live source's lifecycle projection. */
async function comparisonSources(parentRows: Flag[], currentRows: Flag[], child: Awaited<ReturnType<typeof loadAuditCoverage>>,
  auditId: string, database: Prisma.TransactionClient = prisma) {
  const retainedSourceIds = new Set([...parentRows, ...currentRows].filter(flag => flag.status === 'IGNORED').map(flag => flag.id))
  if (!child.projectId || !child.createdAt) return { parentFlags: parentRows, monitoringFlags: currentRows, retainedSourceIds }
  const flags = [...new Map([...parentRows, ...currentRows].map(flag => [flag.id, flag])).values()]
  const native = (await loadIncidentRecoveryProofs([{ projectId: child.projectId, flags }], database)).get(child.projectId)
  const legacy = await loadAcceptedFlagRecoveries(child.projectId, flags.filter(flag => flag.status === 'OPEN'), { database })
  for (const flag of flags) if (native?.hasFlag(flag) || legacy.has(flag.id)) retainedSourceIds.add(flag.id)
  const prior = new Map([...legacy].filter(([, proof]) => proof.completedAt && proof.completedAt <= child.createdAt!))
  const older = parentRows.filter(flag => legacy.has(flag.id) && !prior.has(flag.id))
  if (older.length) for (const [id, proof] of await loadAcceptedFlagRecoveries(child.projectId, older, { database, before: child.createdAt })) prior.set(id, proof)
  const parentFlags = parentRows.map(flag => {
    const proof = prior.get(flag.id)
    if (proof) return { ...flag, status: 'FIXED' as const, resolvedInId: proof.auditId }
    if (flag.status !== 'FIXED') return flag
    const recoveredAt = flag.resolvedInId && native?.hasFlag(flag) ? native.get(flag.resolvedInId) : undefined
    return recoveredAt && (flag.resolvedInId === auditId || recoveredAt <= child.createdAt!) ? flag : { ...flag, status: 'OPEN' as const }
  })
  // A Flag is a captured failure. A repair completed later cannot turn that
  // observation into a passing result in an unfinished historical report.
  const monitoringFlags = currentRows.map(flag => ['FIXED', 'REGRESSED'].includes(flag.status) ? { ...flag, status: 'OPEN' as const } : flag)
  return { parentFlags, monitoringFlags, retainedSourceIds }
}

/** A category receipt describes only the immutable page and responsibility
 * selection. Historical failures elsewhere remain open on the Site. */
function categoryAdmitsFlag(spec: ExecutionSpec | null, flag: FlagRow): boolean {
  if (!spec?.category) return true
  if (!Object.hasOwn(spec.checks, baseCheckId(flag.checkId) ?? '')) return false
  const pages = new Set(spec.category.pages.map(normalizeDiffUrl))
  const affected = flagPageUrls(flag)
  return affected.length === 0 || affected.some(page => pages.has(page))
}

export function reviewedPageUrls(input: {
  pages: ChildPageCoverage[]
  flags: Array<Pick<FlagRow, 'pageUrl' | 'affectedPaths'>>
}): Set<string> {
  const urls = new Set<string>()
  for (const page of input.pages) {
    if (pageIsReobservationComparable(page)) urls.add(normalizeDiffUrl(page.url))
  }
  for (const flag of input.flags) {
    for (const url of flagPageUrls(flag)) urls.add(url)
  }
  return urls
}

export function isFoundOnNewlyReviewedPage(input: {
  pageUrl: string | null
  parentReviewedUrls: Set<string>
}): boolean {
  if (!input.pageUrl) return false
  if (input.parentReviewedUrls.size === 0) return false
  return !input.parentReviewedUrls.has(normalizeDiffUrl(input.pageUrl))
}

export async function diffFlagsAgainstParent(
  monitoringAuditId: string,
  parentAuditId: string | null
): Promise<void> {
  await executionTransaction(async database => {
    const child = await loadAuditCoverage(monitoringAuditId, database)
    if (child.parentId !== parentAuditId) throw new Error('Flag projection requires the original parent.')
    assertFlagComparisonSite(child.projectId, child.parentProjectId)
    if (child.comparison) return
    const [parentRows, monitoringRows] = await Promise.all([
      parentAuditId ? database.flag.findMany({
        where: { auditId: parentAuditId },
      }) : Promise.resolve([]),
      database.flag.findMany({
        where: { auditId: monitoringAuditId },
      }),
    ])
    // Committed Outcome assessments own bound incidents. A broad report diff
    // cannot reopen or resolve those same Flags through a second state machine.
    const spec = readExecutionSpec(child.executionSpec)
    const currentFlags = monitoringRows.filter(flag => !outcomeFlagOwner(flag.fingerprint) && categoryAdmitsFlag(spec, flag))
    const { baseline, matchesBaseline } = await diagnosticBaseline({ auditId: monitoringAuditId, parentId: parentAuditId, child,
      parentFlags: parentRows.filter(flag => !outcomeFlagOwner(flag.fingerprint) && (!spec?.category || Object.hasOwn(spec.checks, baseCheckId(flag.checkId) ?? ''))), currentFlags }, database)
    const { parentFlags, monitoringFlags, retainedSourceIds } = await comparisonSources(baseline, currentFlags, child, monitoringAuditId, database)

    const scopePages = spec?.engine === 'progressive-v1'
    const monitoringByKey = indexByMatchKeys(monitoringFlags, scopePages)
    const matches = (original: Flag) => scopePages ? [...monitoringByKey.matches(original)].filter(current => matchesBaseline(original, current))
      : [monitoringByKey.find(original)].filter(flag => flag !== undefined)
    const recovery = spec?.engine === 'progressive-v1' ? (await loadRecoveryExecutions([{ auditId: monitoringAuditId,
      flags: parentFlags.filter(flag => !matches(flag).length) }], database)).get(monitoringAuditId) ?? [] : []
    const comparableAbsence = pageAbsenceCheck({ auditStatus: child.status,
      reportCompleteness: child.reportCompleteness, childPages: child.pages,
      auditId: monitoringAuditId, executionSpec: child.executionSpec, verifierExecutions: recovery })
    const updates: Array<{
      id: string
      data: { status: FlagStatus; resolvedInId?: string | null }
    }> = []
    const sources = new Map([...baseline, ...currentFlags].map(flag => [flag.id, flag]))
    const monitoringUpdates = new Map<string, typeof updates[number]>()

    for (const parentFlag of parentFlags) {
      const observed = matches(parentFlag)

      if (!observed.length) {
        if (parentFlag.status !== 'FIXED' && comparableAbsence(parentFlag)) {
          updates.push({
            id: parentFlag.id,
            data: { status: 'FIXED', resolvedInId: monitoringAuditId },
          })
        }
        continue
      }

      for (const monitoringFlag of observed) {
        const status = resolveMonitoringFlagStatus({
          parentStatus: parentFlag.status,
          parentSeverity: parentFlag.severity,
          monitoringSeverity: comparedSeverity(parentFlag, monitoringFlag, scopePages),
          stillFails: true,
        })
        // A recurrence or severity increase survives an earlier OPEN match.
        const pending = monitoringUpdates.get(monitoringFlag.id)
        if (!pending) {
          const update = {
            id: monitoringFlag.id,
            data: { status, ...(sources.get(monitoringFlag.id)?.status === 'FIXED' ? { resolvedInId: null } : {}) },
          }
          monitoringUpdates.set(monitoringFlag.id, update)
          updates.push(update)
        } else if (status === 'REGRESSED') pending.data.status = status
      }
      // The new observation owns its recurrence or severity increase. Its
      // still-failing ancestor keeps its captured lifecycle until recovery.
    }

    // Independent runs acquire shared source rows in the same order. Preserve
    // already-correct projections without unnecessary writes or row contention.
    for (const update of updates.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      if (retainedSourceIds.has(update.id)) continue
      const source = sources.get(update.id)
      // Older writers also projected later regressions onto their ancestors.
      // Reconstruct the historical comparison without revoking that attention.
      if (source?.status === 'REGRESSED' && update.data.status === 'OPEN') continue
      if (source?.status === update.data.status &&
        (update.data.resolvedInId === undefined || source.resolvedInId === update.data.resolvedInId)) continue
      await database.flag.update({ where: { id: update.id }, data: update.data })
    }
  }, { isolationLevel: 'RepeatableRead' })
}

export type FlagDiffSummaryBucket = 'fixed' | 'unchanged' | 'regressed'

export function classifyMatchedFlagDiff(input: {
  parentStatus: FlagStatus
  parentSeverity: Severity
  monitoringStatus: FlagStatus
  monitoringSeverity: Severity
}): FlagDiffSummaryBucket {
  if (input.monitoringStatus === 'FIXED') return 'fixed'

  const status = resolveMonitoringFlagStatus({
    parentStatus: input.parentStatus,
    parentSeverity: input.parentSeverity,
    monitoringSeverity: input.monitoringSeverity,
    stillFails: true,
  })

  if (status === 'REGRESSED' || input.monitoringStatus === 'REGRESSED') {
    return 'regressed'
  }
  return 'unchanged'
}

/**
 * Classifies a matched flag across two arbitrary reports (e.g. the ff_compare MCP
 * tool), where the two audits are not guaranteed to be a real parent/monitoring
 * pair. Unlike classifyMatchedFlagDiff, this never reads either flag's persisted
 * `status` field - that field is only meaningful relative to a flag's own real
 * parent audit (set by diffFlagsAgainstParent), so trusting it here would produce
 * wrong results whenever `after` isn't literally `before`'s monitoring child.
 */
export function classifyArbitraryReportFlagDiff(input: {
  beforeSeverity: Severity
  afterSeverity: Severity
}): 'unchanged' | 'regressed' {
  return severityRank(input.afterSeverity) < severityRank(input.beforeSeverity)
    ? 'regressed'
    : 'unchanged'
}

export async function getFlagDiffSummary(
  parentAuditId: string | null,
  monitoringAuditId: string,
  options?: { requirePublishedReport?: boolean },
): Promise<FlagDiffSummary> {
  const child = await loadAuditCoverage(monitoringAuditId)
  const { summary } = await getFlagComparisonResult(parentAuditId, monitoringAuditId, child, options)
  if (options?.requirePublishedReport || child.comparison?.summary !== summary || !child.projectId ||
    !readExecutionSpec(child.executionSpec)?.outcomes.length) return summary
  // A retained comparison may predate the supersession filter. Keep the saved
  // report intact and exclude its stale findings from pending Watch delivery.
  const ids = [...summary.regressed, ...summary.newIssues].flatMap(flag => flag.id ? [flag.id] : [])
  const superseded = await loadSupersededOutcomeFlagIds(ids, [child.projectId])
  if (!superseded.size) return summary
  const current = (flags: FlagDiffSummaryItem[]) => flags.filter(flag => !flag.id || !superseded.has(flag.id))
  return { ...summary, regressed: current(summary.regressed), newIssues: current(summary.newIssues) }
}

async function getFlagComparisonResult(parentAuditId: string | null, monitoringAuditId: string,
  child: Awaited<ReturnType<typeof loadAuditCoverage>>, options?: { requirePublishedReport?: boolean }): Promise<FlagComparisonResult> {
  if (options?.requirePublishedReport && (child.status !== 'COMPLETED' || child.parentId !== parentAuditId))
    throw new FlagComparisonUnavailable('The report comparison does not match a completed execution and its original parent.')
  if (child.parentId === parentAuditId) {
    assertFlagComparisonSite(child.projectId, child.parentProjectId)
    if (child.comparison) return child.comparison
  }
  if (options?.requirePublishedReport) {
    const spec = readExecutionSpec(child.executionSpec)
    if (spec?.engine === 'progressive-v1' && (spec.scope === 'SITE' || spec.scope === 'CATEGORY'))
      throw new FlagComparisonUnavailable('The Flag comparison projection has not completed.')
  }
  return calculateFlagDiffSummary(parentAuditId, monitoringAuditId, child)
}

/** An unavailable comparison does not prevent readers from using the report itself. */
export async function readReportComparison(parentAuditId: string, monitoringAuditId: string): Promise<FlagDiffSummary | null> {
  try {
    return await getFlagDiffSummary(parentAuditId, monitoringAuditId, { requirePublishedReport: true })
  } catch (error) {
    if (error instanceof FlagComparisonUnavailable) return null
    throw error
  }
}

/** Older snapshots predate explicit recovery custody. Read only the saved
 * fixed sources and require proof from this exact child before crediting them. */
export async function readReportComparisonWithRecovery(parentAuditId: string, monitoringAuditId: string): Promise<FlagComparisonResult | null> {
  try {
    const child = await loadAuditCoverage(monitoringAuditId)
    const result = await getFlagComparisonResult(parentAuditId, monitoringAuditId, child, { requirePublishedReport: true })
    if (result.verifiedRecoveryIds || readExecutionSpec(child.executionSpec)?.engine !== 'progressive-v1') return result
    const ids = result.summary.fixed.flatMap(flag => flag.id && !flag.supportingEvidenceUnreadable ? [flag.id] : [])
    if (!ids.length) return { summary: result.summary, verifiedRecoveryIds: [] }
    const projectId = child.projectId ?? null
    const flags = await prisma.flag.findMany({ where: { id: { in: ids }, status: 'FIXED', resolvedInId: monitoringAuditId,
      audit: projectId ? { projectId } : { id: parentAuditId, projectId: null } }, select: incidentRecoveryFlagSelect })
    if (projectId) {
      const proofs = (await loadIncidentRecoveryProofs([{ projectId, flags }])).get(projectId)
      return { summary: result.summary, verifiedRecoveryIds: flags.filter(flag => proofs?.hasFlag(flag)).map(flag => flag.id) }
    }
    const executions = await loadRecoveryExecutions([{ auditId: monitoringAuditId, flags }])
    const reader = createRecordedRecoveryReader({ auditId: monitoringAuditId, executionSpec: child.executionSpec,
      executions: executions.get(monitoringAuditId) ?? [] })
    return { summary: result.summary, verifiedRecoveryIds: flags.filter(reader.hasRecovery).map(flag => flag.id) }
  } catch (error) {
    if (error instanceof FlagComparisonUnavailable) return null
    throw error
  }
}

/** Finalization records this once after both diagnostic and bound projections.
 * Readers and notification retries never rebuild a completed comparison from
 * Flag statuses that a later monitoring run can legitimately change. */
export async function persistFlagDiffSummary(parentAuditId: string | null, monitoringAuditId: string): Promise<void> {
  const child = await loadAuditCoverage(monitoringAuditId)
  const spec = readExecutionSpec(child.executionSpec), scope = spec?.scope
  if (scope === 'DIAGNOSTIC' || scope === 'FIXTURE_SETUP') return
  if (child.status !== 'COMPLETED' || child.parentId !== parentAuditId) throw new Error('Flag comparison requires its completed execution and original parent.')
  assertFlagComparisonSite(child.projectId, child.parentProjectId)
  if (child.comparison) return
  const { summary, verifiedRecoveryIds } = await calculateFlagDiffSummary(parentAuditId, monitoringAuditId, child)
  const comparison = flagComparisonSchema.parse({ kind: 'flag-comparison', version: 1, auditId: monitoringAuditId,
    parentAuditId, summary })
  const detail = spec?.engine === 'progressive-v1' && (scope === 'SITE' || scope === 'CATEGORY')
    ? flagComparisonSchema.parse({ ...comparison, siteAssessment: await preparePublishedSiteAssessment(monitoringAuditId, comparison) })
    : comparison
  await executionTransaction(async tx => {
    const scope = await tx.audit.findUnique({ where: { id: monitoringAuditId }, select: flagComparisonAuditScopeSelect })
    if (!scope || scope.parentId !== parentAuditId || scope.projectId !== child.projectId)
      throw new Error('Flag comparison requires its original parent and Site scope.')
    assertFlagComparisonSite(scope.projectId, scope.parent?.projectId)
    const record = await tx.auditVerificationReceipt.upsert({ where: { auditId_targetKey_scopeKey: {
      auditId: monitoringAuditId, targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product',
    } }, update: {}, create: { auditId: monitoringAuditId, targetKey: FLAG_COMPARISON_TARGET,
      scopeKey: 'product', source: 'SYSTEM', status: 'COMPLETED',
      evidenceReference: { auditId: monitoringAuditId, parentAuditId, ...(verifiedRecoveryIds ? { verifiedRecoveryIds } : {}) },
      detail: JSON.parse(JSON.stringify(detail)),
    }, select: { status: true, detail: true } })
    if (record.status !== 'COMPLETED') throw new Error('The Flag comparison projection has not completed.')
    readFlagComparisonFacts(record.detail, { id: monitoringAuditId, ...scope })
  })
}

async function calculateFlagDiffSummary(parentAuditId: string | null, monitoringAuditId: string,
  child: Awaited<ReturnType<typeof loadAuditCoverage>>): Promise<FlagComparisonResult> {
  const spec = readExecutionSpec(child.executionSpec)
  const outcome = await outcomeMonitoringDiff(monitoringAuditId, { projectId: child.projectId ?? null, executionSpec: child.executionSpec })
  const outcomeRecoveryIds = outcome?.fixed.flatMap(flag => flag.id && !flag.supportingEvidenceUnreadable ? [flag.id] : []) ?? []
  if (outcome && spec?.scope === 'OUTCOMES') {
    if (child.parentId !== parentAuditId) assertFlagComparisonSite(child.projectId, (await loadAuditCoverage(parentAuditId)).projectId)
    return { summary: outcome, verifiedRecoveryIds: outcomeRecoveryIds }
  }
  const parent = await loadAuditCoverage(parentAuditId)
  assertFlagComparisonSite(child.projectId, parent.projectId)
  const [parentRows, monitoringRows] = await Promise.all([
    parentAuditId ? prisma.flag.findMany({ where: { auditId: parentAuditId } }) : Promise.resolve([]),
    prisma.flag.findMany({ where: { auditId: monitoringAuditId } }),
  ])
  const assessedFlagIds = new Set(outcome ? Object.values(outcome).flat().map(flag => flag.id) : [])
  const diagnostic = (flag: typeof parentRows[number]) => !outcomeFlagOwner(flag.fingerprint) && !assessedFlagIds.has(flag.id) &&
    categoryAdmitsFlag(spec, flag)
  const monitoringFlags = monitoringRows.filter(diagnostic)
  const { baseline, matchesBaseline } = await diagnosticBaseline({ auditId: monitoringAuditId, parentId: parentAuditId, child,
    parentFlags: parentRows.filter(diagnostic), currentFlags: monitoringFlags })
  const projected = await comparisonSources(baseline, monitoringFlags, child, monitoringAuditId)
  const parentFlags = projected.parentFlags
  const observedFlags = projected.monitoringFlags

  const scopePages = spec?.engine === 'progressive-v1'
  const monitoringByKey = indexByMatchKeys(observedFlags, scopePages)
  const matchesOriginal = (original: Flag) => [...monitoringByKey.matches(original)].filter(current => matchesBaseline(original, current))
  const recovery = spec?.engine === 'progressive-v1' ? (await loadRecoveryExecutions([{ auditId: monitoringAuditId,
    flags: parentFlags.filter(flag => !matchesOriginal(flag).length) }])).get(monitoringAuditId) ?? [] : []
  const comparableAbsence = pageAbsenceCheck({ auditStatus: child.status,
    reportCompleteness: child.reportCompleteness, childPages: child.pages,
    auditId: monitoringAuditId, executionSpec: child.executionSpec, verifierExecutions: recovery })
  const parentIndex = indexByMatchKeys(parentFlags, scopePages)

  const fixed: FlagDiffSummaryItem[] = []
  const verified = new Set(outcomeRecoveryIds)
  const inconclusive: FlagDiffSummaryItem[] = []
  const unchanged = new Map<string, FlagDiffSummaryItem>()
  const regressed = new Map<string, FlagDiffSummaryItem>()
  const newIssues: FlagDiffSummaryItem[] = []
  const parentGroups = new Map<string, Flag[]>()
  for (const parent of parentFlags) {
    const key = flagMatchKey(parent, scopePages)
    const group = parentGroups.get(key) ?? []
    group.push(parent); parentGroups.set(key, group)
  }

  // Each group keeps its first Flag for display and all original rows for recovery.
  for (const group of parentGroups.values()) {
    const parentFlag = group[0]
    const representative = scopePages ? undefined : monitoringByKey.find(parentFlag)
    const continuing = group.map(original => ({ original, flags: scopePages ? matchesOriginal(original) : representative ? [representative] : [] }))
    const matches = continuing.flatMap(({ original, flags }) => flags.map(monitoringFlag => ({ original, monitoringFlag })))
    const absent = continuing.filter(({ original, flags }) => !flags.length && original.status !== 'IGNORED' &&
      (original.status !== 'FIXED' || original.resolvedInId === monitoringAuditId)).map(({ original }) => original)

    if (!matches.length) {
      if (!absent.length) continue
      const unverified = absent.filter(original => !comparableAbsence(original))
      if (unverified.length === 0) {
        fixed.push(summaryItem(absent[0]))
        if (scopePages) verified.add(absent[0].id)
      } else {
        const original = unverified.find(flag => ['OPEN', 'REGRESSED'].includes(flag.status)) ?? unverified[0]
        inconclusive.push(summaryItem(original))
      }
      continue
    }

    let allMatchesFixed = true
    for (const { original, monitoringFlag } of matches) {
      const bucket = classifyMatchedFlagDiff({ parentStatus: original.status, parentSeverity: original.severity,
        monitoringStatus: monitoringFlag.status, monitoringSeverity: comparedSeverity(original, monitoringFlag, scopePages) })
      if (bucket === 'fixed') continue
      allMatchesFixed = false
      if (bucket === 'regressed') {
        unchanged.delete(monitoringFlag.id)
        regressed.set(monitoringFlag.id, { ...summaryItem(monitoringFlag), status: 'REGRESSED' })
      } else if (!regressed.has(monitoringFlag.id)) {
        unchanged.set(monitoringFlag.id, { ...summaryItem(monitoringFlag), status: 'OPEN' })
      }
    }
    if (allMatchesFixed && !absent.length) fixed.push({ ...summaryItem(parentFlag), status: 'FIXED' })
    if (scopePages && !allMatchesFixed) {
      // A continuing sibling owns its own finding. Report a confirmed recovery
      // on a separate original page without clearing the whole check family.
      const recovered = absent.find(original => original.pageUrl && comparableAbsence(original))
      if (recovered) {
        fixed.push(summaryItem(recovered))
        verified.add(recovered.id)
      }
    }
  }

  const parentReviewedUrls = reviewedPageUrls({
    pages: parent.pages,
    flags: parentFlags,
  })

  for (const monitoringFlag of observedFlags) {
    const matchesParent = (condition?: string) => [...parentIndex.matches(monitoringFlag, condition)]
      .some(original => matchesBaseline(original, monitoringFlag))
    const crawlConditions = scopePages && baseCheckId(monitoringFlag.checkId) === 'search-crawl-access' ? crawlFailureKeys(monitoringFlag) : undefined
    if (crawlConditions ? regressed.has(monitoringFlag.id) || [...crawlConditions].every(matchesParent) : matchesParent()) continue
    if (crawlConditions) unchanged.delete(monitoringFlag.id)
    const pageUrl = monitoringFlag.pageUrl ?? null
    newIssues.push({
      id: monitoringFlag.id,
      checkId: monitoringFlag.checkId,
      problem: monitoringFlag.problem,
      rubric: monitoringFlag.rubric,
      severity: monitoringFlag.severity,
      status: monitoringFlag.status,
      confidence: monitoringFlag.confidence,
      impactTag: monitoringFlag.impactTag,
      attentionPolicy: monitoringFlag.attentionPolicy,
      pageUrl,
      foundOnNewPage: isFoundOnNewlyReviewedPage({
        pageUrl,
        parentReviewedUrls,
      }),
    })
  }

  const sources = new Map([...parentRows, ...parentFlags, ...monitoringRows].map(flag => [flag.id, flag]))
  const retainEvidenceState = (items: FlagDiffSummaryItem[]) => items.map(item => {
    const source = item.id ? sources.get(item.id) : null
    return source && hasUnreadableStoredSupportingObservations(source.supportingObservations)
      ? { ...item, supportingEvidenceUnreadable: true } : item
  })
  const summary = { fixed: retainEvidenceState([...fixed, ...(outcome?.fixed ?? [])]), inconclusive: retainEvidenceState([...inconclusive, ...(outcome?.inconclusive ?? [])]),
    unchanged: retainEvidenceState([...unchanged.values(), ...(outcome?.unchanged ?? [])]), regressed: retainEvidenceState([...regressed.values(), ...(outcome?.regressed ?? [])]),
    newIssues: retainEvidenceState([...newIssues, ...(outcome?.newIssues ?? [])]) }
  return { summary, ...(scopePages ? { verifiedRecoveryIds: summary.fixed.flatMap(flag =>
    flag.id && !flag.supportingEvidenceUnreadable && verified.has(flag.id) ? [flag.id] : []) } : {}) }
}
