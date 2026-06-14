import { prisma } from '@/lib/db'
import { FindingStatus, Severity } from '@prisma/client'
import { buildAiFindingMatchKey } from '@/lib/audit/validate-judge-output'

const severityRank: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
}

type FindingRow = {
  id: string
  checkId: string | null
  problem: string
  area: string
  severity: Severity
  status: FindingStatus
}

function findingMatchKey(f: Pick<FindingRow, 'checkId' | 'problem' | 'area'>): string {
  if (f.checkId) return `check:${f.checkId}`
  return buildAiFindingMatchKey(f.problem, f.area)
}

export async function diffFindingsAgainstParent(
  recheckAuditId: string,
  parentAuditId: string
): Promise<void> {
  const [parentFindings, recheckFindings] = await Promise.all([
    prisma.finding.findMany({
      where: { auditId: parentAuditId },
    }),
    prisma.finding.findMany({
      where: { auditId: recheckAuditId },
    }),
  ])

  const recheckByKey = new Map(recheckFindings.map((f) => [findingMatchKey(f), f]))
  const updates: Array<{
    id: string
    data: { status: FindingStatus; resolvedInId?: string }
  }> = []

  for (const parentFinding of parentFindings) {
    const key = findingMatchKey(parentFinding)
    const recheckFinding = recheckByKey.get(key)

    if (!recheckFinding) {
      updates.push({
        id: parentFinding.id,
        data: { status: 'FIXED', resolvedInId: recheckAuditId },
      })
      continue
    }

    const parentRank = severityRank[parentFinding.severity]
    const recheckRank = severityRank[recheckFinding.severity]

    let status: FindingStatus = 'UNCHANGED'
    if (recheckRank > parentRank) status = 'REGRESSED'
    else if (recheckRank < parentRank) status = 'FIXED'

    updates.push({
      id: recheckFinding.id,
      data: { status },
    })
    updates.push({
      id: parentFinding.id,
      data: {
        status,
        resolvedInId: status === 'FIXED' ? recheckAuditId : undefined,
      },
    })
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.finding.update({ where: { id: update.id }, data: update.data })
      )
    )
  }
}

export interface FindingDiffSummaryItem {
  checkId: string | null
  problem: string
  area: string
  severity: string
  status?: string
}

export async function getFindingDiffSummary(
  parentAuditId: string,
  recheckAuditId: string
): Promise<{
  fixed: FindingDiffSummaryItem[]
  unchanged: FindingDiffSummaryItem[]
  regressed: FindingDiffSummaryItem[]
  newIssues: FindingDiffSummaryItem[]
}> {
  const [parentFindings, recheckFindings] = await Promise.all([
    prisma.finding.findMany({ where: { auditId: parentAuditId } }),
    prisma.finding.findMany({ where: { auditId: recheckAuditId } }),
  ])

  const recheckByKey = new Map(recheckFindings.map((f) => [findingMatchKey(f), f]))
  const parentKeys = new Set(parentFindings.map((f) => findingMatchKey(f)))

  const fixed: FindingDiffSummaryItem[] = []
  const unchanged: FindingDiffSummaryItem[] = []
  const regressed: FindingDiffSummaryItem[] = []
  const newIssues: FindingDiffSummaryItem[] = []

  for (const parentFinding of parentFindings) {
    const key = findingMatchKey(parentFinding)
    const recheckFinding = recheckByKey.get(key)
    const item: FindingDiffSummaryItem = {
      checkId: parentFinding.checkId,
      problem: parentFinding.problem,
      area: parentFinding.area,
      severity: parentFinding.severity,
      status: parentFinding.status,
    }

    if (!recheckFinding) {
      fixed.push(item)
      continue
    }

    if (parentFinding.status === 'FIXED' || recheckFinding.status === 'FIXED') {
      fixed.push({ ...item, status: 'FIXED' })
    } else if (parentFinding.status === 'REGRESSED' || recheckFinding.status === 'REGRESSED') {
      regressed.push({
        checkId: recheckFinding.checkId,
        problem: recheckFinding.problem,
        area: recheckFinding.area,
        severity: recheckFinding.severity,
        status: 'REGRESSED',
      })
    } else {
      unchanged.push({
        checkId: recheckFinding.checkId,
        problem: recheckFinding.problem,
        area: recheckFinding.area,
        severity: recheckFinding.severity,
        status: 'UNCHANGED',
      })
    }
  }

  for (const recheckFinding of recheckFindings) {
    const key = findingMatchKey(recheckFinding)
    if (!parentKeys.has(key)) {
      newIssues.push({
        checkId: recheckFinding.checkId,
        problem: recheckFinding.problem,
        area: recheckFinding.area,
        severity: recheckFinding.severity,
        status: recheckFinding.status,
      })
    }
  }

  return { fixed, unchanged, regressed, newIssues }
}
