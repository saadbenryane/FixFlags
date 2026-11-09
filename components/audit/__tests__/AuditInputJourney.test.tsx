import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditInput } from '@/components/audit/AuditInput'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { MeProvider } from '@/hooks/useMe'
import { ANALYTICS_CONSENT_COOKIE, writeAnalyticsConsent } from '@/lib/analytics/consent'
import { ANALYTICS_JOURNEY_STORAGE_KEY, isAnalyticsJourneyId } from '@/lib/analytics/journey-id'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/auth/AuthFlow', () => ({ AuthFlow: () => null }))
vi.mock('@/lib/audit/active-audit', () => ({ setActiveAudit: vi.fn() }))
vi.mock('next/script', () => ({ default: () => null }))

function startedEvents() {
  return (window.dataLayer ?? [])
    .map((command) => Array.from(command as IArguments))
    .filter(([command, name]) => command === 'event' && name === 'started_audit')
    .map(([, , params]) => params as Record<string, unknown>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', '')
  window.history.replaceState({}, '', '/?ff_entry=tool_page')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  delete (window as { dataLayer?: unknown[] }).dataLayer
  delete (window as { gtag?: (...args: unknown[]) => void }).gtag
  delete window.fbq
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  sessionStorage.clear()
})

describe('AuditInput public entry journey handoff', () => {
  it.each([
    { reused: false, expectedEvent: 'started_audit', leads: 1 },
    { reused: true, expectedEvent: 'audit_reused', leads: 0 },
    { reused: undefined, expectedEvent: null, leads: 0 },
  ])('classifies the $reused admission response before emitting acquisition events', async ({ reused, expectedEvent, leads }) => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const pixel = vi.fn()
    window.fbq = pixel
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteId: 'site-journey', reportId: 'audit-journey', reused, isLoggedIn: false,
    }))))
    render(<MeProvider initialUser={null}><AuditInput source="homepage" idSuffix="-admission" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sites/site-journey'))

    const events = (window.dataLayer ?? []).map(command => Array.from(command as IArguments))
      .filter(([command, name]) => command === 'event' && (name === 'started_audit' || name === 'audit_reused'))
    expect(events.map(([, name]) => name)).toEqual(expectedEvent ? [expectedEvent] : [])
    expect(pixel.mock.calls.filter(([verb, name]) => verb === 'track' && name === 'Lead')).toHaveLength(leads)
  })

  it('links a new consented landing to the Analyze request after consent is withdrawn and restored', async () => {
    window.history.replaceState({}, '', '/')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteId: 'site-journey', reportId: 'audit-journey', reused: false,
    })))
    vi.stubGlobal('fetch', fetchMock)
    render(<>
      <ConversionScripts />
      <LandingViewTracker />
      <MeProvider initialUser={null}><AuditInput variant="landing" idSuffix="-reconsent" /></MeProvider>
    </>)
    act(() => writeAnalyticsConsent('granted'))
    const firstKey = sessionStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)
    expect(isAnalyticsJourneyId(firstKey)).toBe(true)
    act(() => writeAnalyticsConsent('denied'))
    expect(sessionStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)).toBeNull()
    act(() => writeAnalyticsConsent('granted'))
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sites/site-journey'))

    const { journeyId } = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(isAnalyticsJourneyId(journeyId)).toBe(true)
    expect(journeyId).not.toBe(firstKey)
    const landingKeys = (window.dataLayer ?? []).map(command => Array.from(command as IArguments))
      .filter(([command, name]) => command === 'event' && name === 'landing_view')
      .map(([, , params]) => (params as Record<string, unknown>).journey_id)
    expect(landingKeys).toEqual([firstKey, journeyId])
    expect(startedEvents()).toEqual([expect.objectContaining({ journey_id: journeyId })])
  })

  it.each([
    { source: 'homepage', variant: 'default', consent: true, linked: true },
    { source: 'tool_page', variant: 'default', consent: true, linked: true },
    { source: 'issue_page', variant: 'default', consent: true, linked: true },
    { source: 'benchmark_page', variant: 'default', consent: true, linked: true },
    { source: 'tool_page', variant: 'default', consent: false, linked: false },
    { source: 'issue_page', variant: 'default', consent: false, linked: false },
    { source: 'benchmark_page', variant: 'default', consent: false, linked: false },
    { source: 'dashboard', variant: 'default', consent: true, linked: false },
    { source: 'report', variant: 'landing', consent: true, linked: false },
    { source: undefined, variant: 'default', consent: true, linked: false },
  ] as const)('links $source with $variant layout only when public and consented ($consent)', async ({ source, variant, consent, linked }) => {
    if (consent) document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteId: 'site-journey', reportId: 'audit-journey', reused: false, isLoggedIn: false,
    })))
    vi.stubGlobal('fetch', fetchMock)
    render(<MeProvider initialUser={null}><AuditInput source={source} variant={variant} idSuffix="-journey" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sites/site-journey'))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/checks')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.source).toBe(source ?? 'dashboard')
    if (linked) {
      expect(isAnalyticsJourneyId(body.journeyId)).toBe(true)
      expect(sessionStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)).toBe(body.journeyId)
      expect(startedEvents()).toEqual([expect.objectContaining({
        source, journey_id: body.journeyId, reused: false,
      })])
      expect(startedEvents()[0]).not.toHaveProperty('audit_id')
    } else {
      expect(body).not.toHaveProperty('journeyId')
      expect(sessionStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)).toBeNull()
      if (consent) {
        expect(startedEvents()).toHaveLength(1)
        expect(startedEvents()[0].journey_id).toBeUndefined()
      } else expect(startedEvents()).toEqual([])
    }
  })
})
