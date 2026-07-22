import { prisma } from '@/lib/db'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import { resolveMonitoringFlagStatus } from '@/lib/audit/flag-status-resolution'
import { severityRank } from '@/lib/utils'
import type { FlagStatus, Severity } from '@prisma/client'
import type { FlagDiffSummaryItem } from './flag-types'
import {
  appendVerifiedLearning,
  parseProductIntelligence,
} from '@/lib/audit/product-intelligence'

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
  const [parentFlags, monitoringFlags, monitoringAudit] = await Promise.all([
    prisma.flag.findMany({
      where: { auditId: parentAuditId },
    }),
    prisma.flag.findMany({
      where: { auditId: monitoringAuditId },
    }),
    prisma.audit.findUnique({
      where: { id: monitoringAuditId },
      select: { projectId: true },
    }),
  ])

  const monitoringByKey = new Map(monitoringFlags.map((f) => [flagMatchKey(f), f]))
  const updates: Array<{
    id: string
    data: { status: FlagStatus; resolvedInId?: string | null }
  }> = []
  const newlyFixed: Array<{ checkId: string | null; problem: string }> = []

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const monitoringFlag = monitoringByKey.get(key)

    if (!monitoringFlag) {
      updates.push({
        id: parentFlag.id,
        data: { status: 'FIXED', resolvedInId: monitoringAuditId },
      })
      if (parentFlag.status !== 'FIXED' && parentFlag.status !== 'IGNORED') {
        newlyFixed.push({ checkId: parentFlag.checkId, problem: parentFlag.problem })
      }
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
    if (status === 'FIXED' && parentFlag.status !== 'FIXED') {
      newlyFixed.push({ checkId: parentFlag.checkId, problem: parentFlag.problem })
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.flag.update({ where: { id: update.id }, data: update.data })
      )
    )
  }

  // Remember: append verified learnings to Project Product Intelligence
  if (newlyFixed.length > 0 && monitoringAudit?.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: monitoringAudit.projectId },
      select: { productIntelligence: true },
    })
    let pi = parseProductIntelligence(project?.productIntelligence)
    if (!pi) {
      const parentAudit = await prisma.audit.findUnique({
        where: { id: parentAuditId },
        select: { productContract: true },
      })
      const { parseProductContract } = await import('@/lib/audit/product-contract')
      const { productIntelligenceFromContract } = await import(
        '@/lib/audit/product-intelligence'
      )
      const contract = parseProductContract(parentAudit?.productContract)
      if (contract) {
        pi = productIntelligenceFromContract(contract)
      }
    }
    if (pi) {
      for (const fixed of newlyFixed.slice(0, 10)) {
        pi = appendVerifiedLearning(pi, {
          checkId: fixed.checkId ?? undefined,
          summary: `Verified fixed: ${fixed.problem}`,
          auditId: monitoringAuditId,
          at: new Date().toISOString(),
        })
      }
      await prisma.project.update({
        where: { id: monitoringAudit.projectId },
        data: { productIntelligence: pi as object },
      })
    }
  }

  // Product watch: email only when this project is watched and regressions appear.
  try {
    const { notifyWatchRegression } = await import('@/lib/audit/project-watch')
    await notifyWatchRegression(parentAuditId, monitoringAuditId)
  } catch {
    // Non-fatal
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
