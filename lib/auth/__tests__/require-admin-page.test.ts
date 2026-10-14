import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const state = vi.hoisted(() => ({ requireAdmin: vi.fn(), redirect: vi.fn(), requestedPath: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: state.requireAdmin,
  isAdminResponse: (value: unknown) => value instanceof NextResponse,
}))
vi.mock('next/navigation', () => ({ redirect: state.redirect }))
vi.mock('@/lib/auth/redirect-path', () => ({
  getRequestedPath: state.requestedPath,
  signInUrl: (path: string) => `/sign-in?next=${encodeURIComponent(path)}`,
}))

import { requireAdminPage } from '@/lib/auth/require-admin-page'

describe('admin page authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`) })
    state.requestedPath.mockResolvedValue('/admin/users?q=alice')
  })

  it('preserves the requested path for an anonymous visitor', async () => {
    state.requireAdmin.mockResolvedValue(new NextResponse(null, { status: 401 }))
    await expect(requireAdminPage()).rejects.toThrow('redirect:/sign-in?next=%2Fadmin%2Fusers%3Fq%3Dalice')
  })

  it('stops a signed-in non-admin before returning data', async () => {
    state.requireAdmin.mockResolvedValue(new NextResponse(null, { status: 403 }))
    await expect(requireAdminPage()).rejects.toThrow('redirect:/')
    expect(state.requestedPath).not.toHaveBeenCalled()
  })

  it('returns the server-verified administrator', async () => {
    const admin = { id: 'operator', email: 'admin@example.com', role: 'admin' }
    state.requireAdmin.mockResolvedValue(admin)
    expect(await requireAdminPage()).toEqual(admin)
    expect(state.redirect).not.toHaveBeenCalled()
  })

  it('does not continue when authorization is unavailable', async () => {
    state.requireAdmin.mockRejectedValue(new Error('database unavailable'))
    await expect(requireAdminPage()).rejects.toThrow('database unavailable')
  })
})
