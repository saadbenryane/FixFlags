'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/** Refresh server-rendered detail once for each available source publication. */
export function useSiteDetailRefresh(scope: string, baseline: string, revision: string, unavailable: boolean) {
  const router = useRouter()
  const requested = useRef<string | null>(null)
  useEffect(() => {
    if (baseline === revision) { requested.current = null; return }
    if (unavailable) return
    const publication = JSON.stringify([scope, baseline, revision])
    if (requested.current === publication) return
    requested.current = publication
    router.refresh()
  }, [scope, baseline, revision, unavailable, router])
}
