import { prisma } from '@/lib/db'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import { resolveMonitoringFlagStatus } from '@/lib/audit/flag-status-resolution'
import { severityRank } from '@/lib/utils'
import type { FlagStatus, Severity } from '@prisma/client'
import type { FlagDiffSummaryItem } from './flag-types'

export type { FlagDiffSummaryItem } from './flag-types'

type FlagRow = {
  id: string
  checkId: string | null
  problem: string
  rubric: string
  severity: Severity
  status: FlagStatus
}

function flagMatchKey(f: Pick<FlagRow, 'checkId' | 'problem' | 'rubric'>): string {
  if (f.checkId) return `check:${f.checkId}`
  return buildAiFlagMatchKey(f.problem, f.rubric)
}

export async function diffFlagsAgainstParent(
  monitoringAuditId: string,
  parentAuditId: string
): Promise<void> {
  const [parentFlags, monitoringFlags] = await Promise.all([
    prisma.flag.findMany({
      where: { auditId: parentAuditId },
    }),
    prisma.flag.findMany({
      where: { auditId: monitoringAuditId },
    }),
  ])

  const monitoringByKey = new Map(monitoringFlags.map((f) => [flagMatchKey(f), f]))
  const updates: Array<{
    id: string
    data: { status: FlagStatus; resolvedInId?: string | null }
  }> = []

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const monitoringFlag = monitoringByKey.get(key)

    if (!monitoringFlag) {
      updates.push({
        id: parentFlag.id,
        data: { status: 'FIXED', resolvedInId: monitoringAuditId },
      })
      continue
    }

    const status = resolveMonitoringFlagStatus({
      parentStatus: parentFlag.status,
      parentSeverity: parentFlag.severity,
      monitoringSeverity: monitoringFlag.severity,
      stillFails: true,
    })

    updates.push({
      id: monitoringFlag.id,
      data: { status },
    })
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
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}> {
  const [parentFlags, monitoringFlags] = await Promise.all([
    prisma.flag.findMany({ where: { auditId: parentAuditId } }),
    prisma.flag.findMany({ where: { auditId: monitoringAuditId } }),
  ])

  const monitoringByKey = new Map(monitoringFlags.map((f) => [flagMatchKey(f), f]))
  const parentKeys = new Set(parentFlags.map((f) => flagMatchKey(f)))

  const fixed: FlagDiffSummaryItem[] = []
  const unchanged: FlagDiffSummaryItem[] = []
  const regressed: FlagDiffSummaryItem[] = []
  const newIssues: FlagDiffSummaryItem[] = []

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const monitoringFlag = monitoringByKey.get(key)
    const item: FlagDiffSummaryItem = {
      checkId: parentFlag.checkId,
      problem: parentFlag.problem,
      rubric: parentFlag.rubric,
      severity: parentFlag.severity,
      status: parentFlag.status,
    }

    if (!monitoringFlag) {
      fixed.push(item)
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

  for (const monitoringFlag of monitoringFlags) {
    const key = flagMatchKey(monitoringFlag)
    if (!parentKeys.has(key)) {
      newIssues.push({
        checkId: monitoringFlag.checkId,
        problem: monitoringFlag.problem,
        rubric: monitoringFlag.rubric,
        severity: monitoringFlag.severity,
        status: monitoringFlag.status,
      })
    }
  }

  return { fixed, unchanged, regressed, newIssues }
}
