import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'
const mocks = vi.hoisted(() => ({ access: vi.fn(), flag: vi.fn(), verification: vi.fn(), after: vi.fn(), read: vi.fn() }))
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: (callback: () => Promise<unknown>) => mocks.after(callback) }))
vi.mock('@/lib/analytics/site-evidence-read', () => ({ recordSiteEvidenceRead: mocks.read }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.access }))
vi.mock('@/lib/sites/application/queries', () => ({ loadSiteBoardFlag: mocks.flag }))
vi.mock('@/lib/sites/application/flag-verification-state', () => ({ loadSiteFlagVerification: mocks.verification }))
const context = { params: Promise.resolve({ siteId: 'visitor', flagId: 'flag-1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue(undefined)
  mocks.after.mockImplementation(callback => { void callback() })
  // requireSiteOwner refuses the visitor who started the check until signup.
  mocks.access.mockResolvedValue({ ok: false, status: 401, message: 'Sign in required' })
  mocks.flag.mockResolvedValue({ site: { userId: 'private-user' }, flag: {
    id: 'flag-1', sourceAuditId: 'audit', problem: 'Problem', evidence: 'Observation', evidenceMissing: false,
    checkId: null,
    whyItMatters: 'Reason', expectedBehavior: 'Expected', fix: 'Guidance', repairGuidance: 'ready',
    pageUrl: 'https://example.com/', affectedPaths: ['https://example.com/'], viewport: 'mobile',
    verifying: false, status: 'OPEN', attempts: [{ privateReference: 'not-exposed' }],
    verificationFeedback: { result: 'still_open', checkedAt: '2026-11-03T00:00:00.000Z', privateReference: 'not-exposed' },
  }, capture: null })
})
describe('dashboard Flag evidence access', () => {
  it('records the authorized evidence read after returning the payload, independently of telemetry failure', async () => {
    const callbacks: Array<() => Promise<unknown>> = []
    mocks.after.mockImplementation(callback => callbacks.push(callback))
    mocks.read.mockRejectedValue(new Error('Telemetry unavailable'))
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { siteId: 'resolved', projectId: 'project', userId: 'owner' } } })
    const response = await GET(new Request('https://fixflags.com'), context)
    expect(response.status).toBe(200)
    expect(mocks.read).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)
    await expect(callbacks[0]()).resolves.toBeUndefined()
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project', userId: 'owner', flagId: 'flag-1', auditId: 'audit' }))
  })
  it('returns only the exact repair activity to the resolved owner', async () => {
    const request = new Request('https://fixflags.com/?verification=check-1')
    expect((await GET(request, context)).status).toBe(401)
    expect(mocks.verification).not.toHaveBeenCalled()
    const site = { siteId: 'resolved-site', projectId: 'resolved-project' }
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site } })
    mocks.verification.mockResolvedValueOnce(null).mockResolvedValueOnce({ auditId: 'check-1', verifying: true, feedback: { private: 'details' } })
    expect((await GET(request, context)).status).toBe(404)
    const response = await GET(request, context)
    expect(mocks.verification).toHaveBeenCalledWith(site, 'flag-1', 'check-1')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ auditId: 'check-1', verifying: true })
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('refuses unrelated visitors before reading evidence', async () => {
    mocks.access.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    expect((await GET(new Request('https://fixflags.com'), context)).status).toBe(404)
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('asks the visitor who started the check to sign in before reading any evidence', async () => {
    const response = await GET(new Request('https://fixflags.com'), context)
    expect(response.status).toBe(401)
    expect(mocks.flag).not.toHaveBeenCalled()
    expect(JSON.stringify(await response.json())).not.toContain('Observation')
  })
  it('includes repair guidance only for the resolved owner', async () => {
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { siteId: 'resolved-site' } } })
    const response = await GET(new Request('https://fixflags.com'), context)
    const body = await response.json()
    expect(body.flag.fix).toBe('Guidance')
    expect(body.flag.repairGuidance).toBe('ready')
    expect(body.flag.verificationFeedback).toEqual({ result: 'still_open', checkedAt: '2026-11-03T00:00:00.000Z' })
    expect(body.flag.evidence).toBe('Observation')
    expect(body.site).toBeUndefined()
    expect(body.flag.attempts).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('not-exposed')
    expect(JSON.stringify(body)).not.toContain('private-user')
  })
})
