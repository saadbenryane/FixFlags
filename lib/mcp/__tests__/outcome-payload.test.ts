import { describe, expect, it } from 'vitest'
import type { SiteOutcomeDetailView } from '@/lib/sites/outcomes'
import { mcpOutcomePayload } from '@/lib/mcp/outcome-payload'

function outcome(overrides: Partial<SiteOutcomeDetailView> = {}): SiteOutcomeDetailView {
  return {
    id: 'outcome-1',
    name: 'Signup works',
    slug: 'signup-works',
    description: null,
    inferenceSource: 'user',
    confirmedAt: '2026-10-06T20:00:00.000Z',
    pageIds: [],
    pageUrls: ['https://example.com/signup'],
    kind: 'SIGNUP',
    criticality: 'CRITICAL',
    environment: 'production',
    enabled: true,
    staleAfterMinutes: 2_160,
    expectation: 'A person can complete the form.',
    coverage: { requiredBindings: ['signup-safe-form-v1'], observedBindings: [] },
    state: 'COULD_NOT_VERIFY',
    summary: 'FixFlags could not safely reset the test account.',
    lastVerifiedAt: '2026-10-06T21:00:00.000Z',
    validUntil: '2026-10-06T21:00:00.000Z',
    flagId: null,
    latestRunId: 'run-1',
    running: false,
    bindings: [
      {
        key: 'signup-safe-form-v1',
        required: true,
        scope: { fixtureId: 'fixture-secret-id' },
        mechanism: 'SAFE_FORM',
        version: 3,
        latestEvidence: {
          disposition: 'BLOCKED',
          reason: 'reset_secret_bearer_token',
          detail: { encryptedValues: 'must-not-leak' },
          createdAt: '2026-10-06T21:00:00.000Z',
          auditId: 'audit-1',
        },
        customerSentence: 'FixFlags could not reset the synthetic account before submitting the form.',
      },
    ],
    limitation: 'The safe reset step did not finish.',
    recoveryAction: 'Check the reset hook, then run the fixture dry run again.',
    lastSuccessfulVerificationAt: '2026-10-05T20:00:00.000Z',
    timeline: [],
    ...overrides,
  }
}

describe('mcpOutcomePayload', () => {
  it('adds freshness, customer evidence, limitation, and recovery without raw fixture detail', () => {
    const payload = mcpOutcomePayload(outcome())

    expect(payload).toMatchObject({
      outcomeId: 'outcome-1',
      kind: 'SIGNUP',
      criticality: 'CRITICAL',
      expectedResult: 'A person can complete the form.',
      state: 'COULD_NOT_VERIFY',
      freshness: {
        status: 'INCONCLUSIVE',
        assessedAt: '2026-10-06T21:00:00.000Z',
        validUntil: '2026-10-06T21:00:00.000Z',
        lastSuccessfulVerificationAt: '2026-10-05T20:00:00.000Z',
      },
      limitation: 'The safe reset step did not finish.',
      recoveryAction: 'Check the reset hook, then run the fixture dry run again.',
      methods: [{
        key: 'signup-safe-form-v1',
        evidenceSummary: 'FixFlags could not reset the synthetic account before submitting the form.',
        evidence: {
          disposition: 'BLOCKED',
          observedAt: '2026-10-06T21:00:00.000Z',
          auditId: 'audit-1',
        },
      }],
    })
    expect(JSON.stringify(payload)).not.toContain('fixture-secret-id')
    expect(JSON.stringify(payload)).not.toContain('reset_secret_bearer_token')
    expect(JSON.stringify(payload)).not.toContain('must-not-leak')
  })

  it('distinguishes stale and never-assessed Outcomes', () => {
    expect(mcpOutcomePayload(outcome({ state: 'STALE' })).freshness.status).toBe('STALE')
    expect(mcpOutcomePayload(outcome({ state: 'CLEAR' })).freshness.status).toBe('CURRENT')
    expect(mcpOutcomePayload(outcome({
      state: 'COULD_NOT_VERIFY',
      lastVerifiedAt: null,
      validUntil: null,
      lastSuccessfulVerificationAt: null,
    })).freshness.status).toBe('UNVERIFIED')
  })
})
