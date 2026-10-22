'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GUIDES_PAGE } from '@/lib/marketing/copy/guides'
import { trackEvent } from '@/lib/analytics/events'
import { readOrCreateAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { withCampaignTags, type CampaignQuery } from '@/lib/analytics/entry-surface'
import s from './Guide.module.css'

export function GuideActions({ page = '/guides' }: { page?: string }) {
  const [campaign, setCampaign] = useState<CampaignQuery>({})
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCampaign(Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].map(key => [key, params.getAll(key).length === 1 ? params.get(key) ?? undefined : undefined])))
  }, [])
  const track = (target: string) => trackEvent('marketing_interaction', {
    page, action: 'navigate', target, journey_id: readOrCreateAnalyticsJourneyId() ?? undefined,
  })
  return <div className={s.actions}>
    <Button asChild variant="brand"><Link href={withCampaignTags('/new', campaign) as Route} onClick={() => track('analyze')}>{GUIDES_PAGE.start}</Link></Button>
    <Button asChild variant="secondary"><Link href={withCampaignTags('/pricing', campaign) as Route} onClick={() => track('pricing')}>{GUIDES_PAGE.pricing}</Link></Button>
  </div>
}
