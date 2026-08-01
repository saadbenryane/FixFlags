/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureGtagStub, isGaConfigured } from '@/lib/analytics/gtag'
import { trackEvent } from '@/lib/analytics/events'

describe('analytics gtag bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { dataLayer?: unknown[] }).dataLayer
    delete (window as { gtag?: (...args: unknown[]) => void }).gtag
  })

  it('queues events on dataLayer before gtag.js config runs', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    ensureGtagStub()
    trackEvent('landing_view', { path: '/' })
    expect(window.dataLayer?.length).toBeGreaterThan(0)
    const last = window.dataLayer?.at(-1) as unknown[]
    expect(last?.[0]).toBe('event')
    expect(last?.[1]).toBe('landing_view')
  })

  it('validates configured GA measurement IDs', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-ABCDEFGHI')
    expect(isGaConfigured()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    expect(isGaConfigured()).toBe(false)
  })
})
