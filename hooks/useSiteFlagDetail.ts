'use client'

import useSWR from 'swr'
import { fetchSiteAction } from '@/lib/sites/client-actions'
import { siteFlagPanelSchema } from '@/lib/sites/flag-panel'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'

const READ_TIMEOUT_MS = 15_000

/** Evidence reads are keyed by identity and lifecycle, independently of dialog state. */
export function useSiteFlagDetail(siteId: string, flagId: string | null, revision: string) {
  const identity = `${siteId}:${flagId}`
  const resource = useSWR(flagId ? ['site-flag', siteId, flagId, revision] as const : null,
    async ([, requestedSite, requestedFlag, requestedRevision]) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
      try {
        const response = await fetchSiteAction(`/api/sites/${encodeURIComponent(requestedSite)}/flags/${encodeURIComponent(requestedFlag)}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(C.flagUnavailable)
        const data = siteFlagPanelSchema.parse(await response.json())
        if (data.flag.id !== requestedFlag && data.flag.sourceFlagId !== requestedFlag) throw new Error(C.flagUnavailable)
        return { identity: `${requestedSite}:${requestedFlag}`, revision: requestedRevision, data }
      } finally { clearTimeout(timer) }
    }, { keepPreviousData: true, shouldRetryOnError: false })
  const recorded = resource.data?.identity === identity ? resource.data : null
  return { data: recorded?.data ?? null, failed: Boolean(resource.error),
    stale: Boolean(recorded && recorded.revision !== revision), refreshing: resource.isValidating,
    retry: () => resource.mutate() }
}
