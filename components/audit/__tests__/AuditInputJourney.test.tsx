import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditInput } from '@/components/audit/AuditInput'
import { MeProvider } from '@/hooks/useMe'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'
import { ANALYTICS_JOURNEY_STORAGE_KEY, isAnalyticsJourneyId } from '@/lib/analytics/journey-id'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/auth/AuthFlow', () => ({ AuthFlow: () => null }))
vi.mock('@/lib/audit/active-audit', () => ({ setActiveAudit: vi.fn() }))

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
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  sessionStorage.clear()
})

describe('AuditInput public entry journey handoff', () => {
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
        source, journey_id: body.journeyId, audit_id: 'audit-journey', reused: false,
      })])
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
