'use client'

import { useMe } from '@/hooks/useMe'

/** Claims cookie-stored anonymous audits via /api/me on mount. */
export function ClaimAnonymousAudits({ showToast = true }: { showToast?: boolean }) {
  useMe({ claim: true, showClaimToast: showToast })
  return null
}
