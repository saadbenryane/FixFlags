import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_EVENT } from '@/lib/analytics/consent'

const trackMarketingPageView = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/events', () => ({ trackMarketingPageView }))

afterEach(() => {
  vi.clearAllMocks()
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
})

describe('MarketingPageViewTracker', () => {
  it('records the current page once when consent arrives after mount', () => {
    render(<MarketingPageViewTracker page="/pricing" />)
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(trackMarketingPageView).not.toHaveBeenCalled()
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(trackMarketingPageView).toHaveBeenCalledExactlyOnceWith('/pricing')
  })

  it('records navigation for an already consented visitor and removes old listeners', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    const { rerender, unmount } = render(<MarketingPageViewTracker page="/pricing" />)
    rerender(<MarketingPageViewTracker page="/samples" />)
    expect(trackMarketingPageView.mock.calls).toEqual([['/pricing'], ['/samples']])
    unmount()
    fireEvent(window, new Event(ANALYTICS_CONSENT_EVENT))
    expect(trackMarketingPageView).toHaveBeenCalledTimes(2)
  })
})
