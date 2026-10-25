import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'
const mocks = vi.hoisted(() => ({ access: vi.fn(), flag: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/sites/application/queries', () => ({ loadSiteBoardFlag: mocks.flag }))
const context = { params: Promise.resolve({ siteId: 'visitor', flagId: 'flag-1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ ok: true, decision: { role: 'provisional_session', site: { siteId: 'resolved-site' } } })
  mocks.flag.mockResolvedValue({ site: { userId: 'private-user' }, flag: {
    id: 'flag-1', sourceAuditId: 'audit', problem: 'Problem', evidence: 'Observation', evidenceMissing: false,
    whyItMatters: 'Reason', expectedBehavior: 'Expected', fix: 'Guidance', repairGuidance: 'ready',
    pageUrl: 'https://example.com/', affectedPaths: ['https://example.com/'], viewport: 'mobile',
    verifying: false, status: 'OPEN', attempts: [{ privateReference: 'not-exposed' }],
  }, capture: null })
})
describe('dashboard Flag evidence access', () => {
  it('refuses unrelated visitors before reading evidence', async () => {
    mocks.access.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    expect((await GET(new Request('https://fixflags.com'), context)).status).toBe(404)
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('allows authorized scan visitors and returns only public evidence fields', async () => {
    const response = await GET(new Request('https://fixflags.com'), context)
    expect(response.status).toBe(200)
    expect(mocks.flag).toHaveBeenCalledWith('resolved-site', 'flag-1')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json()
    expect(body.flag.evidence).toBe('Observation')
    expect(body.flag.fix).toBe('')
    expect(body.flag.repairGuidance).toBe('unavailable')
    expect(body.site).toBeUndefined()
    expect(body.flag.attempts).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('private-user')
  })
  it('includes repair guidance only for the resolved owner', async () => {
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { siteId: 'resolved-site' } } })
    const response = await GET(new Request('https://fixflags.com'), context)
    const body = await response.json()
    expect(body.flag.fix).toBe('Guidance')
    expect(body.flag.repairGuidance).toBe('ready')
    expect(body.flag.attempts).toBeUndefined()
  })
})
