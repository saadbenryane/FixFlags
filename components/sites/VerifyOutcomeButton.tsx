'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, isSiteRunConflict, refreshAfterVerificationConflict, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export function VerifyOutcomeButton({
  siteId,
  outcomeId,
  disabled,
  running = false,
  siteCheckInProgress = false,
  onRefresh,
  onAccepted,
}: {
  siteId: string
  outcomeId: string
  disabled?: boolean
  running?: boolean
  siteCheckInProgress?: boolean
  onRefresh?: () => Promise<unknown>
  onAccepted?: () => void
}) {
  const router = useRouter()
  const { busy, message, error, submit, requestKey, completeIntent } = useSiteAction({ namespace: `site:${siteId}`, scope: `outcome:${outcomeId}` })
  const refresh = onRefresh ?? (() => router.refresh())
  const hideConflict = siteCheckInProgress && isSiteRunConflict(error)

  async function verify() {
    if (disabled || running || siteCheckInProgress) return
    const intent = `outcome:${outcomeId}`
    await submit(async signal => {
      const body = await executeSiteAction(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        signal,
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey(intent) },
      }, 'run').catch(error => refreshAfterVerificationConflict(error, signal, refresh))
      if (!body.outcomeIds.includes(outcomeId)) throw new SiteActionError(C.invalidResponse)
      return body
    }, () => { onAccepted?.(); completeIntent(intent); return C.outcome.started }, refresh)
  }

  return (
    <div className="mt-4">
      <Button variant="default" disabled={disabled || busy || running || siteCheckInProgress} onClick={() => void verify()}>
        {busy || running ? C.outcome.verifying : C.outcome.verify}
      </Button>
      {siteCheckInProgress && !running ? <p role="status" className="mt-2 text-sm text-muted-foreground">{C.outcome.blockedByRun}</p> : null}
      <SiteActionFeedback message={hideConflict ? null : message} error={hideConflict ? null : error} siteId={siteId} />
    </div>
  )
}
