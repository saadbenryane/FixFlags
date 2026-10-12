'use client'

import { useEffect } from 'react'
import { trackMarketingPageView } from '@/lib/analytics/events'
import { ANALYTICS_CONSENT_EVENT, hasAnalyticsConsent } from '@/lib/analytics/consent'

/** Fires once per marketing page mount for funnel attribution. */
export function MarketingPageViewTracker({ page }: { page: string }) {
  useEffect(() => {
    let sent = false
    const sendWhenGranted = () => {
      if (sent || !hasAnalyticsConsent()) return
      sent = true
      trackMarketingPageView(page)
    }
    sendWhenGranted()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sendWhenGranted)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sendWhenGranted)
  }, [page])

  return null
}
