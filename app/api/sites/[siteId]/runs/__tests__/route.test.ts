import { ProductAdmissionBusy } from '@/lib/billing/product-transaction'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), run: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun: mocks.run }))
import { POST } from '../route'
const context = { params: Promise.resolve({ siteId: 'site' }) }
const request = (body: unknown, key = 'category-request') => new NextRequest('http://localhost/api/sites/site/runs', {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body),
})
describe('Site category run admission route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue({ user: { id: 'owner' } })
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { projectId: 'project' } } })
    mocks.run.mockResolvedValue({ runId: 'run', auditId: 'audit', outcomeIds: [], reused: false })
  })
  it.each(['search', 'performance', 'conversion', 'security', 'tracking', 'accessibility'])('admits a fresh %s check through the shared command', async area => {
    expect((await POST(request({ scope: 'category', area }), context)).status).toBe(202)
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project', userId: 'owner', scope: 'CATEGORY', categoryArea: area,
      outcomeIds: [], idempotencyKey: 'category-request', source: 'WEB' }))
  })
  it.each([{ scope: 'category' }, { scope: 'category', area: 'site' }, { scope: 'category', area: 'uptime' },
    { scope: 'site', area: 'search' }, { scope: 'category', area: 'search', outcomeIds: ['other'] },
    { scope: 'site', areas: ['search'] }])('refuses ambiguous or unsupported scope: %j', async body => {
    expect((await POST(request(body), context)).status).toBe(400)
    expect(mocks.run).not.toHaveBeenCalled()
  })
  it('enforces owner access before admission', async () => {
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'visitor', site: { projectId: 'project' } } })
    expect((await POST(request({ scope: 'category', area: 'search' }), context)).status).toBe(403)
    expect(mocks.run).not.toHaveBeenCalled()
    mocks.session.mockResolvedValue(null)
    expect((await POST(request({ scope: 'category', area: 'search' }), context)).status).toBe(401)
  })
  it('reports exhausted admission contention as retryable without claiming an admitted run', async () => {
    mocks.run.mockRejectedValue(new ProductAdmissionBusy(new Prisma.PrismaClientKnownRequestError('Serialization conflict', { code: 'P2034', clientVersion: 'test' })))
    const response = await POST(request({ scope: 'site' }), context)
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('1')
    const body = await response.json()
    expect(body).toMatchObject({ code: 'ADMISSION_BUSY', action: 'retry' })
    expect(body.runId).toBeUndefined()
    expect(body.auditId).toBeUndefined()
  })

})
