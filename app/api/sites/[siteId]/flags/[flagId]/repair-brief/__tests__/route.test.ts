import { beforeEach, describe, expect, it, vi } from 'vitest'
import { repairFlag, repairObservations } from '@/lib/sites/__tests__/fixtures/repair-brief'

const mocks = vi.hoisted(() => ({ owner: vi.fn(), key: vi.fn(), site: vi.fn(), flag: vi.fn(), evidence: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.owner }))
vi.mock('@/lib/mcp/tools', () => ({ validateApiKey: mocks.key }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.flag }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'https://fixflags.test' }))
vi.mock('@/lib/sites/application/repair-evidence', () => ({ loadSiteRepairEvidence: mocks.evidence }))
import { GET } from '../route'

const site = { siteId: 'site', projectId: 'site', userId: 'owner' }
async function read(headers: HeadersInit = {}, query = '') {
  return GET(new Request(`https://fixflags.test/api/sites/site/flags/original/repair-brief${query}`, { headers }),
    { params: Promise.resolve({ siteId: 'site', flagId: 'original' }) })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.owner.mockResolvedValue({ ok: true, decision: { site } })
  mocks.key.mockResolvedValue({ user: { id: 'owner' }, apiKey: { audience: null, scopes: ['flags:read'] } })
  mocks.site.mockResolvedValue(site)
  mocks.flag.mockResolvedValue(repairFlag())
})
describe('private agent repair context URL', () => {
  it('keeps optional evidence and image bytes behind the same credential and revision boundary', async () => {
    const brief = await (await read()).json()
    const evidence = { sourceAuditId: 'scan', sourceFlagId: 'original', performanceMeasurements: [], capture: { state: 'not_recorded' } }
    mocks.evidence.mockResolvedValue({ evidence, image: null })
    expect(await (await read({ Authorization: 'Bearer test-key' }, new URL(brief.links.evidence).search)).json()).toMatchObject({ evidence })
    expect((await read({}, '?view=capture')).status).toBe(400)
    expect((await read({}, `?contextHash=${brief.contextHash}&view=capture`)).status).toBe(404)
    const png = Buffer.from('controlled native reader bytes')
    mocks.evidence.mockResolvedValue({ evidence: { ...evidence, capture: { state: 'available', sha256: 'a'.repeat(64) } }, image: png })
    const response = await read({ Authorization: 'Bearer test-key' }, `?contextHash=${brief.contextHash}&view=capture`)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
    mocks.evidence.mockClear()
    mocks.key.mockResolvedValue(null)
    expect((await read({ Authorization: 'Bearer invalid' }, `?contextHash=${brief.contextHash}&view=capture`)).status).toBe(401)
    expect(mocks.evidence).not.toHaveBeenCalled()
  })
  it('continues grouped evidence only with the pinned revision', async () => {
    mocks.flag.mockResolvedValue(repairFlag({ supportingObservations: repairObservations(65) }))
    const first = await (await read()).json()
    expect((await read({}, '?observationOffset=25')).status).toBe(400)
    const next = await read({}, new URL(first.links.next).search)
    expect(next.status).toBe(200)
    expect(await next.json()).toMatchObject({ contextHash: first.contextHash,
      observationPage: { offset: 25, returned: 25, total: 65, nextOffset: 50, complete: false } })
    mocks.flag.mockResolvedValue(repairFlag())
    expect((await read({}, new URL(first.links.next).search)).status).toBe(409)
  })
  it('serves the same brief to the owner session and a read-only developer key', async () => {
    const owner = await read(), key = await read({ Authorization: 'Bearer test-key' })
    expect(owner.status).toBe(200)
    expect(await key.json()).toEqual(await owner.json())
    expect(mocks.flag).toHaveBeenCalledWith(site, 'original')
    expect(mocks.key).toHaveBeenCalledWith('test-key')
    expect(key.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('does not treat knowing a URL as authorization', async () => {
    mocks.owner.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    const result = await read()
    expect(result.status).toBe(404)
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it.each([null, undefined])('rejects invalid, expired or revoked credentials without borrowing the owner session', async invalid => {
    mocks.key.mockResolvedValue(invalid)
    expect((await read({ Authorization: 'Bearer invalid' })).status).toBe(401)
    expect(mocks.owner).not.toHaveBeenCalled()
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it.each([
    { Authorization: 'Basic secret' },
    { Authorization: 'Bearer one', 'x-api-key': 'two' },
  ])('rejects malformed or conflicting credentials: %j', async headers => {
    expect((await read(headers)).status).toBe(401)
    expect(mocks.key).not.toHaveBeenCalled()
    expect(mocks.owner).not.toHaveBeenCalled()
  })
  it('rejects an MCP OAuth audience and insufficient scope before reading a Site', async () => {
    mocks.key.mockResolvedValueOnce({ user: { id: 'owner' }, apiKey: { audience: 'https://fixflags.test/api/mcp', scopes: ['flags:read'] } })
      .mockResolvedValueOnce({ user: { id: 'owner' }, apiKey: { audience: null, scopes: ['sites:read'] } })
    expect((await read({ Authorization: 'Bearer oauth' })).status).toBe(403)
    expect((await read({ Authorization: 'Bearer scoped' })).status).toBe(403)
    expect(mocks.site).not.toHaveBeenCalled()
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('refuses another tenant and absent Flags without exposing evidence', async () => {
    mocks.site.mockResolvedValueOnce({ ...site, userId: 'other' })
    expect((await read({ Authorization: 'Bearer test-key' })).status).toBe(404)
    expect(mocks.flag).not.toHaveBeenCalled()
    mocks.flag.mockResolvedValueOnce(null)
    expect((await read()).status).toBe(404)
  })
  it('honors the copied revision and refuses changed evidence instead of sending a different task', async () => {
    const brief = await (await read()).json()
    expect((await read({}, `?contextHash=${brief.contextHash}`)).status).toBe(200)
    mocks.flag.mockResolvedValue(repairFlag({ sourceAuditId: 'new-scan' }))
    const changed = await read({}, `?contextHash=${brief.contextHash}`)
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({ code: 'REPAIR_CONTEXT_CHANGED', action: 'prepare_new_prompt' })
    expect((await read({}, '?contextHash=wrong')).status).toBe(400)
  })
  it('returns unavailable guidance explicitly and keeps dependency errors private and uncacheable', async () => {
    mocks.flag.mockResolvedValueOnce(repairFlag({ fix: '', repairGuidance: 'pending' }))
    expect(await (await read()).json()).toMatchObject({ repair: { readiness: 'ready', definition: { kind: 'investigation' } } })
    mocks.flag.mockRejectedValueOnce(new Error('secret database detail'))
    const failed = await read()
    expect(failed.status).toBe(500)
    expect(failed.headers.get('Cache-Control')).toBe('private, no-store')
    expect(JSON.stringify(await failed.json())).not.toContain('secret database detail')
  })
})
