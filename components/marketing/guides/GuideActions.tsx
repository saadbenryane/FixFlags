'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GUIDES_PAGE } from '@/lib/marketing/copy/guides'
import { trackEvent } from '@/lib/analytics/events'
import { readOrCreateAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { ANALYTICS_CONSENT_EVENT, hasAnalyticsConsent } from '@/lib/analytics/consent'
import { GUIDE_ANALYZE_EVENT, withGuideEntry } from '@/lib/analytics/guide-entry'
import { withCampaignTags, type CampaignQuery } from '@/lib/analytics/entry-surface'
import s from './Guide.module.css'

export function GuideActions({ page = '/guides' }: { page?: string }) {
  const [campaign, setCampaign] = useState<CampaignQuery>({})
  const [consent, setConsent] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCampaign(Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].map(key => [key, params.getAll(key).length === 1 ? params.get(key) ?? undefined : undefined])))
  }, [])
  useEffect(() => {
    const update = () => setConsent(hasAnalyticsConsent())
    update()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, update)
  }, [])
  const eventContext = () => ({ page, journey_id: readOrCreateAnalyticsJourneyId() ?? undefined })
  const analyzeHref = withCampaignTags('/new', campaign)
  return <div className={s.actions}>
    <Button asChild variant="brand"><Link href={(consent ? withGuideEntry(analyzeHref, page) : analyzeHref) as Route} onClick={() => trackEvent(GUIDE_ANALYZE_EVENT, eventContext())}>{GUIDES_PAGE.start}</Link></Button>
    <Button asChild variant="secondary"><Link href={withCampaignTags('/pricing', campaign) as Route} onClick={() => trackEvent('marketing_interaction', { ...eventContext(), action: 'navigate', target: 'pricing' })}>{GUIDES_PAGE.pricing}</Link></Button>
  </div>
}
