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
  recheckAuditId: string,
  parentAuditId: string
): Promise<void> {
  const [parentFlags, recheckFlags] = await Promise.all([
    prisma.flag.findMany({
      where: { auditId: parentAuditId },
    }),
    prisma.flag.findMany({
      where: { auditId: recheckAuditId },
    }),
  ])

  const recheckByKey = new Map(recheckFlags.map((f) => [flagMatchKey(f), f]))
  const updates: Array<{
    id: string
    data: { status: FlagStatus; resolvedInId?: string | null }
  }> = []

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const recheckFlag = recheckByKey.get(key)

    if (!recheckFlag) {
      updates.push({
        id: parentFlag.id,
        data: { status: 'FIXED', resolvedInId: recheckAuditId },
      })
      continue
    }

    const parentRank = severityRank[parentFlag.severity]
    const recheckRank = severityRank[recheckFlag.severity]

    let status: FlagStatus = 'OPEN'
    if (recheckRank > parentRank) status = 'REGRESSED'
    else if (recheckRank < parentRank) status = 'FIXED'

    updates.push({
      id: recheckFlag.id,
      data: { status },
    })
    updates.push({
      id: parentFlag.id,
      data: {
        status,
        resolvedInId: status === 'FIXED' ? recheckAuditId : undefined,
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
  recheckAuditId: string
): Promise<{
  fixed: FlagDiffSummaryItem[]
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}> {
  const [parentFlags, recheckFlags] = await Promise.all([
    prisma.flag.findMany({ where: { auditId: parentAuditId } }),
    prisma.flag.findMany({ where: { auditId: recheckAuditId } }),
  ])

  const recheckByKey = new Map(recheckFlags.map((f) => [flagMatchKey(f), f]))
  const parentKeys = new Set(parentFlags.map((f) => flagMatchKey(f)))

  const fixed: FlagDiffSummaryItem[] = []
  const unchanged: FlagDiffSummaryItem[] = []
  const regressed: FlagDiffSummaryItem[] = []
  const newIssues: FlagDiffSummaryItem[] = []

  for (const parentFlag of parentFlags) {
    const key = flagMatchKey(parentFlag)
    const recheckFlag = recheckByKey.get(key)
    const item: FlagDiffSummaryItem = {
      checkId: parentFlag.checkId,
      problem: parentFlag.problem,
      rubric: parentFlag.rubric,
      severity: parentFlag.severity,
      status: parentFlag.status,
    }

    if (!recheckFlag) {
      fixed.push(item)
      continue
    }

    if (parentFlag.status === 'FIXED' || recheckFlag.status === 'FIXED') {
      fixed.push({ ...item, status: 'FIXED' })
    } else if (parentFlag.status === 'REGRESSED' || recheckFlag.status === 'REGRESSED') {
      regressed.push({
        checkId: recheckFlag.checkId,
        problem: recheckFlag.problem,
        rubric: recheckFlag.rubric,
        severity: recheckFlag.severity,
        status: 'REGRESSED',
      })
    } else {
      unchanged.push({
        checkId: recheckFlag.checkId,
        problem: recheckFlag.problem,
        rubric: recheckFlag.rubric,
        severity: recheckFlag.severity,
        status: 'OPEN',
      })
    }
  }

  for (const recheckFlag of recheckFlags) {
    const key = flagMatchKey(recheckFlag)
    if (!parentKeys.has(key)) {
      newIssues.push({
        checkId: recheckFlag.checkId,
        problem: recheckFlag.problem,
        rubric: recheckFlag.rubric,
        severity: recheckFlag.severity,
        status: recheckFlag.status,
      })
    }
  }

  return { fixed, unchanged, regressed, newIssues }
}
