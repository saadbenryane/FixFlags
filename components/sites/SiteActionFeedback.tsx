'use client'

import { Button } from '@/components/ui/button'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { siteContinuationHref, type SiteActionAvailability } from '@/lib/sites/viewer-actions'
import type { SiteActionError } from '@/lib/sites/client-actions'

export function SiteActionFeedback({ message, error, siteId, availability = 'sign_in' }: {
  message: string | null; error: SiteActionError | null; siteId: string; availability?: SiteActionAvailability
}) {
  const next = typeof window === 'undefined' ? `/sites/${siteId}`
    : window.location.pathname + window.location.search + window.location.hash
  return <>
    {message ? <p className="mt-2 text-sm text-muted-foreground" role={error ? 'alert' : 'status'}>{message}</p> : null}
    {error?.status === 401 || error?.status === 403 && (error.code === 'SITE_CLAIM_REQUIRED' || error.message === 'Claim this Site first.') ? <Button asChild variant="outline" className="mt-2">
      <a href={siteContinuationHref(error.status === 401 || availability !== 'claim' ? 'sign_in' : 'claim', next)}>{error.status === 401 ? SITE_ACTION_COPY.signInAction : availability === 'claim' ? SITE_ACTION_COPY.access.claim : SITE_ACTION_COPY.access.signIn}</a>
    </Button> : null}
  </>
}
