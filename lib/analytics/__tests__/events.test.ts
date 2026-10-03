/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureGtagStub, isGaConfigured } from '@/lib/analytics/gtag'
import { trackEvent, trackLandingView } from '@/lib/analytics/events'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'

describe('analytics gtag bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { dataLayer?: unknown[] }).dataLayer
    delete (window as { gtag?: (...args: unknown[]) => void }).gtag
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
    sessionStorage.clear()
  })

  it('queues events on dataLayer before gtag.js config runs', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    ensureGtagStub()
    trackEvent('landing_view', { path: '/' })
    expect(window.dataLayer?.length).toBeGreaterThan(0)
    const last = window.dataLayer?.at(-1) as unknown[]
    expect(last?.[0]).toBe('event')
    expect(last?.[1]).toBe('landing_view')
  })

  it('does not queue browser events before analytics consent', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    ensureGtagStub()
    trackEvent('landing_view', { path: '/' })
    expect(window.dataLayer).toEqual([])
  })

  it('adds one opaque journey key to a consented landing event', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    ensureGtagStub()

    trackLandingView()

    const last = window.dataLayer?.at(-1) as unknown[]
    expect(last?.[1]).toBe('landing_view')
    expect(
      isAnalyticsJourneyId((last?.[2] as Record<string, unknown>)?.journey_id),
    ).toBe(true)
  })

  it('validates configured GA measurement IDs', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-ABCDEFGHI')
    expect(isGaConfigured()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    expect(isGaConfigured()).toBe(false)
  })
})
