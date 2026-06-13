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
  const updates: Array<{ id: string; data: { status: FindingStatus; resolvedInId?: string } }> = []

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
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.finding.update({ where: { id: update.id }, data: update.data })
      )
    )
  }
}

export async function getFindingDiffSummary(beforeId: string, afterId: string) {
  const [afterFindings, parentFindings] = await Promise.all([
    prisma.finding.findMany({
      where: { auditId: afterId },
      select: { checkId: true, status: true, problem: true, area: true, severity: true },
    }),
    prisma.finding.findMany({
      where: { auditId: beforeId },
      select: { checkId: true, status: true, problem: true, area: true, severity: true },
    }),
  ])

  const afterByKey = new Map(afterFindings.map((f) => [findingMatchKey(f), f]))
  const parentByKey = new Map(parentFindings.map((f) => [findingMatchKey(f), f]))

  const fixed: typeof afterFindings = []
  const unchanged: typeof afterFindings = []
  const regressed: typeof afterFindings = []
  const newIssues: typeof afterFindings = []

  for (const pf of parentFindings) {
    const af = afterByKey.get(findingMatchKey(pf))
    if (!af) {
      fixed.push({ ...pf, status: 'FIXED' })
    } else if (af.status === 'REGRESSED') {
      regressed.push(af)
    } else if (af.status === 'UNCHANGED') {
      unchanged.push(af)
    } else {
      fixed.push(af)
    }
  }

  for (const af of afterFindings) {
    if (!parentByKey.has(findingMatchKey(af))) {
      newIssues.push(af)
    }
  }

  return { fixed, unchanged, regressed, newIssues }
}
