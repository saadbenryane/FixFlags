'use client'

import useSWR from 'swr'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { SITE_SUMMARY_OWNER_HEADER, SITE_SUMMARY_READ_AT_HEADER, siteSummariesSchema } from '@/lib/sites/summary-contract'
import type { SiteSummary } from '@/lib/sites/application/list-sites'

export type SiteSummariesSnapshot = { ownerId: string; sites: SiteSummary[]; readAt: number }
type SummaryRead = { controller: AbortController; promise: Promise<SiteSummariesSnapshot> }
class SiteSummariesError extends Error {
  constructor(readonly status?: number, readonly accountChanged = false) { super('Site summaries unavailable') }
}

/** One account-wide read, with independent cache and request ownership per user. */
export function useSiteSummaries(ownerId: string | null, initial: SiteSummariesSnapshot) {
  const owner = useMemo(() => ({ id: ownerId, active: true, request: null as SummaryRead | null }), [ownerId])
  useLayoutEffect(() => {
    owner.active = true
    return () => { owner.active = false; owner.request?.controller.abort(); owner.request = null }
  }, [owner])
  const fallback = ownerId === initial.ownerId ? initial : undefined
  const newest = (data?: SiteSummariesSnapshot) => fallback && (!data || fallback.readAt > data.readAt) ? fallback : data
  const read = useCallback(([, expectedOwner]: readonly [string, string]): Promise<SiteSummariesSnapshot> => {
    if (!owner.active || owner.id !== expectedOwner) throw new SiteSummariesError()
    if (owner.request) return owner.request.promise
    const controller = new AbortController()
    const promise = fetchJsonWithDeadline('/api/sites', { cache: 'no-store', signal: controller.signal }, 15_000).then(({ response, body }) => {
      if (!response.ok) throw new SiteSummariesError(response.status)
      const actualOwner = response.headers.get(SITE_SUMMARY_OWNER_HEADER)
      if (actualOwner !== expectedOwner) throw new SiteSummariesError(undefined, Boolean(actualOwner))
      const stamp = response.headers.get(SITE_SUMMARY_READ_AT_HEADER), readAt = Number(stamp)
      if (stamp === null || !Number.isSafeInteger(readAt) || readAt < 0) throw new SiteSummariesError()
      const sites = siteSummariesSchema.parse(body)
      if (!owner.active || controller.signal.aborted) throw new SiteSummariesError()
      return { ownerId: expectedOwner, sites, readAt }
    }).finally(() => { if (owner.request?.controller === controller) owner.request = null })
    owner.request = { controller, promise }
    return promise
  }, [owner])
  const resource = useSWR<SiteSummariesSnapshot>(ownerId ? ['account-sites', ownerId] as const : null, read, {
    fallbackData: fallback,
    keepPreviousData: false,
    revalidateOnMount: !fallback || Math.abs(Date.now() - fallback.readAt) >= 15_000,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    refreshInterval: data => newest(data)?.sites.some(site => site.presentation.result.state === 'checking' ||
      ['queued', 'running'].includes(site.presentation.run.state)) ? 5000 : 60_000,
    shouldRetryOnError: error => !(error instanceof SiteSummariesError && (error.status === 401 || error.accountChanged)),
    errorRetryCount: 3,
    errorRetryInterval: 15_000,
  })
  const accountChanged = resource.error instanceof SiteSummariesError && resource.error.accountChanged
  const authRequired = !ownerId || resource.error instanceof SiteSummariesError && resource.error.status === 401
  const snapshot = newest(resource.data)
  const { mutate } = resource
  const refresh = useCallback(() => mutate().catch(() => undefined), [mutate])
  const entry = useRef({ error: resource.error, refresh })
  useLayoutEffect(() => { entry.current = { error: resource.error, refresh } }, [resource.error, refresh])
  // Retry a cached failure on entry or account change. Continuing failures
  // follow the bounded retry policy instead of creating a render-driven loop.
  useEffect(() => { if (entry.current.error) void entry.current.refresh() }, [owner])
  return { sites: !authRequired && !accountChanged && snapshot?.ownerId === ownerId ? snapshot.sites : null,
    failed: Boolean(resource.error), accountChanged, authRequired, refreshing: resource.isValidating,
    refresh }
}
