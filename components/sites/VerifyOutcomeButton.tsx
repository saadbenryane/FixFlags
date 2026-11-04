'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export function VerifyOutcomeButton({
  siteId,
  outcomeId,
  disabled,
  running = false,
  onRefresh,
  onAccepted,
}: {
  siteId: string
  outcomeId: string
  disabled?: boolean
  running?: boolean
  onRefresh?: () => Promise<unknown>
  onAccepted?: () => void
}) {
  const router = useRouter()
  const { busy, message, error, submit, requestKey, completeIntent } = useSiteAction({ namespace: `site:${siteId}`, scope: `outcome:${outcomeId}` })

  async function verify() {
    const intent = `outcome:${outcomeId}`
    await submit(async signal => {
      const body = await executeSiteAction(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        signal,
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey(intent) },
      }, 'run')
      if (!body.outcomeIds.includes(outcomeId)) throw new SiteActionError(C.invalidResponse)
      return body
    }, () => { onAccepted?.(); completeIntent(intent); return C.outcome.started }, onRefresh ?? (() => router.refresh()))
  }

  return (
    <div className="mt-4">
      <Button variant="default" disabled={disabled || busy || running} onClick={() => void verify()}>
        {busy || running ? C.outcome.verifying : C.outcome.verify}
      </Button>
      <SiteActionFeedback message={message} error={error} siteId={siteId} />
    </div>
  )
}
