'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/hooks/useMe'

/** Claims cookie-stored anonymous audits via /api/me on mount. */
export function ClaimAnonymousAudits({ showToast = true }: { showToast?: boolean }) {
  const router = useRouter()
  const { claimedCount } = useMe({ claim: true, showClaimToast: showToast })
  const refreshedRef = useRef(false)

  useEffect(() => {
    if (claimedCount == null || claimedCount <= 0 || refreshedRef.current) return
    refreshedRef.current = true
    // SSR still rendered the pre-claim (locked) report; refresh so ownership + fixes unlock.
    router.refresh()
  }, [claimedCount, router])

  return null
}
