import { afterEach, describe, expect, it, vi } from 'vitest'

const headerMap = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
  }),
}))

import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'

describe('getRequestedPath', () => {
  afterEach(() => {
    headerMap.clear()
    vi.unstubAllEnvs()
  })

  it('returns the requested path for authenticated navigation', async () => {
    headerMap.set('x-pathname', '/report/audit-123')
    await expect(getRequestedPath()).resolves.toBe('/report/audit-123')
  })

  it('falls back when no path header is present', async () => {
    await expect(getRequestedPath()).resolves.toBe('/dashboard')
  })

  it('falls back for auth pages so the redirect loop never lands on sign-in', async () => {
    headerMap.set('x-pathname', '/sign-in')
    await expect(getRequestedPath()).resolves.toBe('/dashboard')
    headerMap.set('x-pathname', '/sign-up?plan=BUILDER')
    await expect(getRequestedPath()).resolves.toBe('/dashboard')
  })

  it('honors an explicit fallback', async () => {
    headerMap.set('x-pathname', '/sign-in')
    await expect(getRequestedPath('/pricing')).resolves.toBe('/pricing')
  })
})

describe('signInUrl', () => {
  it('encodes the next path into the sign-in route', () => {
    expect(signInUrl('/report/audit-1')).toBe('/sign-in?next=%2Freport%2Faudit-1')
  })
})
