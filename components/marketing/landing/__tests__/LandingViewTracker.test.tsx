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
  afterEach(() => {
    vi.clearAllMocks()
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  })

  it('waits for consent, then records the landing once', () => {
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

  it('records immediately when consent already exists', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    render(<LandingViewTracker />)
    expect(trackLandingView).toHaveBeenCalledTimes(1)
  })
})
