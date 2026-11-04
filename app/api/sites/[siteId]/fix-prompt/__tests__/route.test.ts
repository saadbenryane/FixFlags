import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
const mocks = vi.hoisted(() => ({ access: vi.fn(), bundle: vi.fn(), file: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.access }))
vi.mock('@/lib/sites/application/fix-bundle', () => ({ loadSiteFixBundle: mocks.bundle }))
vi.mock('@/lib/sites/application/repair-file', async original => ({ ...await original<typeof import('@/lib/sites/application/repair-file')>(), prepareSiteRepairFile: mocks.file }))
const context = { params: Promise.resolve({ siteId: 'visitor-link' }) }
const request = (body: unknown) => new Request('https://fixflags.com/api/sites/visitor-link/fix-prompt', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ ok: true, decision: { site: { siteId: 'resolved-owner-site' } } })
  mocks.bundle.mockResolvedValue({ prompt: 'Canonical task', tasks: [{ sourceFlagId: 'f', promptHash: 'a'.repeat(64) }] })
})
describe('repair bundle authorization', () => {
  it('delivers a private complete file only for a pinned owned scope and rechecks reader authority', async () => {
    mocks.file.mockResolvedValue((async function* () { yield new TextEncoder().encode('{"complete":true}') })())
    const scope = { kind: 'flag', flagId: 'original', expectedPromptHash: 'a'.repeat(64) }
    const response = await POST(new Request('https://fixflags.com/api/sites/visitor-link/fix-prompt?view=file',
      { method: 'POST', body: JSON.stringify(scope) }), context)
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="fixflags-repairs.json"')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(await response.json()).toEqual({ complete: true })
    expect(mocks.file.mock.calls[0][0]).toEqual({ siteId: 'resolved-owner-site' })
    expect(mocks.file.mock.calls[0][1]).toEqual(scope)
    const authorize = mocks.file.mock.calls[0][3]
    await expect(authorize()).resolves.toBeUndefined()
    mocks.access.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
    await expect(authorize()).rejects.toMatchObject({ status: 404 })
  })
  it('rejects an unpinned file scope or denied owner before any file read', async () => {
    const readFile = (body: unknown) => POST(new Request('https://fixflags.com/api/sites/visitor-link/fix-prompt?view=file',
      { method: 'POST', body: JSON.stringify(body) }), context)
    expect((await readFile({ kind: 'flag', flagId: 'original' })).status).toBe(400)
    mocks.access.mockResolvedValue({ ok: false, status: 401, message: 'Sign in required' })
    expect((await readFile({ kind: 'bundle', manifestHash: 'a'.repeat(64) })).status).toBe(401)
    expect(mocks.file).not.toHaveBeenCalled()
  })
  it('validates explicit selections before preparing owner tasks', async () => {
    expect((await POST(request({ flagIds: ['one', 'two'] }), context)).status).toBe(200)
    expect(mocks.bundle).toHaveBeenCalledWith({ siteId: 'resolved-owner-site' }, undefined, ['one', 'two'], { offset: 0, manifestHash: undefined })
    mocks.bundle.mockClear()
    for (const flagIds of [[], ['one', 'one'], Array.from({ length: 101 }, (_, i) => String(i))])
      expect((await POST(request({ flagIds }), context)).status).toBe(400)
    expect(mocks.bundle).not.toHaveBeenCalled()
  })
  it.each([401,403,404])('does not load tasks when ownership is refused (%s)', async status => {
    mocks.access.mockResolvedValue({ ok: false, status, message: 'Site access refused' })
    const response = await POST(request({}), context)
    expect(response.status).toBe(status)
    expect(mocks.bundle).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie, Authorization')
  })
  it('uses the resolved owned Site, validates scope, and prohibits caching', async () => {
    const response = await POST(request({ area: 'performance' }), context)
    expect(response.status).toBe(200)
    expect(mocks.bundle).toHaveBeenCalledWith({ siteId: 'resolved-owner-site' }, 'performance', undefined, { offset: 0, manifestHash: undefined })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await response.json()).tasks).toHaveLength(1)
    expect((await POST(request({ area: 'unknown' }), context)).status).toBe(400)
    expect((await POST(request({ siteId: 'other-owner' }), context)).status).toBe(400)
  })
})
