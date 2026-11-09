'use client'

import { useEffect } from 'react'
import { trackLandingView } from '@/lib/analytics/events'
import {
  ANALYTICS_CONSENT_EVENT,
  hasAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics/consent'

/** Fires once per consented period on the mounted homepage. */
export function LandingViewTracker() {
  useEffect(() => {
    let sent = false
    const sendWhenGranted = () => {
      if (sent || !hasAnalyticsConsent()) return
      sent = true
      trackLandingView()
    }
    const onConsent = (event: Event) => {
      const choice = (event as CustomEvent<AnalyticsConsent>).detail
      if (choice === 'denied') sent = false
      if (choice === 'granted') sendWhenGranted()
    }

    sendWhenGranted()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
  }, [])

  return null
}
