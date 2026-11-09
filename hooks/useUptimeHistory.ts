'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { uptimeHistorySchema } from '@/lib/uptime/contracts'
import type { UptimeHistory } from '@/lib/uptime/domain'
import { appendUptimeHistory, refreshUptimeHistory } from '@/lib/uptime/history-pages'

type Failure = 'refresh' | 'more' | null
type HistorySource = (window: UptimeHistory['window']) => UptimeHistory

/** One history owner per Site/target/window, with requests active only while open. */
export function useUptimeHistory(siteId: string, window: UptimeHistory['window'], open: boolean, source?: HistorySource, target?: string) {
  // Current status does not belong to a history period. Keep its latest server
  // receipt across period changes, scoped to the same Site, target and source.
  const context = useMemo(() => ({ siteId, target, source, latest: null as UptimeHistory | null }), [siteId, target, source])
  const owner = useMemo(() => ({ siteId: context.siteId, window, source: context.source, active: false,
    request: null as AbortController | null, data: null as UptimeHistory | null, error: null as Failure, restart: false }), [context, window])
  const [snapshot, setSnapshot] = useState({ owner, data: owner.data, loading: false, error: owner.error })
  useLayoutEffect(() => {
    owner.active = open
    return () => {
      owner.active = false
      const request = owner.request
      owner.request = null
      request?.abort()
    }
  }, [owner, open])
  const load = useCallback(async (kind: 'refresh' | 'more') => {
    if (!owner.active || owner.request) return
    const previous = owner.restart ? null : owner.data
    const cursor = kind === 'more' ? previous?.nextCursor : null
    if (kind === 'more' && !cursor) return
    const request = new AbortController()
    owner.request = request
    owner.error = null
    let failure: Exclude<Failure, null> = kind
    setSnapshot({ owner, data: owner.data, loading: true, error: null })
    try {
      let data: UptimeHistory
      if (owner.source) data = uptimeHistorySchema.parse(owner.source(owner.window))
      else {
        const read = (continuation?: string) => {
          const query = new URLSearchParams({ window: owner.window })
          if (continuation) query.set('cursor', continuation)
          return fetchJsonWithDeadline(`/api/sites/${encodeURIComponent(owner.siteId)}/uptime?${query}`,
            { cache: 'no-store', signal: request.signal }, 15_000)
        }
        let result = await read(cursor ?? undefined)
        if (cursor && result.response.status === 400 && owner.active && !request.signal.aborted && owner.request === request) {
          failure = 'refresh'
          owner.restart = true
          result = await read()
        }
        const { response, body } = result
        if (!response.ok || !body || typeof body !== 'object' || !('siteId' in body) || body.siteId !== owner.siteId) throw new Error('Uptime history unavailable')
        data = uptimeHistorySchema.parse(body)
      }
      if (data.window !== owner.window) throw new Error('Uptime history window changed')
      if (context.target && data.targetUrl !== context.target) throw new Error('Uptime history target changed')
      if (!owner.active || request.signal.aborted || owner.request !== request) return
      if (owner.restart) owner.data = data
      else if (kind === 'more' && previous) {
        failure = 'refresh'
        owner.data = appendUptimeHistory(previous, data)
      } else owner.data = refreshUptimeHistory(previous, data)
      owner.restart = false
      if (data.historyScope && (!context.latest || Date.parse(data.historyScope.through) >= Date.parse(context.latest.historyScope!.through))) context.latest = data
    } catch {
      if (owner.active && !request.signal.aborted && owner.request === request) owner.error = failure
    } finally {
      if (owner.request === request) {
        owner.request = null
        if (owner.active && !request.signal.aborted) setSnapshot({ owner,
          data: owner.restart && owner.data ? { ...owner.data, nextCursor: null } : owner.data, loading: false, error: owner.error })
      }
    }
  }, [owner, context])
  const refresh = useCallback(() => load('refresh'), [load])
  useEffect(() => {
    if (!open) return
    void load('refresh')
    if (source) return
    // Poll after settlement, so a slow request cannot accumulate more work.
    let timer: ReturnType<typeof setTimeout>
    let active = true
    const available = () => document.visibilityState !== 'hidden' && navigator.onLine !== false
    const resume = () => { if (available()) void load('refresh') }
    const poll = async () => {
      if (available()) await load('refresh')
      if (active) timer = setTimeout(() => void poll(), 60_000)
    }
    document.addEventListener('visibilitychange', resume)
    globalThis.window.addEventListener('online', resume)
    timer = setTimeout(() => void poll(), 60_000)
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      globalThis.window.removeEventListener('online', resume)
    }
  }, [owner, open, source, load])
  return { history: snapshot.owner === owner ? snapshot.data : null, latest: context.latest, refresh,
    loading: open && (snapshot.owner !== owner || snapshot.loading),
    error: snapshot.owner === owner && Boolean(snapshot.error),
    retry: () => load(owner.error === 'more' ? 'more' : 'refresh'), loadMore: () => load('more') }
}
