import { describe, it, vi, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), update: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const canonicalProductHost = vi.hoisted(() => vi.fn())
const removeSite = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}))
vi.mock('@/lib/audit/product-intelligence', () => ({
  canonicalProductHost,
}))
vi.mock('@/lib/sites/application/settings-commands', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/sites/application/settings-commands')>(), removeSite,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
}))

import { PATCH, DELETE } from '@/app/api/projects/[id]/route'

function jsonReq(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/projects/p1', { method: 'PATCH', body: JSON.stringify(body) })
}

function voidReq() {
  return new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE' })
}

describe('PATCH /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    canonicalProductHost.mockReturnValue('example.com')
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      canonicalHost: 'example.com',
      name: 'My Project',
      url: 'https://example.com',
    })
  })

  it('returns 401 when not signed in', async () => {
    getSession.mockResolvedValue(null)
    const res = await PATCH(jsonReq({ name: 'New Name' }), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    const res = await PATCH(jsonReq({ name: '' }), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)
    const res = await PATCH(jsonReq({ name: 'New Name' }), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 and updates the project name', async () => {
    prismaMock.project.update.mockResolvedValue({ id: 'p1', name: 'New Name' })
    const res = await PATCH(jsonReq({ name: 'New Name' }), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    await res.json()
    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', userId: 'u1', deletedAt: null, canonicalHost: 'example.com' },
        data: expect.objectContaining({ name: 'New Name' }) })
    )
  })

  it('preserves the configured origin on URL edits', async () => {
    prismaMock.project.update.mockResolvedValue({ id: 'p1' })
    expect((await PATCH(jsonReq({ url: 'http://example.com:8080/pricing' }), { params: Promise.resolve({ id: 'p1' }) })).status).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith(expect.objectContaining({ data: { url: 'http://example.com:8080' } }))
  })

  it.each([{ name: '   ' }, { url: 'ftp://example.com' }, { url: 'https://secret@example.com' }])('rejects an unusable identity edit %j', async body => {
    expect((await PATCH(jsonReq(body), { params: Promise.resolve({ id: 'p1' }) })).status).toBe(400)
    expect(prismaMock.project.update).not.toHaveBeenCalled()
  })

  it('returns 409 when trying to change the hostname', async () => {
    canonicalProductHost.mockReturnValue('other.com')
    const res = await PATCH(jsonReq({ url: 'https://other.com' }), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    removeSite.mockResolvedValue({ ok: true })
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      canonicalHost: 'example.com',
    })
  })

  it('returns 401 when not signed in', async () => {
    getSession.mockResolvedValue(null)
    const res = await DELETE(voidReq(), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when removal no longer has ownership', async () => {
    removeSite.mockRejectedValueOnce(new SiteRunRefusal('Site not found.', 404))
    const res = await DELETE(voidReq(), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('delegates removal to the shared Site lifecycle command', async () => {
    const res = await DELETE(voidReq(), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(removeSite).toHaveBeenCalledWith({ projectId: 'p1', userId: 'u1' }, {})
    expect(prismaMock.project.update).not.toHaveBeenCalled()
  })

  it('does not bypass account acknowledgement or accept stale account state', async () => {
    removeSite.mockRejectedValueOnce(new SiteRunRefusal('Review the remaining test accounts before removing this website.', 409, 'TEST_ACCOUNTS_REMAIN'))
    const response = await DELETE(voidReq(), { params: Promise.resolve({ id: 'p1' }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'TEST_ACCOUNTS_REMAIN' })
    expect(prismaMock.project.update).not.toHaveBeenCalled()
  })

  it('rejects malformed removal options before the domain command', async () => {
    const req = new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE', body: '{' })
    expect((await DELETE(req, { params: Promise.resolve({ id: 'p1' }) })).status).toBe(400)
    expect(removeSite).not.toHaveBeenCalled()
  })
})
