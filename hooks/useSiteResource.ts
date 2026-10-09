'use client'

import useSWR from 'swr'
import type { SiteHomeView } from '@/lib/sites/application/queries'

export function useSiteResource(siteId: string, initial: SiteHomeView) {
  const resource = useSWR<SiteHomeView>(`/api/sites/${siteId}`, async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Updates disconnected. Your last recorded evidence is still shown.')
    return response.json()
  }, {
    fallbackData: initial,
    refreshInterval: (view) => view?.audit.status && !['COMPLETED', 'FAILED'].includes(view.audit.status) ? 2500 : 0,
    revalidateOnFocus: true,
  })
  return { view: resource.data ?? initial, disconnected: Boolean(resource.error), refresh: resource.mutate }
}
