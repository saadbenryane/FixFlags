'use client'

import { useEffect } from 'react'
import { trackLandingView } from '@/lib/analytics/events'

/** Fires once per homepage mount for funnel attribution. */
export function LandingViewTracker() {
  useEffect(() => {
    trackLandingView()
  }, [])

  return null
}
