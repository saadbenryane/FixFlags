'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function useSiteResource(siteId: string, initial: SiteHomeView) {
  const [streamFailure, setStreamFailure] = useState<string | null>(null)
  const [readFailure, setReadFailure] = useState<string | null>(null)
  const readSequence = useRef(0)
  const activeSite = useRef<string | null>(siteId)
  useLayoutEffect(() => { activeSite.current = siteId; return () => { activeSite.current = null } }, [siteId])
  const endpoint = `/api/sites/${siteId}`
  const read = useCallback(async (url: string) => {
    const sequence = activeSite.current === siteId ? ++readSequence.current : null
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
      const view = readSiteHomeView(await response.json(), siteId)
      if (activeSite.current === siteId && sequence === readSequence.current) setReadFailure(null)
      return view
    } catch (error) {
      if (activeSite.current === siteId && sequence === readSequence.current) setReadFailure(siteId)
      throw error
    }
  }, [siteId])
  const resource = useSWR<SiteHomeView>(endpoint, read, {
    fallbackData: initial,
    refreshInterval: (view) => {
      const current = view ?? initial
      return current.activeRuns.length > 0 || current.outcomes.some(outcome => outcome.running) || (current.audit.status && !['COMPLETED', 'FAILED'].includes(current.audit.status)) ? 2500 : current.uptime?.enabled ? 60_000 : 0
    },
    revalidateOnFocus: true,
  })
  const { mutate } = useSWRConfig()
  // Revalidation can resolve with retained data after its fetcher fails. An
  // action must await a validated read, with mutation ownership fencing older
  // in-flight reads, before reporting that the Site view was refreshed.
  const refresh = useCallback(() => mutate<SiteHomeView>(endpoint, () => read(endpoint), { revalidate: false }), [mutate, read, endpoint])
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const cursor = initial.executionProgress?.eventCursor
    const events = new EventSource(`/api/sites/${siteId}/events${cursor ? '?after=' + encodeURIComponent(cursor) : ''}`)
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const updated = () => {
      if (!active) return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void refresh().catch(() => { /* Retain the dated view and expose read failure. */ }) }, 150)
    }
    events.addEventListener('projection', updated)
    events.addEventListener('open', () => {
      // Catch up from the resource after reconnection, including missed scoped runs.
      if (!active) return
      void refresh().then(() => { if (active) setStreamFailure(previous => previous === siteId ? null : previous) })
        .catch(() => { if (active) setStreamFailure(siteId) })
    })
    events.addEventListener('error', () => { if (active) setStreamFailure(siteId) })
    events.addEventListener('disconnected', () => { if (active) setStreamFailure(siteId) })
    events.addEventListener('access-expired', () => {
      if (!active) return
      setStreamFailure(siteId); events.close(); void refresh().catch(() => { /* Retain dated evidence while access is unavailable. */ })
    })
    return () => { active = false; clearTimeout(refreshTimer); events.close() }
  }, [siteId, initial.executionProgress?.eventCursor, refresh])
  return { view: resource.data ?? initial, disconnected: streamFailure === siteId || readFailure === siteId || Boolean(resource.error), refresh }
}
