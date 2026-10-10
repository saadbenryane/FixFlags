import { beforeEach, expect, it, vi } from 'vitest'
import type { SiteRecord } from '../types'
const mocks = vi.hoisted(() => ({ flag: vi.fn(), attempts: vi.fn(), occurrences: vi.fn(), outcome: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: {
  flag: { findFirst: mocks.flag }, improvementAttempt: { findMany: mocks.attempts },
  improvementOccurrence: { findMany: mocks.occurrences }, siteOutcome: { findFirst: mocks.outcome },
} }))
import { loadSiteFlagDetail } from '../flags'
const site = { siteId: 'site-1', projectId: 'project-1' } as SiteRecord
beforeEach(() => {
  vi.resetAllMocks()
  mocks.flag.mockResolvedValue({ id: 'captured-flag', auditId: 'audit-1', checkId: 'journey-checkout-failed-http_error', rubric: 'EXPERIENCE', severity: 'CRITICAL', impactTag: 'REVENUE', problem: 'Checkout is unavailable', evidence: 'Two failed checks', whyItMatters: 'Checkout cannot open', fix: 'Restore checkout', pageUrl: 'https://shop.test/checkout', status: 'OPEN', resolvedInId: null, confidence: 0.95, improvementOccurrence: { improvement: { id: 'improvement-1', status: 'PROPOSED', outcomeId: 'outcome-1' } } })
  mocks.attempts.mockResolvedValue([]); mocks.occurrences.mockResolvedValue([])
  mocks.outcome.mockResolvedValue({ id: 'outcome-1', name: 'Checkout', expectation: 'A customer can reach checkout from the product page.' })
})
it('preserves the captured Flag identity while projecting its durable Improvement', async () => {
  const detail = await loadSiteFlagDetail(site, 'improvement-1')
  expect(detail).toMatchObject({ id: 'improvement-1', sourceFlagId: 'captured-flag', sourceAuditId: 'audit-1', confidence: 0.95 })
})
it('shows only the recorded expectation from the same owned Site', async () => {
  const detail = await loadSiteFlagDetail(site, 'improvement-1')
  expect(mocks.outcome).toHaveBeenCalledWith({ where: { id: 'outcome-1', projectId: 'project-1' }, select: { id: true, name: true, expectation: true } })
  expect(detail?.expectedBehavior).toBe('A customer can reach checkout from the product page.')
  expect(detail?.relatedOutcome).toEqual({ id: 'outcome-1', name: 'Checkout' })
})
