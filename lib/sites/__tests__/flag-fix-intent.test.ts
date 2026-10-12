import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ site: vi.fn(), flag: vi.fn(), attempt: vi.fn(), record: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { improvementAttempt: { findFirst: mocks.attempt } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.flag }))
vi.mock('@/lib/improvements/service', () => ({ recordFlagImprovementAttempt: mocks.record }))
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'

describe('Site fix intent identity', () => {
  const input = { siteId: 'site', flagId: 'improvement', userId: 'owner', idempotencyKey: ' repair-key ', changeSummary: 'Declared repair' }
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.site.mockResolvedValue({ siteId: 'site', projectId: 'site', userId: 'owner' })
    mocks.flag.mockResolvedValue({ id: 'improvement', improvementId: 'improvement', sourceFlagId: 'later-flag' })
    mocks.attempt.mockResolvedValue({ handoffReference: 'flag:original-flag' })
    mocks.record.mockResolvedValue({ attemptId: 'attempt', sourceReviewId: 'original-review', commitReference: 'stored-commit',
      deploymentReference: 'stored-deployment', changeSummary: 'Declared repair', verificationAuditId: 'completed-review', outcome: 'IMPROVED' })
  })
  it('replays the original occurrence after the durable Improvement advances', async () => {
    const result = await recordSiteFlagFix(input)
    expect(mocks.attempt).toHaveBeenCalledWith({ where: { improvementId: 'improvement', idempotencyKey: 'repair-key',
      improvement: { projectId: 'site', project: { userId: 'owner' } } } })
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ flagId: 'original-flag', userId: 'owner', idempotencyKey: 'repair-key' }))
    expect(result).toMatchObject({ idempotencyKey: 'repair-key', sourceAuditId: 'original-review', commitReference: 'stored-commit',
      deploymentReference: 'stored-deployment', changeSummary: 'Declared repair', verificationAuditId: 'completed-review', outcome: 'IMPROVED' })
  })
  it('refuses the same key attached to a different raw occurrence', async () => {
    await expect(recordSiteFlagFix({ ...input, flagId: 'later-flag' })).rejects.toMatchObject({ code: 'FIX_INTENT_MISMATCH' })
    expect(mocks.record).not.toHaveBeenCalled()
  })
  it('refuses another owner before reading or recording attempt history', async () => {
    await expect(recordSiteFlagFix({ ...input, userId: 'other-owner' })).rejects.toThrow('Site not found')
    expect(mocks.flag).not.toHaveBeenCalled()
    expect(mocks.attempt).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
  })
})
