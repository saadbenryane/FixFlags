import { prisma } from '@/lib/db'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import { resolveMonitoringFlagStatus } from '@/lib/audit/flag-status-resolution'
import { parseAffectedPaths } from '@/lib/audit/flag-identity'
import { severityRank } from '@/lib/utils'
import type { FlagStatus, ReportCompleteness, Severity } from '@prisma/client'
import type { FlagDiffSummaryItem } from './flag-types'

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
}

type ChildPageCoverage = {
  url: string
  status: string
  completeness: ReportCompleteness
}

function flagMatchKey(f: Pick<FlagRow, 'checkId' | 'problem' | 'rubric'>): string {
  return diffMatchKey(f)
}

/**
 * Match key for diffing flags across reports. Per-page `::page:N` variants of
 * the same deterministic check collapse onto one site-level key so page-order
 * shifts do not make every variant look newly fixed/regressed and leak
 * duplicate findings into the re-check diff.
 */
export function diffMatchKey(input: {
  checkId: string | null
  problem: string
  rubric: string
}): string {
  if (input.checkId) return `check:${baseCheckIdForMatch(input.checkId)}`
  return buildAiFlagMatchKey(input.problem, input.rubric)
}

/**
 * Strip the per-page `::page:N` suffix before matching so a parent flag like
 * `cta-dead-link::page:2` matches the re-check's `cta-dead-link::page:1`.
 */
function baseCheckIdForMatch(checkId: string): string {
  return checkId.split('::page:')[0] ?? checkId
}

/** Normalize URLs for page-comparable Fixed matching (hash stripped, trailing slash). */
export function normalizeDiffUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.replace(/\/$/, '')
  }
}

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
  parentFlag: Pick<FlagRow, 'pageUrl' | 'affectedPaths'>
}): boolean {
  if (input.auditStatus !== 'COMPLETED') return false

  const ownedUrls = flagPageUrls(input.parentFlag)
  if (ownedUrls.length === 0) {
    return input.reportCompleteness === 'FULL'
  }

  const byUrl = new Map(
    input.childPages.map((page) => [normalizeDiffUrl(page.url), page])
  )
  return ownedUrls.every((url) => pageIsReobservationComparable(byUrl.get(url)))
}

async function loadChildCoverage(monitoringAuditId: string): Promise<{
  status: string | undefined
  reportCompleteness: ReportCompleteness | null | undefined
  pages: ChildPageCoverage[]
}> {
  const monitoringAudit = await prisma.audit.findUnique({
    where: { id: monitoringAuditId },
    select: {
      status: true,
      reportCompleteness: true,
      pages: { select: { url: true, status: true, completeness: true } },
    },
  })
  return {
    status: monitoringAudit?.status,
    reportCompleteness: monitoringAudit?.reportCompleteness,
    pages: monitoringAudit?.pages ?? [],
  }
}

export async function diffFlagsAgainstParent(
  monitoringAuditId: string,
  parentAuditId: string
): Promise<void> {
  const [parentFlags, monitoringFlags, child] = await Promise.all([
    prisma.flag.findMany({
      where: { auditId: parentAuditId },
    }),
    prisma.flag.findMany({
      where: { auditId: monitoringAuditId },
    }),
    loadChildCoverage(monitoringAuditId),
  ])

  const monitoringByKey = new Map(monitoringFlags.map((f) => [flagMatchKey(f), f]))
  const updates: Array<{
    id: string
    data: { status: FlagStatus; resolvedInId?: string | null }
  }> = []
  const seenMonitoringIds = new Set<string>()

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const monitoringFlag = monitoringByKey.get(key)

    if (!monitoringFlag) {
      if (
        isPageComparableAbsence({
          auditStatus: child.status,
          reportCompleteness: child.reportCompleteness,
          childPages: child.pages,
          parentFlag,
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
    updates.push({
      id: parentFlag.id,
      data: {
        status,
        resolvedInId: status === 'FIXED' ? monitoringAuditId : null,
      },
    })
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.flag.update({ where: { id: update.id }, data: update.data })
      )
    )
  }

  // Product watch: email only when this project is watched and regressions appear.
  const { notifyWatchRegression } = await import('@/lib/audit/project-watch')
  await notifyWatchRegression(parentAuditId, monitoringAuditId)
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
  parentAuditId: string,
  monitoringAuditId: string
): Promise<{
  fixed: FlagDiffSummaryItem[]
  inconclusive: FlagDiffSummaryItem[]
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}> {
  const [parentFlags, monitoringFlags, child] = await Promise.all([
    prisma.flag.findMany({ where: { auditId: parentAuditId } }),
    prisma.flag.findMany({ where: { auditId: monitoringAuditId } }),
    loadChildCoverage(monitoringAuditId),
  ])

  const monitoringByKey = new Map(monitoringFlags.map((f) => [flagMatchKey(f), f]))
  const parentKeys = new Set(parentFlags.map((f) => flagMatchKey(f)))

  const fixed: FlagDiffSummaryItem[] = []
  const inconclusive: FlagDiffSummaryItem[] = []
  const unchanged: FlagDiffSummaryItem[] = []
  const regressed: FlagDiffSummaryItem[] = []
  const newIssues: FlagDiffSummaryItem[] = []

  const seenParentKeys = new Set<string>()
  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    // Only the first (highest-position) parent variant of a base check
    // contributes to the summary so per-page ::page:N copies do not leak
    // into the re-check diff as separate entries.
    if (seenParentKeys.has(key)) continue
    seenParentKeys.add(key)
    const monitoringFlag = monitoringByKey.get(key)
    const item: FlagDiffSummaryItem = {
      checkId: parentFlag.checkId,
      problem: parentFlag.problem,
      rubric: parentFlag.rubric,
      severity: parentFlag.severity,
      status: parentFlag.status,
    }

    if (!monitoringFlag) {
      if (
        isPageComparableAbsence({
          auditStatus: child.status,
          reportCompleteness: child.reportCompleteness,
          childPages: child.pages,
          parentFlag,
        })
      ) {
        fixed.push(item)
      } else {
        inconclusive.push(item)
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
        checkId: monitoringFlag.checkId,
        problem: monitoringFlag.problem,
        rubric: monitoringFlag.rubric,
        severity: monitoringFlag.severity,
        status: 'REGRESSED',
      })
    } else {
      unchanged.push({
        checkId: monitoringFlag.checkId,
        problem: monitoringFlag.problem,
        rubric: monitoringFlag.rubric,
        severity: monitoringFlag.severity,
        status: 'OPEN',
      })
    }
  }

  const parentPageUrls = new Set(
    parentFlags.map((f) => f.pageUrl).filter((u): u is string => Boolean(u))
  )

  for (const monitoringFlag of monitoringFlags) {
    const key = flagMatchKey(monitoringFlag)
    if (parentKeys.has(key)) continue
    // The matching side is also keyed by base check, so a per-page variant of
    // a parent check can never appear here as a brand-new issue.
    const pageUrl = monitoringFlag.pageUrl ?? null
    newIssues.push({
      checkId: monitoringFlag.checkId,
      problem: monitoringFlag.problem,
      rubric: monitoringFlag.rubric,
      severity: monitoringFlag.severity,
      status: monitoringFlag.status,
      pageUrl,
      foundOnNewPage: Boolean(pageUrl && !parentPageUrls.has(pageUrl)),
    })
  }

  return { fixed, inconclusive, unchanged, regressed, newIssues }
}
