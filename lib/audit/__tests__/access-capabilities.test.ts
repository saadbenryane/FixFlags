import { describe, expect, it } from 'vitest'
import { resolveReportSurfaceCapabilities } from '@/lib/audit/access-capabilities'

describe('resolveReportSurfaceCapabilities', () => {
  it('gives owners every prompt and chat', () => {
    const surface = resolveReportSurfaceCapabilities({
      accessContext: 'owner',
      isLoggedIn: true,
    })
    expect(surface.audience).toBe('owner')
    expect(surface.prompt).toEqual({ explorer: 'all', workspace: 'all' })
    expect(surface.chat.canChat).toBe(true)
  })

  it('redacts live anonymous prompts and gates chat', () => {
    const surface = resolveReportSurfaceCapabilities({
      accessContext: 'anonymous_teaser',
      isLoggedIn: false,
    })
    expect(surface.audience).toBe('live-anonymous')
    expect(surface.prompt).toEqual({ explorer: 'none', workspace: 'none' })
    expect(surface.chat.canChat).toBe(false)
    expect(surface.chat.claimReason).toBe('save-report')
  })

  it('keeps curated samples on the demonstrated-prompt path', () => {
    const surface = resolveReportSurfaceCapabilities({
      accessContext: 'public_viewer',
      isLoggedIn: false,
      isRepositorySample: true,
    })
    expect(surface.audience).toBe('curated-sample')
    expect(surface.prompt).toEqual({ explorer: 'one', workspace: 'demonstrated' })
  })
})
