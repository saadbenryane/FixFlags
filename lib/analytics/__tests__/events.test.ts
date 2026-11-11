/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureGtagStub, initializeGoogleTag, isGaConfigured } from '@/lib/analytics/gtag'
import { trackEvent, trackLandingView, trackMarketingPageView } from '@/lib/analytics/events'
import { fireGoogleAdsConversion, fireMetaPixelEvent } from '@/lib/analytics/ad-conversions'
import { ANALYTICS_CONSENT_COOKIE, writeAnalyticsConsent } from '@/lib/analytics/consent'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'

describe('analytics gtag bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    window.history.replaceState({}, '', '/')
    delete (window as { dataLayer?: unknown[] }).dataLayer
    delete (window as { gtag?: (...args: unknown[]) => void }).gtag
    delete window.fbq
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
    sessionStorage.clear()
  })

  it.each(['/share/test-token', '/report/test-report', '/sites/test-site'])('drops explicit report views on %s even with analytics consent', pathname => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    window.history.replaceState({}, '', pathname)
    const pixel = vi.fn()
    window.fbq = pixel

    trackEvent('viewed_report', { audit_id: 'test-audit', surface: 'shared' })

    expect(window.dataLayer).toBeUndefined()
    expect(pixel).not.toHaveBeenCalled()
  })

  it('drops optional signup conversions on a credential continuation even with consent', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    window.history.replaceState({}, '', '/post-login?next=%2Fcli%2Fauthorize%3Fuser_code%3DFIXTURE&signup=1')
    const pixel = vi.fn()
    window.fbq = pixel

    trackEvent('signed_up', { method: 'oauth', user_id: 'private-account' })

    expect(window.dataLayer).toBeUndefined()
    expect(pixel).not.toHaveBeenCalled()
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

  it('does not queue browser events after an explicit opt-out', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
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

  it('sends first-visit funnel events without granting advertising or extra journey attribution', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-TEST')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'signup')
    window.fbq = vi.fn()
    trackLandingView()
    trackEvent('signup_started', { method: 'email' })
    trackEvent('signed_up', { method: 'email', email: 'private@example.com', user_id: 'private-user' })
    const commands = window.dataLayer!.map(command => Array.from(command as IArguments))
    expect(commands.filter(([verb]) => verb === 'event').map(([, name]) => name))
      .toEqual(['landing_view', 'signup_started', 'signed_up'])
    expect(JSON.stringify(commands)).not.toMatch(/private@example|private-user|AW-TEST|ffj_/)
    expect(window.fbq).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it('filters unsafe campaign values from first-visit acquisition events', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    window.history.replaceState({}, '', '/?utm_source=private%40example.com&utm_campaign=launch_2026&token=private-token')
    trackLandingView()
    trackMarketingPageView('/pricing')
    const events = window.dataLayer!.map(command => Array.from(command as IArguments)).filter(([verb]) => verb === 'event')
    expect(events).toHaveLength(2)
    for (const [, , params] of events) {
      expect(params).toMatchObject({ utm_campaign: 'launch_2026', utm_source: undefined })
    }
    expect(JSON.stringify(events)).not.toMatch(/private/)
  })

  it('stops subsequent events and direct advertising calls after opt-out', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-TEST')
    window.fbq = vi.fn()
    trackLandingView()
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    expect(initializeGoogleTag()).toBe(false)
    const count = window.dataLayer!.length
    trackEvent('signup_started', { method: 'email' })
    fireGoogleAdsConversion('signup', { email: 'private@example.com' })
    fireMetaPixelEvent('Lead')
    expect(window.dataLayer).toHaveLength(count)
    expect(window.fbq).not.toHaveBeenCalled()
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST12345']).toBe(true)
  })

  it('revokes an already configured Ads tag even without a GA measurement ID', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-TEST')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    expect(initializeGoogleTag()).toBe(true)
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    expect(initializeGoogleTag()).toBe(false)
    expect(Array.from(window.dataLayer!.at(-1) as IArguments)).toEqual(['consent', 'update', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
  })

  it('removes existing measurement cookies while preserving necessary cookies and the opt-out', () => {
    document.cookie = '_ga=old-client; Path=/'
    document.cookie = '_ga_TEST=old-session; Path=/'
    document.cookie = '_gid=old-visitor; Path=/'
    document.cookie = '_gcl_au=old-click; Path=/'
    document.cookie = '_fbp=old-pixel; Path=/'
    document.cookie = 'necessary-session=keep; Path=/'
    writeAnalyticsConsent('denied')
    expect(document.cookie).not.toMatch(/_ga|_gid|_gcl_|_fbp/)
    expect(document.cookie).toContain('necessary-session=keep')
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=denied`)
    document.cookie = 'necessary-session=; Path=/; Max-Age=0'
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

  it('initializes analytics once on arrival with advertising denied before config', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    initializeGoogleTag()
    initializeGoogleTag()
    const commands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    expect(commands[0]).toEqual(['consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
    expect(commands.filter(([command]) => command === 'config')).toEqual([
      ['config', 'G-TEST12345', { allow_google_signals: false, allow_ad_personalization_signals: false }],
    ])
    expect(commands.filter(([command]) => command === 'js')).toHaveLength(1)
    expect(document.cookie).toBe('')
    expect(sessionStorage.length).toBe(0)
  })

  it('keeps signup email and account identity out of GA4 while preserving Meta deduplication', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', '')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const pixel = vi.fn()
    window.fbq = pixel
    trackEvent('signed_up', { email: 'private@example.com', method: 'email', user_id: 'private-account' })
    const command = Array.from(window.dataLayer!.at(-1) as IArguments)
    expect(command).toEqual(['event', 'signed_up', expect.objectContaining({ method: 'email', send_to: 'G-TEST12345' })])
    expect(command[2]).not.toHaveProperty('email')
    expect(command[2]).not.toHaveProperty('user_id')
    expect(pixel).toHaveBeenCalledWith('track', 'CompleteRegistration', {}, { eventID: 'signup_private-account' })
  })

  it('sends report behavior without exact record IDs and reduces a page-scoped check to its product identity', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const pixel = vi.fn()
    window.fbq = pixel
    trackEvent('viewed_report', { audit_id: 'private-audit', surface: 'focused', is_owner: true })
    trackEvent('flag_detail_viewed', { audit_id: 'private-audit', flag_id: 'private-flag',
      check_id: 'broken-internal-links::page:private-page', surface: 'focused' })
    const events = window.dataLayer!.map(command => Array.from(command as IArguments)).filter(([verb]) => verb === 'event')
    expect(events).toEqual([
      ['event', 'viewed_report', expect.objectContaining({ surface: 'focused', is_owner: true })],
      ['event', 'flag_detail_viewed', expect.objectContaining({ check_id: 'broken-internal-links', surface: 'focused' })],
    ])
    expect(pixel).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({ surface: 'focused', is_owner: true }))
    expect(JSON.stringify([events, pixel.mock.calls])).not.toMatch(/private-audit|private-flag|private-page/)
  })
})
