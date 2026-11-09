import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isProtectedPath, proxy } from '@/proxy'

afterEach(() => vi.unstubAllEnvs())

describe('protected paths', () => {
  it('guards a bare section path the same as its children', () => {
    expect(isProtectedPath('/settings')).toBe(true)
    expect(isProtectedPath('/admin')).toBe(true)
  })

  it('guards every nested path under a protected section', () => {
    expect(isProtectedPath('/settings/api-keys')).toBe(true)
    expect(isProtectedPath('/admin/analytics')).toBe(true)
  })

  it('leaves public paths and lookalike prefixes alone', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/pricing')).toBe(false)
    expect(isProtectedPath('/sites/site-1/settings')).toBe(false)
    expect(isProtectedPath('/administrator')).toBe(false)
    expect(isProtectedPath('/settings-archive')).toBe(false)
  })

  it('redirects a protected request without a session cookie', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags.com')
    const response = await proxy(new NextRequest('https://fixflags.com/settings'))
    const destination = new URL(response.headers.get('Location')!)
    expect(destination.pathname).toBe('/sign-in')
    expect(destination.searchParams.get('next')).toBe('/settings')
  })
})
