import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), admission: vi.fn(), run: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.owner }))
vi.mock('@/lib/sites/accounts/store', () => ({ accountAdmission: mocks.admission }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun: mocks.run }))
import { POST } from '../route'
const context = { params: Promise.resolve({ siteId: 'site' }) }
const request = (body: object, key = 'request-1') => new Request('https://fixflags.example/api/sites/site/account-checks', { method: 'POST', body: JSON.stringify(body), headers: key ? { 'Idempotency-Key': key } : {} })
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue({ ok: true, projectId: 'project', decision: { site: { userId: 'owner' } } });
  mocks.admission.mockResolvedValue({ revision: 1 }); mocks.run.mockResolvedValue({ runId: 'run', auditId: 'audit', outcomeIds: [], reused: false }) })
describe('explicit account checks', () => {
  it('creates a bounded account-only intent with the request identity', async () => {
    expect((await POST(request({ action: 'retest' }), context)).status).toBe(200)
    expect(mocks.run).toHaveBeenCalledWith({ projectId: 'project', userId: 'owner', source: 'WEB', scope: 'ACCOUNT_CHECKS', accountMode: 'retest', outcomeIds: [], idempotencyKey: 'request-1' })
  })
  it('permits explicit cleanup separately from the routine preference', async () => {
    await POST(request({ action: 'cleanup' }), context)
    expect(mocks.admission).toHaveBeenCalledWith('project', 'cleanup')
  })
  it('rejects wrong owners, unavailable execution and missing request identity', async () => {
    mocks.owner.mockResolvedValueOnce({ ok: false, status: 404, message: 'Site not found' })
    expect((await POST(request({ action: 'retest' }), context)).status).toBe(404)
    mocks.admission.mockResolvedValueOnce(undefined)
    expect((await POST(request({ action: 'retest' }), context)).status).toBe(409)
    expect((await POST(request({ action: 'retest' }, ''), context)).status).toBe(400)
    expect(mocks.run).not.toHaveBeenCalled()
  })
})
