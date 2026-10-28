'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { readSiteProjectionNotice, type SiteProjectionNotice } from '@/lib/sites/execution-events'

const READ_TIMEOUT_MS = 15_000
export type SiteResourceUpdate = { type: 'projection'; notice: SiteProjectionNotice } | { type: 'reconnected' }
type ReadOwner = { siteId: string; viewerScope: string; readScope: string }

function viewerScope(view: SiteHomeView): string {
  return `${view.actions.ownership}:${view.actions.copy}`
}

export function useSiteResource(siteId: string, initial: SiteHomeView, onUpdate?: (update: SiteResourceUpdate) => void) {
  const scope = viewerScope(initial)
  const readScope = initial.readScope ?? 'overview'
  const owner = useMemo<ReadOwner>(() => ({ siteId, viewerScope: scope, readScope }), [siteId, scope, readScope])
  const [streamFailure, setStreamFailure] = useState<ReadOwner | null>(null)
  const [readFailure, setReadFailure] = useState<ReadOwner | null>(null)
  const latestRead = useRef<{ owner: ReadOwner; promise: Promise<SiteHomeView> } | null>(null)
  const activeOwner = useRef<ReadOwner | null>(owner)
  const requests = useRef(new Set<AbortController>())
  const updateObserver = useRef(onUpdate)
  useLayoutEffect(() => {
    activeOwner.current = owner
    const pending = requests.current
    return () => {
      activeOwner.current = null; latestRead.current = null
      for (const request of pending) request.abort()
      pending.clear()
    }
  }, [owner])
  useLayoutEffect(() => { updateObserver.current = onUpdate }, [onUpdate])
  const endpoint = `/api/sites/${siteId}${readScope === 'settings' ? '?scope=settings' : ''}`
  // Public and owner projections must never share a cached repair payload.
  const cacheKey = useMemo(() => [endpoint, scope] as const, [endpoint, scope])
  const read = useCallback((url: string) => {
    // Only reads owned by the same committed viewer can settle from each other.
    // Claim, navigation and unmount retire requests before they can publish.
    const pending: Promise<SiteHomeView> = Promise.resolve().then(async () => {
      if (activeOwner.current !== owner) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
      const controller = new AbortController()
      requests.current.add(controller)
      const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
        const view = readSiteHomeView(await response.json(), siteId)
        if (activeOwner.current !== owner || controller.signal.aborted || viewerScope(view) !== owner.viewerScope || (view.readScope ?? 'overview') !== owner.readScope) {
          throw new Error(SITE_ACTION_COPY.updatesDisconnected)
        }
        return view
      } finally { clearTimeout(timer); requests.current.delete(controller) }
    }).then(view => {
      if (activeOwner.current === owner && latestRead.current?.owner === owner) {
        if (latestRead.current.promise !== pending) return latestRead.current.promise
        setReadFailure(null)
      }
      return view
    }, error => {
      if (activeOwner.current === owner && latestRead.current?.owner === owner) {
        if (latestRead.current.promise !== pending) return latestRead.current.promise
        setReadFailure(owner)
      }
      throw error
    })
    if (activeOwner.current === owner) latestRead.current = { owner, promise: pending }
    return pending
  }, [siteId, owner])
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
      if (!active || activeOwner.current !== owner) return
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
        if (!active || activeOwner.current !== owner) return
        setStreamFailure(previous => previous === owner ? null : previous)
        updateObserver.current?.({ type: 'reconnected' })
      })
        .catch(() => { if (active) setStreamFailure(owner) })
    })
    events.addEventListener('error', () => { if (active) setStreamFailure(owner) })
    events.addEventListener('disconnected', () => { if (active) setStreamFailure(owner) })
    events.addEventListener('access-expired', () => {
      if (!active) return
      setStreamFailure(owner); active = false; clearTimeout(refreshTimer); events.close()
      void refresh().catch(() => { /* Retain dated evidence while access is unavailable. */ })
    })
    return () => { active = false; clearTimeout(refreshTimer); events.close() }
  }, [siteId, owner, initial.executionProgress?.eventCursor, refresh])
  return { view: resource.data ?? initial, disconnected: streamFailure === owner || readFailure === owner || Boolean(resource.error), refresh }
}
