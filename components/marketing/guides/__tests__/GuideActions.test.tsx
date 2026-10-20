import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideActions } from '../GuideActions'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { GUIDES_PAGE } from '@/lib/marketing/copy/guides'
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_EVENT } from '@/lib/analytics/consent'

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
    await waitFor(() => expect(link).toHaveAttribute('href', '/new?utm_source=newsletter&utm_medium=email&utm_campaign=release'))
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    const events = recorded()
    const view = events.find(([, name]) => name === 'marketing_page_view')?.[2] as Record<string, unknown>
    const click = events.find(([, name]) => name === 'marketing_interaction')?.[2] as Record<string, unknown>
    expect(view).toMatchObject({ page, utm_source: 'newsletter' })
    expect(click).toMatchObject({ page, target: 'analyze', journey_id: view.journey_id })
    expect(JSON.stringify(events)).not.toContain('private')
  })

  it('waits for consent and does not invent campaign tags for organic entry', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST123')
    const page = '/guides'
    const { rerender } = render(<><MarketingPageViewTracker page={page} /><GuideActions /></>)
    const link = screen.getByRole('link', { name: GUIDES_PAGE.start })
    expect(link).toHaveAttribute('href', '/new')
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    expect(recorded()).toEqual([])
    expect(sessionStorage.length).toBe(0)
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(recorded().filter(([, name]) => name === 'marketing_page_view')).toHaveLength(1)
    rerender(<><MarketingPageViewTracker page="/guides/checking-after-publishing" /><GuideActions /></>)
    expect(recorded().filter(([, name]) => name === 'marketing_page_view')).toHaveLength(2)
  })
})
