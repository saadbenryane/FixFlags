'use client'

import { useState } from 'react'
import { createSiteActionController, type SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

/** Submission ownership is synchronous, not dependent on the next React render. */
export function useSiteAction() {
  const [controller] = useState(createSiteActionController)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<SiteActionError | null>(null)

  async function submit<T>(mutation: () => Promise<T>, success: (data: T) => string | null,
    refresh?: () => Promise<unknown> | void) {
    if (controller.pending) return { kind: 'busy' as const }
    setBusy(true); setMessage(null); setError(null)
    try {
      const result = await controller.submit(mutation, refresh ? async () => refresh() : undefined,
        data => setMessage(success(data)))
      if (result.kind === 'refused') { setError(result.error); setMessage(result.error.message) }
      if (result.kind === 'saved_refresh_pending') setMessage(SITE_ACTION_COPY.refreshPending)
      return result
    } finally { setBusy(false) }
  }
  return { submit, busy, message, error, clearFeedback: () => { setMessage(null); setError(null) } }
}
