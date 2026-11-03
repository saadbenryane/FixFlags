import type { SiteFlagDetail } from '@/lib/sites/flags'
import type { SupportingObservationView } from '@/lib/audit/flag-observations'

export function repairObservations(count: number, text = 'Recorded issue'): SupportingObservationView[] {
  return Array.from({ length: count }, (_, index) => ({ source: 'DETERMINISTIC', checkId: `check-${index}`,
    checkVersion: 1, pageUrl: `https://example.com/page-${index}`, evidence: `${text} ${index}`,
    recordedAt: '2026-10-28T10:00:00.000Z', references: [{ device: 'mobile', label: 'Continue', selector: '#continue' }] }))
}

export function repairFlag(overrides: Partial<SiteFlagDetail> = {}): SiteFlagDetail {
  return {
    id: 'incident', sourceFlagId: 'original', sourceAuditId: 'scan', checkId: 'broken-cta',
    rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: null,
    status: 'OPEN', verificationState: 'still_open', resolvedInId: null,
    problem: 'Continue button does not work', evidence: 'Clicking Continue left the checkout unchanged.',
    whyItMatters: 'Customers cannot continue checkout.', fix: 'Repair the Continue button handler and confirm it advances checkout.',
    pageUrl: 'https://example.com/checkout', affectedPaths: ['https://example.com/checkout', 'https://example.com/cart'],
    affectedPageCount: 2, area: 'conversion', priorityBand: 'other', priorityScore: 70,
    relatedOutcome: { id: 'outcome', name: 'Checkout' }, outcomeId: 'outcome',
    expectedBehavior: 'Continue opens the next checkout step.', verificationRule: 'Click Continue and observe the next step.',
    confidence: 0.95, causeCertainty: 'OBSERVED', viewport: 'mobile', evidenceMissing: false,
    repairGuidance: 'ready', attempts: [], verifying: false,
    evidenceContext: { auditId: 'scan', source: 'DETERMINISTIC', recordedAt: '2026-10-28T10:00:00.000Z',
      references: [{ selector: 'button[type=submit]', label: 'Continue', device: 'mobile' }] },
    ...overrides,
  }
}
