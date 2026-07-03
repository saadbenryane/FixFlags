import { prisma } from '@/lib/db'
import { FlagStatus, Severity } from '@prisma/client'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'

const severityRank: Record<Severity, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  POLISH: 1,
}

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

    const parentRank = severityRank[parentFlag.severity]
    const monitoringRank = severityRank[monitoringFlag.severity]

    let status: FlagStatus = 'OPEN'
    if (monitoringRank > parentRank) status = 'REGRESSED'
    else if (monitoringRank < parentRank) status = 'FIXED'

    updates.push({
      id: monitoringFlag.id,
      data: { status },
    })
    updates.push({
      id: parentFlag.id,
      data: {
        status,
        resolvedInId: status === 'FIXED' ? monitoringAuditId : undefined,
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

export interface FlagDiffSummaryItem {
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  status?: string
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

    if (parentFlag.status === 'FIXED' || monitoringFlag.status === 'FIXED') {
      fixed.push({ ...item, status: 'FIXED' })
    } else if (parentFlag.status === 'REGRESSED' || monitoringFlag.status === 'REGRESSED') {
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
