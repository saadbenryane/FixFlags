'use client'

import { useEffect } from 'react'
import { trackMarketingPageView } from '@/lib/analytics/events'

/** Fires once per marketing page mount for funnel attribution. */
export function MarketingPageViewTracker({ page }: { page: string }) {
  useEffect(() => {
    trackMarketingPageView(page)
  }, [page])

  return null
}
