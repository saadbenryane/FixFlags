'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { readSiteProjectionNotice, type SiteProjectionNotice } from '@/lib/sites/execution-events'

const READ_TIMEOUT_MS = 15_000
export type SiteResourceUpdate = { type: 'projection'; notice: SiteProjectionNotice } | { type: 'reconnected' }

export function useSiteResource(siteId: string, initial: SiteHomeView, onUpdate?: (update: SiteResourceUpdate) => void) {
  const [streamFailure, setStreamFailure] = useState<string | null>(null)
  const [readFailure, setReadFailure] = useState<string | null>(null)
  const latestRead = useRef<{ siteId: string; promise: Promise<SiteHomeView> } | null>(null)
  const activeSite = useRef<string | null>(siteId)
  const updateObserver = useRef(onUpdate)
  useLayoutEffect(() => {
    activeSite.current = siteId; updateObserver.current = onUpdate
    return () => { activeSite.current = null }
  }, [siteId, onUpdate])
  const endpoint = `/api/sites/${siteId}`
  // Public and owner projections must never share a cached repair payload.
  const viewerScope = `${initial.actions.ownership}:${initial.actions.copy}`
  const cacheKey = useMemo(() => [endpoint, viewerScope] as const, [endpoint, viewerScope])
  const read = useCallback((url: string) => {
    // Settle superseded reads from the newest read of this Site. SWR fences
    // stale data, but an older rejection can still overwrite its cached error
    // and suspend polling after a successful action refresh.
    const pending: Promise<SiteHomeView> = Promise.resolve().then(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
        return readSiteHomeView(await response.json(), siteId)
      } finally { clearTimeout(timer) }
    }).then(view => {
      if (activeSite.current === siteId && latestRead.current?.siteId === siteId) {
        if (latestRead.current.promise !== pending) return latestRead.current.promise
        setReadFailure(null)
      }
      return view
    }, error => {
      if (activeSite.current === siteId && latestRead.current?.siteId === siteId) {
        if (latestRead.current.promise !== pending) return latestRead.current.promise
        setReadFailure(siteId)
      }
      throw error
    })
    if (activeSite.current === siteId) latestRead.current = { siteId, promise: pending }
    return pending
  }, [siteId])
  const resource = useSWR<SiteHomeView>(cacheKey, ([url]) => read(url), {
    fallbackData: initial,
    refreshInterval: (view) => {
      const current = view ?? initial
      const guidancePending = [...current.flags, ...current.recommendations, ...current.resolvedFlags]
        .some(flag => flag.repairGuidance === 'pending')
      return guidancePending || current.activeRuns.length > 0 || current.outcomes.some(outcome => outcome.running) || (current.audit.status && !['COMPLETED', 'FAILED'].includes(current.audit.status)) ? 2500 : current.uptime?.enabled ? 60_000 : 0
    },
    revalidateOnFocus: true,
  })
  const { mutate } = useSWRConfig()
  // Revalidation can resolve with retained data after its fetcher fails. An
  // action must await a validated read, with mutation ownership fencing older
  // in-flight reads, before reporting that the Site view was refreshed.
  const refresh = useCallback(() => mutate<SiteHomeView>(cacheKey, () => read(endpoint), { revalidate: false }), [mutate, read, endpoint, cacheKey])
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const cursor = initial.executionProgress?.eventCursor
    const events = new EventSource(`/api/sites/${siteId}/events${cursor ? '?after=' + encodeURIComponent(cursor) : ''}`)
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const updated = (event?: Event) => {
      if (!active || activeSite.current !== siteId) return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void refresh().catch(() => { /* Retain the dated view and expose read failure. */ }) }, 150)
      const observer = updateObserver.current
      if (observer) {
        const notice = readSiteProjectionNotice(event instanceof MessageEvent ? event.data : null)
        if (notice) observer({ type: 'projection', notice })
      }
    }
    events.addEventListener('projection', updated)
    events.addEventListener('open', () => {
      // Catch up from the resource after reconnection, including missed scoped runs.
      if (!active) return
      void refresh().then(() => {
        if (!active || activeSite.current !== siteId) return
        setStreamFailure(previous => previous === siteId ? null : previous)
        updateObserver.current?.({ type: 'reconnected' })
      })
        .catch(() => { if (active) setStreamFailure(siteId) })
    })
    events.addEventListener('error', () => { if (active) setStreamFailure(siteId) })
    events.addEventListener('disconnected', () => { if (active) setStreamFailure(siteId) })
    events.addEventListener('access-expired', () => {
      if (!active) return
      setStreamFailure(siteId); active = false; clearTimeout(refreshTimer); events.close()
      void refresh().catch(() => { /* Retain dated evidence while access is unavailable. */ })
    })
    return () => { active = false; clearTimeout(refreshTimer); events.close() }
  }, [siteId, initial.executionProgress?.eventCursor, refresh])
  return { view: resource.data ?? initial, disconnected: streamFailure === siteId || readFailure === siteId || Boolean(resource.error), refresh }
}
