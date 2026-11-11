'use client'

import { useEffect, useRef } from 'react'
import { trackMarketingPageView } from '@/lib/analytics/events'
import { ANALYTICS_CONSENT_EVENT, isGoogleAnalyticsEnabled } from '@/lib/analytics/consent'

/** Fires once per marketing page mount for funnel attribution. */
export function MarketingPageViewTracker({ page }: { page: string }) {
  const sentPage = useRef<string | null>(null)
  useEffect(() => {
    const sendWhenGranted = () => {
      if (!isGoogleAnalyticsEnabled()) {
        sentPage.current = null
        return
      }
      if (sentPage.current === page) return
      sentPage.current = page
      trackMarketingPageView(page)
    }
    sendWhenGranted()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sendWhenGranted)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sendWhenGranted)
  }, [page])

  return null
}
