/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureGtagStub, initializeGoogleTag, isGaConfigured } from '@/lib/analytics/gtag'
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
    expect(Object.prototype.toString.call(last)).toBe('[object Arguments]')
    const commands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    const configIndex = commands.findIndex(([command]) => command === 'config')
    const eventIndex = commands.findIndex(([command]) => command === 'event')
    expect(configIndex).toBeGreaterThan(0)
    expect(eventIndex).toBeGreaterThan(configIndex)
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
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'invalid')
    expect(isGaConfigured()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '  G-ABCDEFGHI  ')
    expect(isGaConfigured()).toBe(true)
  })

  it('initializes cookieless measurement once with denied consent before config', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    initializeGoogleTag()
    initializeGoogleTag()
    const commands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    expect(commands[0]).toEqual(['consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
    expect(commands.filter(([command]) => command === 'config')).toEqual([
      ['config', 'G-TEST12345', { allow_google_signals: false, allow_ad_personalization_signals: false }],
    ])
    expect(commands.filter(([command]) => command === 'js')).toHaveLength(1)
    expect(document.cookie).toBe('')
    expect(sessionStorage.length).toBe(0)
  })

  it('does not send signup email to GA4', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', '')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    trackEvent('signed_up', { email: 'private@example.com', method: 'email' })
    const command = Array.from(window.dataLayer!.at(-1) as IArguments)
    expect(command).toEqual(['event', 'signed_up', expect.objectContaining({ method: 'email', send_to: 'G-TEST12345' })])
    expect(command[2]).not.toHaveProperty('email')
  })
})
