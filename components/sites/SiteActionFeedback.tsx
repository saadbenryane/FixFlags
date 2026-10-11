'use client'

import { Button } from '@/components/ui/button'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteActionError } from '@/lib/sites/client-actions'

export function SiteActionFeedback({ message, error, siteId }: {
  message: string | null; error: SiteActionError | null; siteId: string
}) {
  const next = typeof window === 'undefined' ? `/sites/${siteId}`
    : window.location.pathname + window.location.search + window.location.hash
  return <>
    {message ? <p className="mt-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
    {error?.status === 401 ? <Button asChild variant="outline" className="mt-2">
      <a target="_blank" rel="noopener noreferrer" href={`/sign-in?next=${encodeURIComponent(next)}`}>{SITE_ACTION_COPY.signInAction}</a>
    </Button> : null}
  </>
}
