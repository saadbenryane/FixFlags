import type { SiteOutcomeDetailView } from '@/lib/sites/outcomes'

export function mcpOutcomePayload(outcome: SiteOutcomeDetailView) {
  return {
    outcomeId: outcome.id,
    name: outcome.name,
    kind: outcome.kind,
    criticality: outcome.criticality,
    expectedResult: outcome.expectation,
    state: outcome.state,
    summary: outcome.summary,
    enabled: outcome.enabled,
    environment: outcome.environment,
    coverage: outcome.coverage,
    freshness: {
      status: !outcome.lastVerifiedAt
        ? 'UNVERIFIED'
        : outcome.state === 'STALE'
          ? 'STALE'
          : outcome.state === 'COULD_NOT_VERIFY'
            ? 'INCONCLUSIVE'
            : 'CURRENT',
      assessedAt: outcome.lastVerifiedAt,
      validUntil: outcome.validUntil,
      lastSuccessfulVerificationAt: outcome.lastSuccessfulVerificationAt,
    },
    methods: outcome.bindings.map((binding) => ({
      key: binding.key,
      mechanism: binding.mechanism,
      required: binding.required,
      version: binding.version,
      evidenceSummary: binding.customerSentence,
      evidence: binding.latestEvidence
        ? {
            disposition: binding.latestEvidence.disposition,
            observedAt: binding.latestEvidence.createdAt,
            auditId: binding.latestEvidence.auditId,
          }
        : null,
    })),
    limitation: outcome.limitation,
    recoveryAction: outcome.recoveryAction,
    lastVerifiedAt: outcome.lastVerifiedAt,
    validUntil: outcome.validUntil,
    flagId: outcome.flagId,
    running: outcome.running,
  }
}
