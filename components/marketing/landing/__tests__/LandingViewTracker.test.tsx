import { StrictMode } from 'react'
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_CONSENT_EVENT,
} from '@/lib/analytics/consent'

const trackLandingView = vi.hoisted(() => vi.fn())

vi.mock('@/lib/analytics/events', () => ({ trackLandingView }))

describe('LandingViewTracker', () => {
  it('does not double-count when React replays effects', () => {
    render(<StrictMode><LandingViewTracker /></StrictMode>)
    expect(trackLandingView).toHaveBeenCalledTimes(1)
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  })

  it('honors opt-out, then records the landing once when re-enabled', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    render(<LandingViewTracker />)
    expect(trackLandingView).not.toHaveBeenCalled()

    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    fireEvent(
      window,
      new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: 'granted' }),
    )
    fireEvent(
      window,
      new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: 'granted' }),
    )

    expect(trackLandingView).toHaveBeenCalledTimes(1)
  })

  it('records immediately on a first visit without a saved preference', () => {
    render(<LandingViewTracker />)
    expect(trackLandingView).toHaveBeenCalledTimes(1)
  })

  it('records immediately when consent already exists', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    render(<LandingViewTracker />)
    expect(trackLandingView).toHaveBeenCalledTimes(1)
  })
})
