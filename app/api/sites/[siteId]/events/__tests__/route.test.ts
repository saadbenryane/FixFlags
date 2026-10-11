import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ access: vi.fn(), events: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/sites/application/execution-progress', async () => ({
  ...await vi.importActual('@/lib/sites/application/execution-progress'), readSiteEvents: mocks.events,
}))
import { GET } from '../route'
import { encodeEventCursor } from '@/lib/sites/application/execution-progress'

const site = { siteId: 'site-one', projectId: 'project-one' }
const context = { params: Promise.resolve({ siteId: site.siteId }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ ok: true, decision: { site, role: 'owner' } })
  mocks.events.mockResolvedValue([])
})
describe('private Site event transport', () => {
  it('denies anonymous and cross-tenant viewers without reading events', async () => {
    mocks.access.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    expect((await GET(new Request('https://fixflags.example/api/sites/site-one/events'), context)).status).toBe(404)
    expect(mocks.events).not.toHaveBeenCalled()
  })
  it('rejects a cursor issued for another Site', async () => {
    const cursor = encodeEventCursor('site-other', BigInt(10))
    expect((await GET(new Request('https://fixflags.example/api/sites/site-one/events?after=' + cursor), context)).status).toBe(400)
    expect(mocks.events).not.toHaveBeenCalled()
  })
  it('replays committed notices and never streams raw artifacts', async () => {
    const controller = new AbortController(), cursor = encodeEventCursor(site.siteId, BigInt(8))
    mocks.events.mockResolvedValue([{ sequence: BigInt(9), auditId: 'audit-one', detail: {
      version: 1, kind: 'http', state: 'COMPLETED', taskId: 'task-one', observationReference: 'receipt-one',
    } }, { sequence: BigInt(10), auditId: 'audit-one', detail: { rawHtml: 'PRIVATE ARTIFACT', secret: 'PRIVATE SECRET' } }])
    const response = await GET(new Request('https://fixflags.example/api/sites/site-one/events', {
      signal: controller.signal, headers: { 'last-event-id': cursor },
    }), context)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    const reader = response.body!.getReader(), notice = new TextDecoder().decode((await reader.read()).value)
    expect(notice).toContain('event: projection')
    expect(notice).toContain('receipt-one')
    expect(notice).not.toContain('PRIVATE')
    expect(mocks.events).toHaveBeenCalledWith(site, BigInt(8))
    controller.abort(); await reader.cancel()
  })
  it('closes a connection when its viewer loses access', async () => {
    mocks.access.mockResolvedValueOnce({ ok: true, decision: { site, role: 'owner' } })
      .mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    const response = await GET(new Request('https://fixflags.example/api/sites/site-one/events'), context)
    expect(await response.text()).toContain('event: access-expired')
    expect(mocks.events).not.toHaveBeenCalled()
  })
})
