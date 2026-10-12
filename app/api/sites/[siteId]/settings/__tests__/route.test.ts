import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), update: vi.fn(), removeDeleted: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: db.session } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: db.access }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run({ project: { updateMany: db.update }, siteTestAccount: { deleteMany: db.removeDeleted }, siteAccountMessage: { deleteMany: vi.fn() } }) } }))
import { PATCH } from '../route'
const context = { params: Promise.resolve({ siteId: 'site' }) }
const request = (body: object) => new Request('https://fixflags.example/api/sites/site/settings', { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); db.session.mockResolvedValue({ user: { id: 'owner' } });
  db.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { projectId: 'project' } } }); db.update.mockResolvedValue({ count: 1 }) })
describe('owner account-check preferences', () => {
  it('preserves the legacy notification request and response', async () => {
    const body = { notificationLevel: 'FLAGS', notifyOnRecovery: true }
    const response = await PATCH(request(body), context)
    expect(await response.json()).toEqual({ ok: true, ...body })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ data: body }))
  })
  it('invalidates queued execution revisions on opt-out', async () => {
    const response = await PATCH(request({ accountChecksEnabled: false }), context)
    expect(await response.json()).toEqual({ ok: true, accountChecksEnabled: false })
    expect(db.update).toHaveBeenCalledWith({ where: { id: 'project', userId: 'owner', deletedAt: null },
      data: { accountChecksEnabled: false, accountCheckRevision: { increment: 1 } } })
    expect(db.removeDeleted).not.toHaveBeenCalled()
  })
  it('only releases a deleted retained slot when the owner explicitly enables checks', async () => {
    await PATCH(request({ accountChecksEnabled: true }), context)
    expect(db.removeDeleted).toHaveBeenCalledWith({ where: { projectId: 'project', state: 'DELETED', purpose: 'retained' } })
  })
  it('rejects anonymous callers, nonowners and malformed writes', async () => {
    db.session.mockResolvedValueOnce(null)
    expect((await PATCH(request({ accountChecksEnabled: true }), context)).status).toBe(401)
    db.access.mockResolvedValueOnce({ ok: true, decision: { role: 'provisional_session', site: { projectId: 'project' } } })
    expect((await PATCH(request({ accountChecksEnabled: true }), context)).status).toBe(403)
    for (const body of [{}, { accountChecksEnabled: 'yes' }, { accountChecksEnabled: true, projectId: 'other' }])
      expect((await PATCH(request(body), context)).status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})
