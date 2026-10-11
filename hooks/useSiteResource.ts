'use client'

import useSWR from 'swr'
import { useEffect, useState } from 'react'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function useSiteResource(siteId: string, initial: SiteHomeView) {
  const [streamDisconnected, setStreamDisconnected] = useState(false)
  const resource = useSWR<SiteHomeView>(`/api/sites/${siteId}`, async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
    return readSiteHomeView(await response.json(), siteId)
  }, {
    fallbackData: initial,
    refreshInterval: (view) => {
      const current = view ?? initial
      return current.activeRuns.length > 0 || current.outcomes.some(outcome => outcome.running) || (current.audit.status && !['COMPLETED', 'FAILED'].includes(current.audit.status)) ? 2500 : 0
    },
    revalidateOnFocus: true,
  })
  const { mutate } = resource
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const cursor = initial.executionProgress?.eventCursor
    const events = new EventSource(`/api/sites/${siteId}/events${cursor ? '?after=' + encodeURIComponent(cursor) : ''}`)
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const updated = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void mutate().catch(() => { /* SWR retains the view and exposes the refresh error. */ }) }, 150)
    }
    events.addEventListener('projection', updated)
    events.addEventListener('open', () => {
      // Catch up from the resource after reconnection, including missed scoped runs.
      void mutate().then(() => setStreamDisconnected(false)).catch(() => setStreamDisconnected(true))
    })
    events.addEventListener('error', () => setStreamDisconnected(true))
    events.addEventListener('disconnected', () => setStreamDisconnected(true))
    events.addEventListener('access-expired', () => { setStreamDisconnected(true); events.close(); void mutate().catch(() => { /* Retain dated evidence while access is unavailable. */ }) })
    return () => { clearTimeout(refreshTimer); events.close() }
  }, [siteId, initial.executionProgress?.eventCursor, mutate])
  return { view: resource.data ?? initial, disconnected: streamDisconnected || Boolean(resource.error), refresh: mutate }
}
