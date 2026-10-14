import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'

const mocks = vi.hoisted(() => ({ audit: vi.fn(), previous: vi.fn(), request: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: mocks.audit }, runRequest: { findFirst: mocks.previous } } }))
vi.mock('../run-requests', () => ({ requestSiteRun: mocks.request }))
import { admittedResponsibilityHash, retryAdmittedRun } from '../run-retry'

const owner = { kind: 'owner' as const, userId: 'owner' }
const targetUrl = 'https://example.com/original'
const category = { version: 1 as const, engine: 'progressive-v1' as const, scope: 'CATEGORY' as const,
  targetUrl, environment: 'production', category: { area: 'search' as const, sourceAuditId: 'inventory', pages: [targetUrl, 'https://example.com/pricing'] },
  checks: { 'title-missing': CHECK_REGISTRY['title-missing'].version }, outcomes: [], verificationTarget: null }
const audit = { id: 'failed', userId: 'owner', projectId: 'site', status: 'FAILED', url: targetUrl, executionSpec: category }
beforeEach(() => {
  vi.resetAllMocks(); mocks.audit.mockResolvedValue(audit)
  mocks.previous.mockResolvedValue({ id: 'previous', executionSpec: category, verificationTarget: null, selections: [] })
  mocks.request.mockResolvedValue({ runId: 'retry', auditId: 'retry-audit', reused: false, outcomeIds: [] })
})

describe('shared admitted-scope retries', () => {
  it('retains a category and all admitted pages instead of starting broad Site care', async () => {
    await retryAdmittedRun('failed', owner)
    expect(mocks.previous).toHaveBeenCalledWith(expect.objectContaining({ where: { auditId: 'failed', projectId: 'site' } }))
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ source: 'WEB', scope: 'CATEGORY', categoryArea: 'search',
      outcomeIds: [], expectedResponsibilityHash: admittedResponsibilityHash(category), idempotencyKey: 'owner-retry:failed' }))
    expect(mocks.request.mock.calls[0][0].url).toBeUndefined()
  })
  it('retains the original diagnostic target, repair attempt and completed source', async () => {
    const target = { kind: 'DIAGNOSTIC' as const, pageUrl: targetUrl, checkId: 'title-missing', attemptId: 'repair', parentAuditId: 'original-failure' }
    const spec = { ...category, category: undefined, scope: 'DIAGNOSTIC' as const, verificationTarget: target }
    mocks.previous.mockResolvedValue({ id: 'previous', executionSpec: spec, verificationTarget: target })
    await retryAdmittedRun('failed', owner)
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scope: 'OUTCOMES', outcomeIds: [], verificationTarget: target,
      verificationAttemptId: 'repair', parentAuditId: 'original-failure', expectedResponsibilityHash: admittedResponsibilityHash(spec) }))
  })
  it('retains the original URL of a broad retry rather than silently using a changed Site entry', async () => {
    const spec = { ...category, category: undefined, scope: 'SITE' }
    mocks.previous.mockResolvedValue({ id: 'previous', executionSpec: spec, verificationTarget: null })
    await retryAdmittedRun('failed', owner)
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scope: 'SITE', url: targetUrl, outcomeIds: [] }))
  })
  it('rejects another owner before reading Site execution history', async () => {
    await expect(retryAdmittedRun('failed', { ...owner, userId: 'stranger' })).rejects.toMatchObject({ status: 403 })
    expect(mocks.previous).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled()
  })
  it('refuses an admitted run whose responsibility snapshot is unavailable', async () => {
    mocks.previous.mockResolvedValue({ id: 'previous', executionSpec: null })
    await expect(retryAdmittedRun('failed', owner)).rejects.toMatchObject({ status: 409, code: 'RETRY_SCOPE_UNAVAILABLE' })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('allows owner AI-degraded retries while keeping operator retry restricted to failures', async () => {
    mocks.audit.mockResolvedValue({ ...audit, status: 'COMPLETED', triageAt: null, failureCode: 'AI_FAILURE' })
    await retryAdmittedRun('failed', owner)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    await expect(retryAdmittedRun('failed', { kind: 'admin', actorId: 'operator', operationId: 'operation' })).rejects.toMatchObject({ status: 409 })
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
})
