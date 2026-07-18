'use client'

import useSWR from 'swr'
import type { SupportMessageDto, SupportSessionDto } from '@/lib/live-support/types'

const jsonFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Request failed')
    return r.json()
  })

/**
 * @param enabled - When false, skip the request entirely.
 * @param poll - When true, refresh every 10s. When false, fetch once (idle homepage).
 */
export function useSupportSession(enabled: boolean, poll = false) {
  return useSWR<{ session: SupportSessionDto | null }>(
    enabled ? '/api/support/sessions' : null,
    jsonFetcher,
    {
      refreshInterval: poll ? 10000 : 0,
      revalidateOnFocus: poll,
    }
  )
}

export function useSupportMessages(sessionId: string | null, panelOpen: boolean) {
  return useSWR<{ messages: SupportMessageDto[] }>(
    sessionId && panelOpen ? `/api/support/sessions/${sessionId}/messages` : null,
    jsonFetcher,
    { refreshInterval: panelOpen ? 2000 : 0 }
  )
}

export function useAdminSupportSessions(filter: 'open' | 'closed' | 'all' = 'open') {
  return useSWR<{ sessions: SupportSessionDto[] }>(
    `/api/admin/support/sessions?filter=${filter}`,
    jsonFetcher,
    { refreshInterval: 2000 }
  )
}

export function useAdminSupportMessages(sessionId: string | null) {
  return useSWR<{ messages: SupportMessageDto[] }>(
    sessionId ? `/api/admin/support/sessions/${sessionId}/messages` : null,
    jsonFetcher,
    { refreshInterval: sessionId ? 2000 : 0 }
  )
}
