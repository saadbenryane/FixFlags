'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { readSiteProjectionNotice, type SiteProjectionNotice } from '@/lib/sites/execution-events'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'

const READ_TIMEOUT_MS = 15_000
export type SiteResourceUpdate = { type: 'projection'; notice: SiteProjectionNotice } | { type: 'reconnected' }
type ReadOwner = { siteId: string; viewerScope: string; readScope: string }

function viewerScope(view: SiteHomeView): string {
  return `${view.actions.ownership}:${view.actions.copy}`
}

export function useSiteResource(siteId: string, initial: SiteHomeView, onUpdate?: (update: SiteResourceUpdate) => void) {
  // A server refresh can finish after the browser cached an earlier read.
  // Compare server-issued ordering facts, retaining legacy behavior when absent.
  const newest = (view?: SiteHomeView) => view && view.readAt !== undefined && initial.readAt !== undefined && initial.readAt > view.readAt ? initial : view ?? initial
  const scope = viewerScope(initial)
  const readScope = initial.readScope ?? 'overview'
  const owner = useMemo<ReadOwner>(() => ({ siteId, viewerScope: scope, readScope }), [siteId, scope, readScope])
  const [streamFailure, setStreamFailure] = useState<ReadOwner | null>(null)
  const [readFailure, setReadFailure] = useState<ReadOwner | null>(null)
  const latestRead = useRef<{ owner: ReadOwner; promise: Promise<SiteHomeView>; pending: boolean } | null>(null)
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
  const read = useCallback((url: string, { reusePending = false } = {}) => {
    // Background reads can share current work. Actions and source notices still
    // start a read after their own event, independent of earlier observations.
    if (reusePending && activeOwner.current === owner && latestRead.current?.owner === owner && latestRead.current.pending) return latestRead.current.promise
    // Only reads owned by the same committed viewer can settle from each other.
    // Claim, navigation and unmount retire requests before they can publish.
    const pending: Promise<SiteHomeView> = Promise.resolve().then(async () => {
      if (activeOwner.current !== owner) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
      const controller = new AbortController()
      requests.current.add(controller)
      try {
        const { response, body } = await fetchJsonWithDeadline(url, { cache: 'no-store', signal: controller.signal }, READ_TIMEOUT_MS)
        if (!response.ok) throw new Error(SITE_ACTION_COPY.updatesDisconnected)
        const view = readSiteHomeView(body, siteId)
        if (activeOwner.current !== owner || controller.signal.aborted || viewerScope(view) !== owner.viewerScope || (view.readScope ?? 'overview') !== owner.readScope) {
          throw new Error(SITE_ACTION_COPY.updatesDisconnected)
        }
        return view
      } finally { requests.current.delete(controller) }
    }).then(view => {
      if (activeOwner.current === owner && latestRead.current?.owner === owner && latestRead.current.promise === pending) {
        latestRead.current.pending = false
        setReadFailure(null)
      }
      return view
    }, error => {
      if (activeOwner.current === owner && latestRead.current?.owner === owner && latestRead.current.promise === pending) {
        latestRead.current.pending = false
        setReadFailure(owner)
      }
      throw error
    })
    if (activeOwner.current === owner) latestRead.current = { owner, promise: pending, pending: true }
    return pending
  }, [siteId, owner])
  const resource = useSWR<SiteHomeView>(cacheKey, async ([url]) => {
    const pending = read(url, { reusePending: true })
    try { return await pending }
    catch (error) {
      // SWR fences obsolete successes before publication, but not errors.
      // An obsolete background failure must take that discard path. Explicit
      // refresh callers still receive their own failure without waiting again.
      if (activeOwner.current === owner && latestRead.current?.owner === owner && latestRead.current.promise !== pending) return initial
      throw error
    }
  }, {
    fallbackData: initial,
    refreshInterval: (view) => {
      const current = newest(view)
      const guidancePending = [...current.flags, ...current.recommendations, ...current.resolvedFlags]
        .some(flag => flag.repairGuidance === 'pending')
      return guidancePending || current.activeRuns.length > 0 || current.outcomes.some(outcome => outcome.running) || (current.audit.status && !['COMPLETED', 'FAILED'].includes(current.audit.status)) ? 2500 : current.uptime?.enabled ? 60_000 : 0
    },
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  })
  const { mutate } = useSWRConfig()
  // Revalidation can resolve with retained data after its fetcher fails. An
  // action must await a validated read, with mutation ownership fencing older
  // in-flight reads, before reporting that the Site view was refreshed.
  const refresh = useCallback(() => mutate<SiteHomeView>(cacheKey, () => read(endpoint), { revalidate: false }), [mutate, read, endpoint, cacheKey])
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    let cursor = initial.executionProgress?.eventCursor
    let active = true
    let events: EventSource | null = null
    let reading = false, dirty = false, reconnectPending = false, connectionRevision = 0
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const available = () => active && activeOwner.current === owner && document.visibilityState !== 'hidden' && navigator.onLine !== false
    const pause = () => {
      const previous = events
      events = null
      clearTimeout(refreshTimer)
      refreshTimer = undefined
      dirty = false; reconnectPending = false
      previous?.close()
    }
    // Projection bursts share one read and at most one catch-up. New events
    // cannot postpone a scheduled read or multiply requests while it is pending.
    const schedule = (delay = 150) => {
      dirty = true
      if (reading || !events || !available()) return
      if (refreshTimer !== undefined) {
        if (delay > 0) return
        clearTimeout(refreshTimer)
      }
      refreshTimer = setTimeout(() => { refreshTimer = undefined; void catchUp() }, delay)
    }
    async function catchUp() {
      if (reading || !events || !available()) return
      const source = events, revision = connectionRevision, reconnected = reconnectPending
      reading = true; dirty = false; reconnectPending = false
      try {
        await refresh()
        if (!available() || events !== source || connectionRevision !== revision) return
        if (reconnected) {
          setStreamFailure(previous => previous === owner ? null : previous)
          updateObserver.current?.({ type: 'reconnected' })
        }
      } catch {
        // A stale catch-up cannot alter the current connection's state.
        if (reconnected && available() && events === source && connectionRevision === revision) setStreamFailure(owner)
      } finally {
        reading = false
        if (dirty) schedule()
      }
    }
    const connect = () => {
      if (!available()) { pause(); return }
      if (events) return
      const source = new EventSource(`/api/sites/${siteId}/events${cursor ? '?after=' + encodeURIComponent(cursor) : ''}`)
      events = source
      const current = () => available() && events === source
      source.addEventListener('projection', (event) => {
        if (!current()) return
        if (event instanceof MessageEvent && event.lastEventId) cursor = event.lastEventId
        schedule()
        const notice = readSiteProjectionNotice(event instanceof MessageEvent ? event.data : null)
        if (notice) updateObserver.current?.({ type: 'projection', notice })
      })
      source.addEventListener('open', () => {
        if (!current()) return
        connectionRevision++
        reconnectPending = true
        schedule(0)
      })
      const disconnected = () => {
        if (!current()) return
        connectionRevision++
        setStreamFailure(owner)
      }
      source.addEventListener('error', disconnected)
      source.addEventListener('disconnected', disconnected)
      source.addEventListener('access-expired', () => {
        if (!current()) return
        active = false
        setStreamFailure(owner)
        setReadFailure(owner)
        pause()
        void refresh().catch(() => { /* Retain dated evidence while access is unavailable. */ })
      })
    }
    document.addEventListener('visibilitychange', connect)
    window.addEventListener('online', connect)
    window.addEventListener('offline', connect)
    connect()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', connect)
      window.removeEventListener('online', connect)
      window.removeEventListener('offline', connect)
      pause()
    }
  }, [siteId, owner, initial.executionProgress?.eventCursor, refresh])
  const readUnavailable = readFailure === owner || Boolean(resource.error)
  return { view: newest(resource.data), disconnected: streamFailure === owner || readUnavailable, readUnavailable, refresh }
}
