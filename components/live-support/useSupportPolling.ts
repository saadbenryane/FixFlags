'use client'

import useSWR from 'swr'
import type { SupportMessageDto, SupportSessionDto } from '@/lib/live-support/types'

const jsonFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Request failed')
    return r.json()
  })

export function useSupportSession(enabled: boolean) {
  return useSWR<{ session: SupportSessionDto | null }>(
    enabled ? '/api/support/sessions' : null,
    jsonFetcher,
    { refreshInterval: 10000 }
  )
}

export function useSupportMessages(sessionId: string | null, panelOpen: boolean) {
  return useSWR<{ messages: SupportMessageDto[] }>(
    sessionId ? `/api/support/sessions/${sessionId}/messages` : null,
    jsonFetcher,
    { refreshInterval: panelOpen ? 2000 : 10000 }
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
