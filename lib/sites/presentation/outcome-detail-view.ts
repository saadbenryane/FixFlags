import type { Prisma } from '@prisma/client'
import type { SiteOutcomeView, OutcomeViewSource } from './outcome-view'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { bindingEvidenceIsComparable, type CurrentBindingRevision } from '../domain/assessment-comparability'
import { readExecutionSpec } from '../domain/execution-spec'
import { availabilityCouldNotVerifyRecovery, checkoutCouldNotVerifyRecovery, currentOutcomeState,
  customerBindingResult, outcomeStatusLabel, staleOutcomeRecovery } from '../outcome-state'

export type SiteOutcomeDetailView = Omit<SiteOutcomeView, 'bindings'> & {
  bindings: Array<SiteOutcomeView['bindings'][number] & {
    latestEvidence: {
      disposition: string
      reason: string
      detail: Prisma.JsonValue | null
      createdAt: string
      auditId: string
    } | null
    /** Evidence-card sentence for this method. A method with no execution uses the empty-evidence sentence. */
    customerSentence: string
  }>
  limitation: string | null
  recoveryAction: string | null
  lastSuccessfulVerificationAt: string | null
  timeline: Array<{
    id: string
    type: 'run' | 'assessment' | 'attempt' | 'flag' | 'fix' | 'verify'
    at: string
    title: string
    detail: string
    auditId: string | null
  }>
}

export type OutcomeDetailFacts = {
  row: Pick<OutcomeViewSource, 'id' | 'environment'> & {
    assessments: Array<OutcomeViewSource['assessments'][number] & { id: string; auditId: string }>
    runSelections: Array<{ runRequest: { id: string; status: string; requestedAt: Date; errorMessage: string | null; auditId: string | null } }>
    bindingAttempts: Array<{ id: string; bindingKey: string; disposition: string; reason: string; createdAt: Date; auditId: string }>
  }
  view: SiteOutcomeView
  revisions: CurrentBindingRevision[]
  executions: Array<{ id: string; bindingKey: string; bindingVersion: number | null; mechanism: string | null;
    auditId: string; createdAt: Date; disposition: string; reason: string; detail: Prisma.JsonValue | null;
    audit: { executionSpec: Prisma.JsonValue | null } | null }>
  lastSuccessful: { assessedAt: Date } | null
  improvements: Array<{ title: string; occurrences: Array<{ id: string; kind: string; createdAt: Date; auditId: string }>;
    attempts: Array<{ id: string; createdAt: Date; changeSummary: string | null; outcome: string | null;
      verificationReason: string | null; sourceAuditId: string; verificationAuditId: string | null }> }>
}

/** Present recorded facts without querying, mutating or recertifying history. */
export function projectOutcomeDetail({ row, view, revisions, executions, lastSuccessful, improvements }: OutcomeDetailFacts,
  now: Date): SiteOutcomeDetailView {
  // A method needs its own recorded revision and environment. A newer execution
  // of an obsolete configuration cannot replace comparable current evidence.
  const latestByKey = new Map<string, (typeof executions)[number]>()
  for (const execution of executions) {
    const current = revisions.find(binding => binding.key === execution.bindingKey)
    if (!current || execution.bindingVersion != null && execution.bindingVersion !== current.version ||
      execution.mechanism && execution.mechanism !== current.mechanism) continue
    if (current.required && row.assessments[0] && execution.auditId !== row.assessments[0].auditId) continue
    const spec = readExecutionSpec(execution.audit?.executionSpec)
    if (spec && spec.environment !== row.environment) continue
    const bindings = spec?.outcomes.find(outcome => outcome.id === row.id)?.bindings
    const coverage = bindings?.some(binding => binding.key === current.key) ? { environment: spec!.environment, requiredBindings: [], bindings }
      : row.assessments.find(assessment => assessment.auditId === execution.auditId)?.coverage
    if (bindingEvidenceIsComparable(coverage, current, row.environment) && !latestByKey.has(execution.bindingKey))
      latestByKey.set(execution.bindingKey, execution)
  }
  const timeline = [
    ...row.runSelections.map(({ runRequest }) => ({
      id: `run:${runRequest.id}`,
      type: 'run' as const,
      at: runRequest.requestedAt.toISOString(),
      title: runRequest.status === 'COMPLETED' ? 'Verification completed' : runRequest.status === 'FAILED' ? 'Verification failed' : 'Verification started',
      detail: runRequest.errorMessage ?? `Run ${runRequest.status.toLowerCase()}`,
      auditId: runRequest.auditId,
    })),
    ...row.assessments.map((assessment) => ({
      id: `assessment:${assessment.id}`,
      type: 'assessment' as const,
      at: assessment.assessedAt.toISOString(),
      title: outcomeStatusLabel(currentOutcomeState(assessment, now)),
      detail: assessment.summary,
      auditId: assessment.auditId,
    })),
    ...row.bindingAttempts.map((attempt) => {
      const sentence = customerBindingResult({
        key: attempt.bindingKey,
        disposition: attempt.disposition,
        reason: attempt.reason,
      })
      return {
        id: `attempt:${attempt.id}`,
        type: 'attempt' as const,
        at: attempt.createdAt.toISOString(),
        title: sentence.headline,
        detail: sentence.detail ?? '',
        auditId: attempt.auditId,
      }
    }),
    ...executions.filter(execution => !row.bindingAttempts.some(attempt =>
      attempt.auditId === execution.auditId && attempt.bindingKey === execution.bindingKey)).map(execution => {
      const sentence = customerBindingResult({ key: execution.bindingKey, disposition: execution.disposition, reason: execution.reason })
      return { id: `execution:${execution.id}`, type: 'attempt' as const, at: execution.createdAt.toISOString(),
        title: sentence.headline, detail: sentence.detail ?? '', auditId: execution.auditId }
    }),
    ...improvements.flatMap((improvement) => improvement.occurrences.map((occurrence) => ({
      id: `flag:${occurrence.id}`,
      type: 'flag' as const,
      at: occurrence.createdAt.toISOString(),
      title: occurrence.kind === 'REGRESSED'
        ? 'Flag recurred'
        : occurrence.kind === 'CLEARED'
          ? 'Flag recovered'
          : 'Flag recorded',
      detail: improvement.title,
      auditId: occurrence.auditId,
    }))),
    ...improvements.flatMap((improvement) => improvement.attempts.map((attempt) => ({
      id: `fix:${attempt.id}`,
      type: attempt.outcome ? 'verify' as const : 'fix' as const,
      at: attempt.createdAt.toISOString(),
      title: attempt.outcome
        ? attempt.outcome === 'IMPROVED' ? 'Recovery verified' : `Verification ${attempt.outcome.toLowerCase()}`
        : 'Fix recorded',
      detail: attempt.changeSummary ?? attempt.verificationReason ?? improvement.title,
      auditId: attempt.verificationAuditId ?? attempt.sourceAuditId,
    }))),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const requiredBindings = view.bindings.filter((binding) => binding.required)
  const checkoutBinding = requiredBindings.find((binding) => binding.key.includes('checkout'))
  const availabilityBinding = requiredBindings.find((binding) => binding.mechanism === 'HTTP_AVAILABILITY')
  const limitation = !view.enabled
    ? 'This Outcome is paused. Its last evidence is preserved, but FixFlags will not schedule or start another verification.'
    : requiredBindings.length === 0
      ? 'No independent verification method is configured.'
      : view.state === 'COULD_NOT_VERIFY'
        ? view.summary
        : null
  const recoveryAction = !view.enabled
    ? 'Enable this Outcome to verify it again.'
    : requiredBindings.length === 0
      ? 'Configure a supported verification method in Site settings.'
      : view.state === 'STALE'
        ? staleOutcomeRecovery()
        : view.state === 'COULD_NOT_VERIFY'
          ? view.kind === 'CHECKOUT'
            ? checkoutCouldNotVerifyRecovery(checkoutBinding ? latestByKey.get(checkoutBinding.key)?.reason : null)
            : view.kind === 'AVAILABILITY'
              ? availabilityCouldNotVerifyRecovery(availabilityBinding ? latestByKey.get(availabilityBinding.key)?.reason : null)
              : 'Review the method or fixture, then verify again.'
          : null

  return {
    ...view,
    bindings: view.bindings.map((binding) => {
      const evidence = latestByKey.get(binding.key)
      const sentence = evidence
        ? customerBindingResult({
            key: binding.key,
            disposition: evidence.disposition,
            reason: evidence.reason,
          })
        : null
      return {
        ...binding,
        latestEvidence: evidence ? {
          disposition: evidence.disposition,
          reason: evidence.reason,
          detail: evidence.detail,
          createdAt: evidence.createdAt.toISOString(),
          auditId: evidence.auditId,
        } : null,
        customerSentence: sentence?.headline ?? (executions.some(execution => execution.bindingKey === binding.key)
          ? OUTCOME_DETAIL_COPY.currentEvidenceMissing : OUTCOME_DETAIL_COPY.noEvidence),
      }
    }),
    limitation,
    recoveryAction,
    lastSuccessfulVerificationAt: lastSuccessful?.assessedAt.toISOString() ?? null,
    timeline,
  }
}
