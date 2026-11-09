import type { OutcomeAssessmentState } from '@prisma/client'
import { currentOutcomeState } from '../outcome-state'
import { readExecutionSpec } from '../domain/execution-spec'
import { admittedOutcomeCoverage, comparableOutcomeCoverage, completeOutcomeEvidence } from '../domain/outcome-proof'
import { hasCurrentOutcomeSuccess } from '../domain/outcome-evaluation'

type OutcomeReceipt = {
  outcomeId: string; auditId: string; state: OutcomeAssessmentState; coverage: unknown; evidence: unknown; validUntil: Date
}

/** A selected Outcome needs its own receipt from the recorded Audit. Retain
 * a bound failure even if the rest of its required evidence is incomplete. */
export function recordedOutcomes<T extends OutcomeReceipt>(input: {
  executionSpec: unknown; auditId: string | null; projectId: string | null; now?: Date
  request: { projectId: string; selections: Array<{ outcomeId: string; outcome: { projectId: string | null; name: string } }>;
    assessments: T[] } | undefined
}) {
  const request = input.request?.projectId === input.projectId ? input.request : undefined
  const selections = new Map(request?.selections.filter(item => item.outcome.projectId === input.projectId)
    .map(item => [item.outcomeId, item.outcome]))
  const receipts = new Map(request?.assessments.filter(item => item?.auditId === input.auditId).map(item => [item.outcomeId, item]))
  const spec = readExecutionSpec(input.executionSpec)
  const admitted = new Map(spec?.outcomes.map(item => [item.id, item]))
  const required = spec ? [...admitted.keys()] : [...selections.keys()]
  return required.map(id => {
    const selection = selections.get(id)
    const saved = selection ? receipts.get(id) : undefined
    const outcome = admitted.get(id)
    const receipt = saved && (saved.state === 'COULD_NOT_VERIFY' || !spec || !outcome ||
      comparableOutcomeCoverage(admittedOutcomeCoverage(spec, outcome), saved.coverage)) ? saved : undefined
    const complete = Boolean(receipt && receipt.state !== 'COULD_NOT_VERIFY' &&
      completeOutcomeEvidence(receipt.coverage, receipt.evidence) &&
      (receipt.state !== 'CLEAR' || outcome?.kind !== 'AVAILABILITY' || hasCurrentOutcomeSuccess(outcome.kind, receipt.coverage)))
    const assessment = receipt?.state === 'CLEAR' && !complete ? undefined : receipt
    const state = assessment ? input.now ? currentOutcomeState(assessment, input.now) : assessment.state : 'COULD_NOT_VERIFY'
    return { id, selection, assessment, state, complete, validUntil: assessment?.validUntil,
      recordedUntil: saved?.validUntil }
  })
}
