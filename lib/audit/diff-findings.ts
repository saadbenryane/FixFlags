import { prisma } from '@/lib/db'
import { FindingStatus, Severity } from '@prisma/client'

const severityRank: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
}

export async function diffFindingsAgainstParent(
  recheckAuditId: string,
  parentAuditId: string
): Promise<void> {
  const [parentFindings, recheckFindings] = await Promise.all([
    prisma.finding.findMany({
      where: { auditId: parentAuditId, checkId: { not: null } },
    }),
    prisma.finding.findMany({
      where: { auditId: recheckAuditId, checkId: { not: null } },
    }),
  ])

  const recheckByCheckId = new Map(recheckFindings.map((f) => [f.checkId!, f]))

  for (const parentFinding of parentFindings) {
    const checkId = parentFinding.checkId!
    const recheckFinding = recheckByCheckId.get(checkId)

    if (!recheckFinding) {
      await prisma.finding.update({
        where: { id: parentFinding.id },
        data: { status: 'FIXED', resolvedInId: recheckAuditId },
      })
      continue
    }

    const parentRank = severityRank[parentFinding.severity]
    const recheckRank = severityRank[recheckFinding.severity]

    let status: FindingStatus = 'UNCHANGED'
    if (recheckRank > parentRank) status = 'REGRESSED'
    else if (recheckRank < parentRank) status = 'FIXED'

    await prisma.finding.update({
      where: { id: recheckFinding.id },
      data: { status },
    })
  }
}

export async function getFindingDiffSummary(beforeId: string, afterId: string) {
  const afterFindings = await prisma.finding.findMany({
    where: { auditId: afterId, checkId: { not: null } },
    select: { checkId: true, status: true, problem: true, area: true, severity: true },
  })

  const parentFindings = await prisma.finding.findMany({
    where: { auditId: beforeId, checkId: { not: null } },
    select: { checkId: true, status: true, problem: true, area: true, severity: true },
  })

  const afterByCheckId = new Map(afterFindings.map((f) => [f.checkId!, f]))
  const parentByCheckId = new Map(parentFindings.map((f) => [f.checkId!, f]))

  const fixed: typeof afterFindings = []
  const unchanged: typeof afterFindings = []
  const regressed: typeof afterFindings = []
  const newIssues: typeof afterFindings = []

  for (const pf of parentFindings) {
    const af = afterByCheckId.get(pf.checkId!)
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
    if (!parentByCheckId.has(af.checkId!)) {
      newIssues.push(af)
    }
  }

  return { fixed, unchanged, regressed, newIssues }
}
