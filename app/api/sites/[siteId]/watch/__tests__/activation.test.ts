import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m = vi.hoisted(() => ({ owner: vi.fn(), activate: vi.fn(), options: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: m.owner, requireSiteAccess: vi.fn() }))
vi.mock('@/lib/sites/application/monitoring-activation', () => ({ activateSiteMonitoring: m.activate, monitoringOptions: m.options }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: vi.fn() }))
vi.mock('@/lib/auth/entitlements', () => ({ allowedWatchIntervals: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }))
import { POST } from '../activate/route'
import { GET } from '../route'
const context = { params: Promise.resolve({ siteId: 'provisional-1' }) }
const req = (body: unknown) => new NextRequest('http://localhost/api/sites/provisional-1/watch/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
describe('owned Site monitoring activation API', () => {
  beforeEach(() => { vi.resetAllMocks(); m.owner.mockResolvedValue({ ok: true, decision: { site: { siteId: 'owned-1', userId: 'owner' } } }); m.options.mockResolvedValue(['weekly']); m.activate.mockResolvedValue({ ok: true, interval: 'weekly', firstCheck: 'requested' }) })
  it('rejects anonymous or unclaimed access before reading options or mutating', async () => {
    m.owner.mockResolvedValue({ ok: false, status: 403, message: 'Claim this Site first.' })
    expect((await POST(req({ interval: 'weekly' }), context)).status).toBe(403)
    expect((await GET(req({}), context)).status).toBe(403)
    expect(m.activate).not.toHaveBeenCalled(); expect(m.options).not.toHaveBeenCalled()
  })
  it('uses the resolved claimed Site and server owner identity', async () => {
    const r = await POST(req({ interval: 'weekly', userId: 'attacker' }), context)
    expect(r.status).toBe(200)
    expect(m.activate).toHaveBeenCalledWith({ siteId: 'owned-1', userId: 'owner', interval: 'weekly' })
  })
  it('passes a custom schedule through activation with the server owner', async () => {
    const r = await POST(req({ interval: 'custom', everyMinutes: 4320, userId: 'attacker' }), context)
    expect(r.status).toBe(200)
    expect(m.activate).toHaveBeenCalledWith({ siteId: 'owned-1', userId: 'owner', interval: 'custom', everyMinutes: 4320 })
  })
  it('rejects unsupported or missing schedules', async () => {
    expect((await POST(req({ interval: 'fortnightly' }), context)).status).toBe(400)
    expect((await POST(req({}), context)).status).toBe(400)
    expect(m.activate).not.toHaveBeenCalled()
  })
  it('does not cache account cadence options', async () => {
    const r = await GET(req({}), context)
    expect(await r.json()).toEqual({ intervals: ['weekly'] }); expect(r.headers.get('Cache-Control')).toBe('private, no-store')
    expect(m.options).toHaveBeenCalledWith('owner')
  })
  it('returns partial first-check failure as a saved schedule, not fake verification', async () => {
    m.activate.mockResolvedValue({ ok: true, interval: 'weekly', firstCheck: 'unavailable' })
    expect(await (await POST(req({ interval: 'weekly' }), context)).json()).toMatchObject({ ok: true, firstCheck: 'unavailable' })
  })
})
