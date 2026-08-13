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
    })).toMatchObject({ comparable: false })
  })

  it('requires journey evidence for journey observations', () => {
    expect(assessVerificationCoverage({
      ...complete,
      checkId: 'journey-signup-hidden-cta',
    })).toMatchObject({ comparable: false, reason: expect.stringMatching(/journey/) })
  })
})
