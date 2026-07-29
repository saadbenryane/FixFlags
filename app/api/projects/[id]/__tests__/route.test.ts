import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), update: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const canonicalProductHost = vi.hoisted(() => vi.fn())
const canonicalProductUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}))
vi.mock('@/lib/audit/product-intelligence', () => ({
  canonicalProductHost,
  canonicalProductUrl,
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
  return { json: async () => body } as unknown as NextRequest
}

function voidReq() {
  return {} as unknown as NextRequest
}

describe('PATCH /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    canonicalProductHost.mockReturnValue('example.com')
    canonicalProductUrl.mockImplementation((url: string) => url)
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
      expect.objectContaining({ data: expect.objectContaining({ name: 'New Name' }) })
    )
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

  it('returns 404 when the project does not exist', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)
    const res = await DELETE(voidReq(), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 and disables watch on delete', async () => {
    prismaMock.project.update.mockResolvedValue({ id: 'p1' })
    const res = await DELETE(voidReq(), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isManaged: false, watchInterval: null }),
      })
    )
  })
})
