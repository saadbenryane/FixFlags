import type { PublicIssueResearch } from '../../public-research'

/** Synthetic aggregate fixture, never publish this dataset. */
export function researchFixture(): PublicIssueResearch {
  return {
    version: 1,
    status: 'approved',
    evidenceRef: 'synthetic-test-evidence',
    permittedUseRef: 'synthetic-test-permission',
    copyReviewRef: 'synthetic-test-copy-review',
    windowStart: '2026-09-01T00:00:00Z',
    windowEnd: '2026-09-30T00:00:00Z',
    reviewedAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-11-01T00:00:00Z',
    sampleSiteCount: 100,
    methodology: 'Synthetic fixture of observed failures, not population prevalence.',
    limitations: ['Synthetic data only. Counts do not establish causation or fix success.'],
    issues: [{
      checkId: 'security-headers-missing',
      checkVersion: 1,
      rubric: 'REACH',
      problemTemplate: 'Security headers are missing',
      fixTemplate: 'Review the relevant security header configuration.',
      siteCount: 25,
      occurrenceCount: 42,
      topFrameworks: [{ name: 'Next.js', siteCount: 20 }],
    }],
  }
}
