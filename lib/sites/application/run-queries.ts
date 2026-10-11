import { prisma } from '@/lib/db'
import { currentOutcomeState } from '@/lib/sites/outcome-state'

export async function getOwnedRun(userId: string, runId: string) {
  const run = await prisma.runRequest.findFirst({
    where: { id: runId, project: { userId, deletedAt: null } },
    include: {
      selections: { include: { outcome: true } },
      assessments: true,
      audit: { select: { progress: true } },
    },
  })
  if (!run) return null
  const primarySelection = run.selections[0] ?? null
  const primaryAssessment = primarySelection
    ? run.assessments.find((item) => item.outcomeId === primarySelection.outcomeId) ?? null
    : null
  const outcomes = run.selections.map((selection) => {
    const assessment = run.assessments.find((item) => item.outcomeId === selection.outcomeId)
    return {
      outcomeId: selection.outcomeId,
      outcomeName: selection.outcome.name,
      result: assessment ? currentOutcomeState(assessment) : null,
      summary: assessment?.summary ?? null,
      coverage: assessment?.coverage ?? null,
      evidence: assessment?.evidence ?? null,
      assessedAt: assessment?.assessedAt.toISOString() ?? null,
      validUntil: assessment?.validUntil.toISOString() ?? null,
    }
  })
  const states = outcomes.map((outcome) => outcome.result)
  const result = states.includes('FLAG') ? 'FLAG'
    : states.includes('COULD_NOT_VERIFY') ? 'COULD_NOT_VERIFY'
      : states.includes('STALE') ? 'STALE'
        : states.length > 0 && states.every((state) => state === 'CLEAR') ? 'CLEAR'
          : run.status === 'FAILED' ? 'FAILED' : null
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
    outcomeId: primarySelection?.outcomeId ?? null,
    outcomeName: primarySelection?.outcome.name ?? null,
    outcomes,
    verificationTarget: run.verificationTarget,
    result,
    summary: outcomes.length === 1
      ? primaryAssessment?.summary ?? null
      : result === 'CLEAR' ? 'All selected Outcomes were verified Clear.'
        : result === 'FLAG' ? 'At least one selected Outcome has a Flag.'
          : result === 'COULD_NOT_VERIFY' ? 'At least one selected Outcome could not be verified.'
            : result === 'STALE' ? 'At least one selected Outcome is Stale.' : null,
    auditId: run.auditId,
    requestedAt: run.requestedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.errorMessage,
  }
}
