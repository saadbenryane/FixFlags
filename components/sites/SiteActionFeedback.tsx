'use client'

import { Button } from '@/components/ui/button'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { siteContinuationHref, type SiteActionAvailability } from '@/lib/sites/viewer-actions'
import type { SiteActionError } from '@/lib/sites/client-actions'

type RecoveryProps = { error: SiteActionError | null; siteId: string; availability?: SiteActionAvailability }

export function SiteActionFeedback({ message, ...recovery }: RecoveryProps & { message: string | null }) {
  const feedback = recovery.error?.message ?? message
  return <>
    {feedback ? <p className="mt-2 text-sm text-muted-foreground" role={recovery.error ? 'alert' : 'status'}>{feedback}</p> : null}
    <SiteActionRecovery {...recovery} />
  </>
}

/** Recovery controls can accompany a message already owned by the Site shell. */
export function SiteActionRecovery({ error, siteId, availability = 'sign_in' }: RecoveryProps) {
  const next = typeof window === 'undefined' ? `/sites/${siteId}`
    : window.location.pathname + window.location.search + window.location.hash
  return <>
    {error?.status === 401 || error?.status === 403 && (error.code === 'SITE_CLAIM_REQUIRED' || error.message === 'Claim this Site first.') ? <Button asChild variant="outline" className="mt-2">
      <a href={siteContinuationHref(error.status === 401 || availability !== 'claim' ? 'sign_in' : 'claim', next)}>{error.status === 401 ? SITE_ACTION_COPY.signInAction : availability === 'claim' ? SITE_ACTION_COPY.access.claim : SITE_ACTION_COPY.access.signIn}</a>
    </Button> : null}
  </>
}
