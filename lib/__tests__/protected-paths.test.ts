import { describe, expect, it } from 'vitest'
import { isProtectedPath } from '@/proxy'

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
})
