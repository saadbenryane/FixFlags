import { describe, expect, it } from 'vitest'
import { projectHistory } from '../monitoring-history'

const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
  bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: 'https://example.com/' } }] }
function row(assessment: unknown) {
  return { id: 'audit', status: 'COMPLETED', failureCode: null, failedModules: [], pages: [], flags: [],
    completedAt: new Date('2026-10-11T12:00:00Z'), updatedAt: new Date(), executionSpec: { scope: 'OUTCOMES' }, recheckTrigger: 'WATCH',
    verificationAttempts: [], runRequests: [{ source: 'WATCH', verificationTarget: null,
      selections: [{ outcome: { name: 'The page loads' } }], assessments: [assessment] }] }
}
describe('scope completion in monitoring history', () => {
  it('shows complete proved uptime despite the absence of broad report pages', () => {
    expect(projectHistory(row({ state: 'CLEAR', coverage, evidence: { reason: 'available' } }) as never, [])).toMatchObject({ completionState: 'COMPLETED', result: 'CLEAR', scope: 'OUTCOMES' })
  })
  it('keeps missing and blocked evidence partial rather than deriving completeness from run completion', () => {
    for (const assessment of [{ state: 'COULD_NOT_VERIFY', coverage, evidence: { reason: 'bot_wall' } },
      { state: 'CLEAR', coverage: { ...coverage, observedBindings: [] }, evidence: { reason: 'available' } }])
      expect(projectHistory(row(assessment) as never, []).completionState).toBe('PARTIAL')
  })
})
