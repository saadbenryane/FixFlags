import { ProductAdmissionBusy } from '@/lib/billing/product-transaction'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), run: vi.fn(), read: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun: mocks.run, getOwnedRun: mocks.read }))
import { POST } from '../route'
import { GET } from '../[runId]/route'
const context = { params: Promise.resolve({ siteId: 'site' }) }
const request = (body: unknown, key = 'category-request') => new NextRequest('http://localhost/api/sites/site/runs', {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body),
})

describe('Site run result route', () => {
  const context = { params: Promise.resolve({ siteId: 'site-alias', runId: 'run' }) }
  const request = () => new NextRequest('http://localhost/api/sites/site-alias/runs/run')
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue({ user: { id: 'owner' } })
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { projectId: 'canonical-project' } } })
    mocks.read.mockResolvedValue({ id: 'run', result: 'COULD_NOT_VERIFY' })
  })
  it('retains the canonical Site identity in the shared run read', async () => {
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(mocks.read).toHaveBeenCalledWith('owner', 'run', 'canonical-project')
    expect(await response.json()).toMatchObject({ id: 'run', result: 'COULD_NOT_VERIFY' })
  })
  it.each([
    { role: 'owner', site: { projectId: null } }, { role: 'visitor', site: { projectId: 'canonical-project' } },
  ])('refuses a viewer without the owned Project: %j', async decision => {
    mocks.access.mockResolvedValue({ ok: true, decision })
    expect((await GET(request(), context)).status).toBe(404)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('keeps missing, revoked and unauthenticated results unavailable', async () => {
    mocks.read.mockResolvedValue(null)
    expect((await GET(request(), context)).status).toBe(404)
    mocks.read.mockRejectedValue(new SiteRunRefusal('Site not found', 404))
    expect((await GET(request(), context)).status).toBe(404)
    mocks.session.mockResolvedValue(null)
    expect((await GET(request(), context)).status).toBe(401)
    expect(mocks.read).toHaveBeenCalledTimes(2)
  })
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
