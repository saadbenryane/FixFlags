import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}))

const getSession = vi.hoisted(() => vi.fn())
const persistProjectScanAccess = vi.hoisted(() => vi.fn())
const decryptScanAccess = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/audit/scan-access-store', () => ({ persistProjectScanAccess }))
vi.mock('@/lib/audit/scan-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/scan-access')>()
  return {
    ...actual,
    decryptScanAccess,
    redactScanAccessForClient: (config: { label?: string | null }) => ({
      label: config.label ?? null,
      hasHttpBasic: false,
      cookieCount: 0,
      headerKeys: [],
    }),
  }
})

import { GET, PUT } from '@/app/api/projects/[id]/scan-access/route'

const params = Promise.resolve({ id: 'proj-1' })

function makeUser(plan: 'FREE' | 'BUILDER' | 'TEAM') {
  return { id: 'user-1', role: 'user', plan, subscriptionStatus: 'ACTIVE' }
}

describe('/api/projects/[id]/scan-access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      scanAccessEncrypted: 'enc',
    })
    decryptScanAccess.mockReturnValue({ label: 'Staging', httpBasic: { username: 'u', password: 'p' } })
    persistProjectScanAccess.mockResolvedValue(undefined)
  })

  it('returns 401 without a session', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET({} as NextRequest, { params })
    expect(res.status).toBe(401)
  })

  it('returns 402 for non-Studio users', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser('BUILDER'))
    const res = await GET({} as NextRequest, { params })
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
  })

  it('returns redacted summary for Studio owners', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser('TEAM'))
    const res = await GET({} as NextRequest, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.configured).toBe(true)
    expect(body.summary?.label).toBe('Staging')
  })

  it('persists scan access for Studio owners', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser('TEAM'))
    const req = {
      json: async () => ({
        scanAccess: {
          label: 'Preview',
          httpBasic: { username: 'user', password: 'pass' },
        },
      }),
    } as unknown as NextRequest

    const res = await PUT(req, { params })

    expect(res.status).toBe(200)
    expect(persistProjectScanAccess).toHaveBeenCalledWith(
      'proj-1',
      'user-1',
      expect.objectContaining({ label: 'Preview' })
    )
  })
})
