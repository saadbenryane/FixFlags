import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const getSession = vi.hoisted(() => vi.fn())
const prismaUserFindUnique = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: prismaUserFindUnique } } }))

vi.mock('@/lib/env', () => ({ getEnv: () => ({ ADMIN_USER_IDS: ['admin-1'] }) }))

import { isAdminResponse, requireAdmin } from '@/lib/auth/require-admin'

const ORIGINAL_ADMIN_IDS = process.env.ADMIN_USER_IDS

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin-1'
  })

  afterEach(() => {
    if (ORIGINAL_ADMIN_IDS === undefined) delete process.env.ADMIN_USER_IDS
    else process.env.ADMIN_USER_IDS = ORIGINAL_ADMIN_IDS
  })

  it('rejects unauthenticated requests', async () => {
    getSession.mockResolvedValueOnce(null)
    const result = await requireAdmin()
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('rejects signed-in users who are not admins', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    prismaUserFindUnique.mockResolvedValueOnce({ id: 'user-1', role: 'user', email: 'u@e.com' })
    const result = await requireAdmin()
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('allows role admins', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    prismaUserFindUnique.mockResolvedValueOnce({ id: 'user-1', role: 'admin', email: 'a@e.com' })
    const result = await requireAdmin()
    expect(isAdminResponse(result)).toBe(false)
    expect(result).toMatchObject({ id: 'user-1', role: 'admin' })
  })

  it('allows users listed in ADMIN_USER_IDS', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'admin-1' } })
    prismaUserFindUnique.mockResolvedValueOnce({ id: 'admin-1', role: 'user', email: 'a@e.com' })
    const result = await requireAdmin()
    expect(isAdminResponse(result)).toBe(false)
    expect(result).toMatchObject({ id: 'admin-1' })
  })

  it('rejects when the user row is gone', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    prismaUserFindUnique.mockResolvedValueOnce(null)
    const result = await requireAdmin()
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })
})
