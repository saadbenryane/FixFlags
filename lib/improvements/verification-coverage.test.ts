import { describe, expect, it } from 'vitest'
import { assessVerificationCoverage } from './verification-coverage'

const complete = {
  status: 'COMPLETED',
  reportCompleteness: 'FULL' as const,
  evidenceCoverage: { desktopScreenshot: true, metadata: true, aiAssessment: true },
  failedModules: [],
  journeyReviewIncluded: false,
  journeyReviewAt: null,
  pages: [{ url: 'https://example.com/', status: 'COMPLETED' }],
  source: 'DETERMINISTIC',
  checkId: 'cta-dead-link',
  pageUrl: 'https://example.com',
  verifierExecutions: [{
    targetKey: 'check:cta-dead-link',
    scopeKey: 'page:https://example.com',
    status: 'COMPLETED' as const,
    evidenceReference: { run: 'verification-1' },
  }],
}

describe('assessVerificationCoverage', () => {
  it('accepts only a complete comparable verifier run', () => {
    expect(assessVerificationCoverage(complete)).toMatchObject({ comparable: true })
  })

  it('rejects a partial Review', () => {
    expect(assessVerificationCoverage({ ...complete, reportCompleteness: 'PARTIAL' }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/partial/i) })
  })

  it('rejects failed deterministic modules', () => {
    expect(assessVerificationCoverage({ ...complete, failedModules: ['interaction'] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/interaction/) })
  })

  it('rejects an omitted or unregistered exact verifier', () => {
    expect(assessVerificationCoverage({ ...complete, verifierExecutions: [] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/no positive execution record/i) })
  })

  it('does not allow Product Signals to substitute for verifier execution', () => {
    expect(assessVerificationCoverage({
      ...complete,
      evidenceCoverage: {
        ...complete.evidenceCoverage,
        productSignals: [{ kind: 'OUTCOME', name: 'signup_completed' }],
      },
      verifierExecutions: [],
    })).toMatchObject({ comparable: false })
  })

  it.each(['FAILED', 'NOT_APPLICABLE'] as const)(
    'rejects a target verifier with %s status',
    (status) => {
      expect(assessVerificationCoverage({
        ...complete,
        verifierExecutions: [{ ...complete.verifierExecutions[0], status }],
      })).toMatchObject({ comparable: false })
    },
  )

  it('rejects verifier provenance captured for a different page scope', () => {
    expect(assessVerificationCoverage({
      ...complete,
      verifierExecutions: [{
        ...complete.verifierExecutions[0],
        scopeKey: 'page:https://example.com/pricing',
      }],
    })).toMatchObject({ comparable: false })
  })

  it('rejects an omitted affected page', () => {
    expect(assessVerificationCoverage({ ...complete, pages: [] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/page/) })
  })

  it('requires the AI assessment for AI observations', () => {
    expect(assessVerificationCoverage({
      ...complete,
      source: 'AI',
      checkId: null,
      evidenceCoverage: { desktopScreenshot: true, metadata: true, aiAssessment: false },
      verifierExecutions: [],
    })).toMatchObject({ comparable: false })
  })

  it('requires journey evidence for journey observations', () => {
    expect(assessVerificationCoverage({
      ...complete,
      checkId: 'journey-signup-hidden-cta',
      verifierExecutions: [{
        targetKey: 'check:journey-signup-hidden-cta',
        scopeKey: 'page:https://example.com',
        status: 'COMPLETED',
        evidenceReference: { run: 'journey-verification-1' },
      }],
    })).toMatchObject({ comparable: false, reason: expect.stringMatching(/journey/) })
  })
})
