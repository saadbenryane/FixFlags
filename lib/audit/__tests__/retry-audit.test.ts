import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), admit: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: mocks.find, update: mocks.update } } }))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.admit,
  ParentAuditError: class extends Error { constructor(message: string, readonly status: number) { super(message) } },
}))
import { retryAudit } from '../retry-audit'
const owner = { userId: 'owner', visitorKey: 'visitor', anonymousAuditIds: [] }
const prior = { id: 'before', status: 'FAILED', url: 'https://example.com/', userId: 'owner', isPublic: false, auditMode: 'CRITICAL_PATH' }
beforeEach(() => { vi.clearAllMocks(); mocks.find.mockResolvedValue(prior); mocks.admit.mockResolvedValue({ auditId: 'after', status: 'QUEUED', siteId: 'site', reused: false }) })
describe('new linked retry admission', () => {
  it('admits fresh work and leaves the terminal execution and all its evidence untouched', async () => {
    expect(await retryAudit('before', owner)).toEqual({ auditId: 'after', status: 'QUEUED', siteId: 'site', reused: false })
    expect(mocks.admit).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'before', retryParent: true,
      url: prior.url, userId: 'owner', skipUsageCount: true, useProjectScanAccess: true }))
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('keeps the anonymous browser identity and records a fresh linked execution', async () => {
    mocks.find.mockResolvedValue({ ...prior, userId: null, auditMode: 'SINGLE' })
    await retryAudit('before', { ...owner, userId: null, anonymousAuditIds: ['before'] })
    expect(mocks.admit).toHaveBeenCalledWith(expect.objectContaining({ userId: null, visitorKey: 'visitor', parentId: 'before', auditMode: 'SINGLE' }))
  })
  it('refuses anonymous retry without its private Site identity even if a historical cookie names the Audit', async () => {
    mocks.find.mockResolvedValue({ ...prior, userId: null })
    await expect(retryAudit('before', { userId: null, visitorKey: '', anonymousAuditIds: ['before'] })).rejects.toMatchObject({ status: 409 })
    expect(mocks.admit).not.toHaveBeenCalled()
  })
  it('refuses another tenant and a stranger without the owning anonymous cookie', async () => {
    await expect(retryAudit('before', { ...owner, userId: 'stranger' })).rejects.toMatchObject({ status: 403 })
    mocks.find.mockResolvedValue({ ...prior, userId: null })
    await expect(retryAudit('before', { userId: null, visitorKey: 'stranger', anonymousAuditIds: [] })).rejects.toMatchObject({ status: 403 })
    expect(mocks.admit).not.toHaveBeenCalled()
  })
  it('does not restart unfinished work or fabricate a queued state for an already admitted replay', async () => {
    mocks.find.mockResolvedValue({ ...prior, status: 'CHECKING' })
    await expect(retryAudit('before', owner)).rejects.toMatchObject({ status: 409 })
    mocks.find.mockResolvedValue(prior)
    mocks.admit.mockResolvedValue({ auditId: 'after', status: 'CHECKING', siteId: 'site', reused: true })
    expect(await retryAudit('before', owner)).toMatchObject({ status: 'CHECKING', reused: true })
  })
})
