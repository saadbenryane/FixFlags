'use client'

import { useEffect, useRef } from 'react'
import { trackLandingView } from '@/lib/analytics/events'
import {
  ANALYTICS_CONSENT_EVENT,
  isGoogleAnalyticsEnabled,
  type AnalyticsConsent,
} from '@/lib/analytics/consent'

/** Fires on arrival and once again if measurement is re-enabled after opt-out. */
export function LandingViewTracker() {
  const sent = useRef(false)
  useEffect(() => {
    const sendWhenGranted = () => {
      if (sent.current || !isGoogleAnalyticsEnabled()) return
      sent.current = true
      trackLandingView()
    }
    const onConsent = (event: Event) => {
      const choice = (event as CustomEvent<AnalyticsConsent>).detail
      if (choice === 'denied') sent.current = false
      if (choice === 'granted') sendWhenGranted()
    }

    sendWhenGranted()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
  }, [])

  return null
}
