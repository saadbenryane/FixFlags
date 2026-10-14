import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mocks } = vi.hoisted(() => ({ mocks: { session: vi.fn(), owner: vi.fn(), load: vi.fn(), save: vi.fn() } }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.owner }))
vi.mock('@/lib/growth/research-consent', () => ({ loadResearchConsent: mocks.load, saveResearchConsent: mocks.save }))
import { GET, PATCH } from '../route'
import { RESEARCH_CONSENT_VERSION } from '@/lib/growth/research-consent-contract'
const context = { params: Promise.resolve({ siteId: 'site' }) }
const request = (body: unknown) => new Request('https://fixflags.example/api/sites/site/research-consent', { method: 'PATCH', body: JSON.stringify(body) })
const view = { enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: null }
describe('owner-only research permission route', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'owner' } }); mocks.owner.mockResolvedValue({ ok: true, projectId: 'project' })
    mocks.load.mockResolvedValue(view); mocks.save.mockResolvedValue(view)
  })
  it('reads only the current owner scope and prevents public caching', async () => {
    const response = await GET(new Request('https://fixflags.example'), context)
    expect(await response.json()).toEqual(view)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.load).toHaveBeenCalledWith({ projectId: 'project', userId: 'owner' })
  })
  it('records an explicit current-policy opt-in and allows a simple withdrawal', async () => {
    await PATCH(request({ enabled: true, policyVersion: RESEARCH_CONSENT_VERSION }), context)
    expect(mocks.save).toHaveBeenCalledWith({ projectId: 'project', userId: 'owner' }, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
    await PATCH(request({ enabled: false }), context)
    expect(mocks.save).toHaveBeenLastCalledWith({ projectId: 'project', userId: 'owner' }, { enabled: false })
  })
  it('rejects anonymous and provisional callers without reading or changing permission', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await PATCH(request({ enabled: false }), context)).status).toBe(401)
    mocks.session.mockResolvedValue({ user: { id: 'owner' } })
    mocks.owner.mockResolvedValue({ ok: false, status: 403, message: 'Claim this Site first.' })
    expect((await GET(new Request('https://fixflags.example'), context)).status).toBe(403)
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects forged authority, stale wording, and nonboolean choices', async () => {
    for (const body of [{ enabled: true }, { enabled: true, policyVersion: 'old' }, { enabled: 'yes' },
      { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, userId: 'other' }, { enabled: false, projectId: 'other' }]) {
      expect((await PATCH(request(body), context)).status).toBe(400)
    }
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
