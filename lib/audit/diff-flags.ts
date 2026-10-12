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
import { hasRecordedRecoveryEvidence, type RecoveryExecution, type RecoveryFlag } from './recovery-evidence'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { CHECK_REGISTRY } from './check-registry'
import { SEARCH_DEFINITIONS } from './search/definitions'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { outcomeMonitoringDiff } from '@/lib/sites/application/outcome-monitoring'
import { siteWideAnalysisAuditWhere, siteAnalysisAuditWhere } from '@/lib/sites/application/analysis-scope'
import { FLAG_COMPARISON_TARGET, flagComparisonSchema, readFlagComparison, type FlagDiffSummary } from './flag-comparison'

export type { FlagDiffSummaryItem } from './flag-types'

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
  resolvedInId?: string | null
}

type ChildPageCoverage = {
  url: string
  status: string
  completeness: ReportCompleteness
}

function flagMatchKey(
  f: Pick<FlagRow, 'checkId' | 'problem' | 'rubric' | 'fingerprint'>
): string {
  return diffMatchKey(f)
}

function indexByMatchKeys<T extends Pick<FlagRow, 'checkId' | 'problem' | 'rubric' | 'fingerprint'>>(
  flags: T[]
): Map<string, T> {
  const map = new Map<string, T>()
  for (const flag of flags) {
    for (const key of observationMatchKeys(flag)) {
      if (!map.has(key)) map.set(key, flag)
    }
  }
  return map
}

function parentMatchKeySet(
  flags: Array<Pick<FlagRow, 'checkId' | 'problem' | 'rubric' | 'fingerprint'>>
): Set<string> {
  return new Set(flags.flatMap((flag) => observationMatchKeys(flag)))
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

/** Normalize URLs for page-comparable Fixed matching (hash stripped, trailing slash). */
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
  if (input.auditStatus !== 'COMPLETED') return false
  if (readExecutionSpec(input.executionSpec)?.engine === 'progressive-v1') return Boolean(input.auditId && hasRecordedRecoveryEvidence({
    auditId: input.auditId, executionSpec: input.executionSpec, flag: input.parentFlag, executions: input.verifierExecutions ?? [],
  }))

  const ownedUrls = flagPageUrls(input.parentFlag)
  if (ownedUrls.length === 0) {
    return input.reportCompleteness === 'FULL'
  }

  const byUrl = new Map(
    input.childPages.map((page) => [normalizeDiffUrl(page.url), page])
  )
  return ownedUrls.every((url) => pageIsReobservationComparable(byUrl.get(url)))
}

async function loadAuditCoverage(auditId: string | null): Promise<{
  status: string | undefined
  reportCompleteness: ReportCompleteness | null | undefined
  pages: ChildPageCoverage[]
  executionSpec?: unknown
  verifierExecutions?: RecoveryExecution[]
  projectId?: string | null
  outcomeAssessments?: Array<{ evidence: unknown }>
  createdAt?: Date
  parentId?: string | null
  comparison?: FlagDiffSummary
}> {
  if (!auditId) return { status: undefined, reportCompleteness: null, pages: [] }
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      status: true,
      reportCompleteness: true,
      pages: { select: { url: true, status: true, completeness: true } },
      executionSpec: true, projectId: true, createdAt: true, parentId: true, outcomeAssessments: { select: { evidence: true } },
      verifierExecutions: { where: { targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product' }, select: { status: true, detail: true } },
    },
  })
  if (audit?.verifierExecutions?.some(row => row.status !== 'COMPLETED')) throw new Error('The Flag comparison projection has not completed.')
  return {
    status: audit?.status,
    reportCompleteness: audit?.reportCompleteness,
    pages: audit?.pages ?? [],
    executionSpec: audit?.executionSpec, projectId: audit?.projectId ?? null, outcomeAssessments: audit?.outcomeAssessments ?? [],
    createdAt: audit?.createdAt, parentId: audit?.parentId,
    ...(audit?.verifierExecutions?.length ? { comparison: readFlagComparison(audit.verifierExecutions[0].detail, {
      auditId, parentAuditId: audit.parentId,
    }) } : {}),
  }
}

/** A gap carries the latest durable observation, rather than starting a new
 * incident. Completed recoveries return only when the responsibility fails again
 * or when this exact run closed it, keeping replay and healthy states quiet. */
async function diagnosticBaseline(input: {
  auditId: string; parentId: string | null; child: Awaited<ReturnType<typeof loadAuditCoverage>>;
  parentFlags: Flag[]; currentFlags: Flag[];
}): Promise<Flag[]> {
  const spec = readExecutionSpec(input.child.executionSpec)
  if (!spec || !['SITE', 'CATEGORY'].includes(spec.scope) || !input.child.projectId || !input.child.createdAt || input.child.parentId !== input.parentId) return input.parentFlags
  const historyScope = spec.category ? { OR: [siteWideAnalysisAuditWhere, { AND: [
    { executionSpec: { path: ['scope'], equals: 'CATEGORY' } },
    { executionSpec: { path: ['category', 'area'], equals: spec.category.area } },
  ] }] } : siteWideAnalysisAuditWhere
  const admitted = (flag: Flag) => !spec.category || Object.hasOwn(spec.checks, baseCheckId(flag.checkId) ?? '')
  const history = await prisma.improvement.findMany({
    where: { projectId: input.child.projectId, outcomeId: null },
    select: { id: true, occurrences: {
      where: { audit: { projectId: input.child.projectId, id: { not: input.auditId }, status: 'COMPLETED',
        createdAt: { lt: input.child.createdAt }, AND: [historyScope,
          { executionSpec: { path: ['environment'], equals: spec.environment } }] } },
      orderBy: [{ audit: { createdAt: 'desc' } }, { id: 'desc' }], take: 1,
      select: { flag: true },
    }, attempts: {
      where: { OR: [{ outcome: null }, { outcome: 'INCONCLUSIVE' }], createdAt: { lt: input.child.createdAt },
        sourceAudit: { projectId: input.child.projectId, status: 'COMPLETED', AND: [historyScope,
          { executionSpec: { path: ['environment'], equals: spec.environment } }] } },
      select: { sourceAudit: { select: { improvementOccurrences: { select: { improvementId: true, flag: true } } } } },
    } },
  })
  const keys = parentMatchKeySet(input.parentFlags), currentKeys = parentMatchKeySet(input.currentFlags)
  const baseline = [...input.parentFlags]
  const sourceFlags = spec.category && spec.category.sourceAuditId !== input.parentId ? await prisma.flag.findMany({
    where: { auditId: spec.category.sourceAuditId, audit: { projectId: input.child.projectId } },
  }) : []
  for (const previous of [...sourceFlags, ...history.flatMap(improvement => improvement.occurrences[0]?.flag ?? [])]) {
    if (!previous || !admitted(previous) || outcomeFlagOwner(previous.fingerprint) || previous.status === 'IGNORED') continue
    const previousKeys = observationMatchKeys(previous)
    if (previousKeys.some(key => keys.has(key))) continue
    if (previous.status === 'FIXED' && previous.resolvedInId !== input.auditId && !previousKeys.some(key => currentKeys.has(key))) continue
    baseline.push(previous)
    for (const key of previousKeys) keys.add(key)
  }
  // A fix can belong to an older source than the latest failure. Its original
  // Flag must receive its own scope proof before the pending attempt resumes.
  const ids = new Set(baseline.map(flag => flag.id))
  // Every unresolved original condition needs its own recovery decision. A
  // newer occurrence cannot stand in for an older page, device or interaction.
  const unresolved = await prisma.flag.findMany({ where: { status: { in: ['OPEN', 'REGRESSED'] },
    improvementOccurrence: { improvement: { projectId: input.child.projectId, outcomeId: null } },
    audit: { projectId: input.child.projectId, id: { not: input.auditId }, status: 'COMPLETED',
      createdAt: { lt: input.child.createdAt }, AND: [siteAnalysisAuditWhere, spec.environment === 'production' ? { OR: [
        { executionSpec: { path: ['environment'], equals: spec.environment } },
        { executionSpec: { path: ['environment'], equals: Prisma.AnyNull } },
      ] } : { executionSpec: { path: ['environment'], equals: spec.environment } }] } } })
  for (const previous of unresolved) {
    if (!admitted(previous) || ids.has(previous.id) || outcomeFlagOwner(previous.fingerprint) ||
      observationMatchKeys(previous).some(key => currentKeys.has(key))) continue
    baseline.push(previous); ids.add(previous.id)
  }
  for (const improvement of history) for (const attempt of improvement.attempts) {
    const occurrence = attempt.sourceAudit.improvementOccurrences.find(row => row.improvementId === improvement.id)
    const previous = occurrence?.flag
    if (!previous || !admitted(previous) || ids.has(previous.id) || !['OPEN', 'REGRESSED'].includes(previous.status) || outcomeFlagOwner(previous.fingerprint) ||
      observationMatchKeys(previous).some(key => currentKeys.has(key))) continue
    baseline.push(previous)
    ids.add(previous.id)
  }
  return baseline
}

/** Read compact responsibility receipts only when absent findings need a recovery decision. */
async function loadRecoveryExecutions(auditId: string, executionSpec: unknown, flags: RecoveryFlag[]): Promise<RecoveryExecution[]> {
  if (!flags.length || readExecutionSpec(executionSpec)?.engine !== 'progressive-v1') return []
  const ids = [...new Set(flags.flatMap(flag => baseCheckId(flag.checkId) ?? []))]
  const targets = new Set(ids.flatMap(id => ['check:' + id, 'module:' + CHECK_REGISTRY[id]?.module]))
  for (const definition of SEARCH_DEFINITIONS) if (definition.checkIds.some(id => ids.includes(id))) {
    targets.add('module:search'); targets.add('module:search-' + definition.evaluator)
    if (definition.evaluator === 'google') {
      targets.add('module:search-google-index'); targets.add('module:search-google-performance')
    }
  }
  return prisma.auditVerifierExecution.findMany({ where: { auditId, status: 'COMPLETED', targetKey: { in: [...targets] } },
    select: { targetKey: true, status: true, detail: true }, take: 1200 })
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
  const [parentRows, monitoringRows, child] = await Promise.all([
    parentAuditId ? prisma.flag.findMany({
      where: { auditId: parentAuditId },
    }) : Promise.resolve([]),
    prisma.flag.findMany({
      where: { auditId: monitoringAuditId },
    }),
    loadAuditCoverage(monitoringAuditId),
  ])
  // Committed Outcome assessments own bound incidents. A broad report diff
  // cannot reopen or resolve those same Flags through a second state machine.
  const monitoringFlags = monitoringRows.filter(flag => !outcomeFlagOwner(flag.fingerprint))
  const spec = readExecutionSpec(child.executionSpec)
  const parentFlags = await diagnosticBaseline({ auditId: monitoringAuditId, parentId: parentAuditId, child,
    parentFlags: parentRows.filter(flag => !outcomeFlagOwner(flag.fingerprint) && (!spec?.category || Object.hasOwn(spec.checks, baseCheckId(flag.checkId) ?? ''))), currentFlags: monitoringFlags })

  const monitoringByKey = indexByMatchKeys(monitoringFlags)
  const recovery = await loadRecoveryExecutions(monitoringAuditId, child.executionSpec,
    parentFlags.filter(flag => !observationMatchKeys(flag).some(key => monitoringByKey.has(key))))
  const updates: Array<{
    id: string
    data: { status: FlagStatus; resolvedInId?: string | null }
  }> = []
  const seenMonitoringIds = new Set<string>()

  for (const parentFlag of parentFlags) {
    const monitoringFlag = observationMatchKeys(parentFlag)
      .map((key) => monitoringByKey.get(key))
      .find(Boolean)

    if (!monitoringFlag) {
      if (
        isPageComparableAbsence({
          auditStatus: child.status,
          reportCompleteness: child.reportCompleteness,
          childPages: child.pages,
          parentFlag,
          auditId: monitoringAuditId, executionSpec: child.executionSpec, verifierExecutions: recovery,
        })
      ) {
        updates.push({
          id: parentFlag.id,
          data: { status: 'FIXED', resolvedInId: monitoringAuditId },
        })
      }
      continue
    }

    const status = resolveMonitoringFlagStatus({
      parentStatus: parentFlag.status,
      parentSeverity: parentFlag.severity,
      monitoringSeverity: monitoringFlag.severity,
      stillFails: true,
    })

    // Several parent pages can share one base check (per-page ::page:N
    // variants collapse onto the same monitoring flag). Update the monitoring
    // flag once, and keep the strongest status for the parent rows.
    if (!seenMonitoringIds.has(monitoringFlag.id)) {
      seenMonitoringIds.add(monitoringFlag.id)
      updates.push({
        id: monitoringFlag.id,
        data: { status },
      })
    }
    if (parentFlag.status === 'FIXED') continue
    updates.push({
      id: parentFlag.id,
      data: {
        status,
        resolvedInId: status === 'FIXED' ? monitoringAuditId : null,
      },
    })
  }

  if (updates.length > 0) {
    await executionTransaction(async tx => Promise.all(updates.map((update) =>
        tx.flag.update({ where: { id: update.id }, data: update.data })
      )))
  }
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
  monitoringAuditId: string
): Promise<FlagDiffSummary> {
  const child = await loadAuditCoverage(monitoringAuditId)
  if (child.comparison && child.parentId === parentAuditId) return child.comparison
  return calculateFlagDiffSummary(parentAuditId, monitoringAuditId, child)
}

/** Finalization records this once after both diagnostic and bound projections.
 * Readers and notification retries never rebuild a completed comparison from
 * Flag statuses that a later monitoring run can legitimately change. */
export async function persistFlagDiffSummary(parentAuditId: string | null, monitoringAuditId: string): Promise<void> {
  const child = await loadAuditCoverage(monitoringAuditId)
  const scope = readExecutionSpec(child.executionSpec)?.scope
  if (scope === 'DIAGNOSTIC' || scope === 'FIXTURE_SETUP') return
  if (child.status !== 'COMPLETED' || child.parentId !== parentAuditId) throw new Error('Flag comparison requires its completed execution and original parent.')
  if (child.comparison) return
  const summary = await calculateFlagDiffSummary(parentAuditId, monitoringAuditId, child)
  const detail = flagComparisonSchema.parse({ kind: 'flag-comparison', version: 1, auditId: monitoringAuditId,
    parentAuditId, summary })
  await executionTransaction(async tx => {
    const record = await tx.auditVerifierExecution.upsert({ where: { auditId_targetKey_scopeKey: {
      auditId: monitoringAuditId, targetKey: FLAG_COMPARISON_TARGET, scopeKey: 'product',
    } }, update: {}, create: { auditId: monitoringAuditId, targetKey: FLAG_COMPARISON_TARGET,
      scopeKey: 'product', source: 'SYSTEM', status: 'COMPLETED',
      evidenceReference: { auditId: monitoringAuditId, parentAuditId }, detail: JSON.parse(JSON.stringify(detail)),
    }, select: { status: true, detail: true } })
    if (record.status !== 'COMPLETED') throw new Error('The Flag comparison projection has not completed.')
    readFlagComparison(record.detail, { auditId: monitoringAuditId, parentAuditId })
  })
}

async function calculateFlagDiffSummary(parentAuditId: string | null, monitoringAuditId: string,
  child: Awaited<ReturnType<typeof loadAuditCoverage>>): Promise<FlagDiffSummary> {
  const outcome = await outcomeMonitoringDiff(monitoringAuditId, { projectId: child.projectId ?? null, executionSpec: child.executionSpec, outcomeAssessments: child.outcomeAssessments ?? [] })
  if (outcome && readExecutionSpec(child.executionSpec)?.scope === 'OUTCOMES') return outcome
  const [parentRows, monitoringRows, parent] = await Promise.all([
    parentAuditId ? prisma.flag.findMany({ where: { auditId: parentAuditId } }) : Promise.resolve([]),
    prisma.flag.findMany({ where: { auditId: monitoringAuditId } }),
    loadAuditCoverage(parentAuditId),
  ])
  const assessedFlagIds = new Set(outcome ? Object.values(outcome).flat().map(flag => flag.id) : [])
  const spec = readExecutionSpec(child.executionSpec)
  const diagnostic = (flag: typeof parentRows[number]) => !outcomeFlagOwner(flag.fingerprint) && !assessedFlagIds.has(flag.id) &&
    (!spec?.category || Object.hasOwn(spec.checks, baseCheckId(flag.checkId) ?? ''))
  const monitoringFlags = monitoringRows.filter(diagnostic)
  const parentFlags = await diagnosticBaseline({ auditId: monitoringAuditId, parentId: parentAuditId, child,
    parentFlags: parentRows.filter(diagnostic), currentFlags: monitoringFlags })

  const monitoringByKey = indexByMatchKeys(monitoringFlags)
  const recovery = await loadRecoveryExecutions(monitoringAuditId, child.executionSpec,
    parentFlags.filter(flag => !observationMatchKeys(flag).some(key => monitoringByKey.has(key))))
  const parentKeys = parentMatchKeySet(parentFlags)

  const fixed: FlagDiffSummaryItem[] = []
  const inconclusive: FlagDiffSummaryItem[] = []
  const unchanged: FlagDiffSummaryItem[] = []
  const regressed: FlagDiffSummaryItem[] = []
  const newIssues: FlagDiffSummaryItem[] = []
  const parentGroups = new Map<string, Flag[]>()
  for (const parent of parentFlags) {
    const key = flagMatchKey(parent)
    const group = parentGroups.get(key) ?? []
    group.push(parent); parentGroups.set(key, group)
  }

  const seenParentKeys = new Set<string>()
  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    // Only the first (highest-position) parent variant of a base check
    // contributes to the summary so per-page ::page:N copies do not leak
    // into the re-check diff as separate entries.
    if (seenParentKeys.has(key)) continue
    seenParentKeys.add(key)
    const monitoringFlag = observationMatchKeys(parentFlag)
      .map((matchKey) => monitoringByKey.get(matchKey))
      .find(Boolean)
    const item: FlagDiffSummaryItem = {
      id: parentFlag.id,
      checkId: parentFlag.checkId,
      problem: parentFlag.problem,
      rubric: parentFlag.rubric,
      severity: parentFlag.severity,
      status: parentFlag.status,
      confidence: parentFlag.confidence,
      impactTag: parentFlag.impactTag,
      attentionPolicy: parentFlag.attentionPolicy,
      pageUrl: parentFlag.pageUrl,
    }

    if (!monitoringFlag) {
      const unverified = parentGroups.get(key)!.filter(original => !isPageComparableAbsence({
          auditStatus: child.status,
          reportCompleteness: child.reportCompleteness,
          childPages: child.pages,
          parentFlag: original,
          auditId: monitoringAuditId, executionSpec: child.executionSpec, verifierExecutions: recovery,
        }))
      if (unverified.length === 0) {
        fixed.push(item)
      } else {
        const original = unverified.find(flag => ['OPEN', 'REGRESSED'].includes(flag.status)) ?? unverified[0]
        inconclusive.push({ ...item, id: original.id, checkId: original.checkId, problem: original.problem,
          severity: original.severity, status: original.status, rubric: original.rubric,
          confidence: original.confidence, impactTag: original.impactTag, attentionPolicy: original.attentionPolicy, pageUrl: original.pageUrl })
      }
      continue
    }

    const bucket = classifyMatchedFlagDiff({
      parentStatus: parentFlag.status,
      parentSeverity: parentFlag.severity,
      monitoringStatus: monitoringFlag.status,
      monitoringSeverity: monitoringFlag.severity,
    })

    if (bucket === 'fixed') {
      fixed.push({ ...item, status: 'FIXED' })
    } else if (bucket === 'regressed') {
      regressed.push({
        id: monitoringFlag.id,
        checkId: monitoringFlag.checkId,
        problem: monitoringFlag.problem,
        rubric: monitoringFlag.rubric,
        severity: monitoringFlag.severity,
        status: 'REGRESSED',
        confidence: monitoringFlag.confidence,
        impactTag: monitoringFlag.impactTag,
        attentionPolicy: monitoringFlag.attentionPolicy,
        pageUrl: monitoringFlag.pageUrl,
      })
    } else {
      unchanged.push({
        id: monitoringFlag.id,
        checkId: monitoringFlag.checkId,
        problem: monitoringFlag.problem,
        rubric: monitoringFlag.rubric,
        severity: monitoringFlag.severity,
        status: 'OPEN',
        confidence: monitoringFlag.confidence,
        impactTag: monitoringFlag.impactTag,
        attentionPolicy: monitoringFlag.attentionPolicy,
        pageUrl: monitoringFlag.pageUrl,
      })
    }
  }

  const parentReviewedUrls = reviewedPageUrls({
    pages: parent.pages,
    flags: parentFlags,
  })

  for (const monitoringFlag of monitoringFlags) {
    if (observationMatchKeys(monitoringFlag).some((key) => parentKeys.has(key))) continue
    // The matching side is also keyed by base check, so a per-page variant of
    // a parent check can never appear here as a brand-new issue.
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

  return { fixed: [...fixed, ...(outcome?.fixed ?? [])], inconclusive: [...inconclusive, ...(outcome?.inconclusive ?? [])],
    unchanged: [...unchanged, ...(outcome?.unchanged ?? [])], regressed: [...regressed, ...(outcome?.regressed ?? [])],
    newIssues: [...newIssues, ...(outcome?.newIssues ?? [])] }
}
