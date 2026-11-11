import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideActions } from '../GuideActions'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { GUIDES_PAGE } from '@/lib/marketing/copy/guides'
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_EVENT } from '@/lib/analytics/consent'
import { GUIDE_ANALYZE_EVENT } from '@/lib/analytics/guide-entry'

const recorded = () => (window.dataLayer ?? []).map(value => Array.from(value as IArguments)).filter(([type]) => type === 'event')

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  delete (window as { dataLayer?: unknown[] }).dataLayer
  delete (window as { gtag?: unknown }).gtag
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('guide acquisition entry', () => {
  it('carries only real campaign tags and emits a consented guide CTA with the same journey', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST123')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const page = '/guides/checking-after-publishing'
    window.history.replaceState({}, '', `${page}?utm_source=newsletter&utm_medium=email&utm_campaign=release&url=private&token=private`)
    render(<><MarketingPageViewTracker page={page} /><GuideActions page={page} /></>)
    const link = screen.getByRole('link', { name: GUIDES_PAGE.start })
    await waitFor(() => expect(link).toHaveAttribute('href', '/new?utm_source=newsletter&utm_medium=email&utm_campaign=release&ff_guide=checking-after-publishing'))
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    const events = recorded()
    const view = events.find(([, name]) => name === 'marketing_page_view')?.[2] as Record<string, unknown>
    const click = events.find(([, name]) => name === GUIDE_ANALYZE_EVENT)?.[2] as Record<string, unknown>
    expect(view).toMatchObject({ page, utm_source: 'newsletter' })
    expect(click).toMatchObject({ page, journey_id: view.journey_id })
    expect(events.filter(([, name]) => name === 'marketing_interaction')).toEqual([])
    expect(JSON.stringify(events)).not.toContain('private')
  })

  it('measures organic visits immediately and waits for consent before adding journey attribution', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST123')
    const page = '/guides'
    const { rerender } = render(<><MarketingPageViewTracker page={page} /><GuideActions /></>)
    const link = screen.getByRole('link', { name: GUIDES_PAGE.start })
    expect(link).toHaveAttribute('href', '/new')
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    expect(recorded().map(([, name]) => name)).toEqual(['marketing_page_view', GUIDE_ANALYZE_EVENT])
    expect(recorded().every(([, , params]) => !(params as Record<string, unknown>).journey_id)).toBe(true)
    expect(sessionStorage.length).toBe(0)
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(link).toHaveAttribute('href', '/new?ff_guide=guides-index')
    expect(recorded().filter(([, name]) => name === 'marketing_page_view')).toHaveLength(1)
    rerender(<><MarketingPageViewTracker page="/guides/checking-after-publishing" /><GuideActions /></>)
    expect(recorded().filter(([, name]) => name === 'marketing_page_view')).toHaveLength(2)
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(link).toHaveAttribute('href', '/new')
  })
})
