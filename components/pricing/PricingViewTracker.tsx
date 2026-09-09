'use client'

import { useEffect } from 'react'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { trackEvent } from '@/lib/analytics/events'

export function PricingViewTracker() {
  useEffect(() => {
    trackEvent('viewed_pricing')
  }, [])

  return <MarketingPageViewTracker page="/pricing" />
}
