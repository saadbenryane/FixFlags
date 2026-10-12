'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export function VerifyOutcomeButton({
  siteId,
  outcomeId,
  disabled,
}: {
  siteId: string
  outcomeId: string
  disabled?: boolean
}) {
  const router = useRouter()
  const { busy, message, error, submit, requestKey, completeIntent } = useSiteAction(`site:${siteId}`)

  async function verify() {
    const intent = `outcome:${outcomeId}`
    const result = await submit(() => executeSiteAction(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey(intent) },
      }, 'run'), () => C.outcome.started, () => router.refresh())
    if (result.kind === 'saved' || result.kind === 'saved_refresh_pending') completeIntent(intent)
  }

  return (
    <div className="mt-4">
      <Button variant="default" disabled={disabled || busy} onClick={() => void verify()}>
        {busy ? C.outcome.verifying : C.outcome.verify}
      </Button>
      <SiteActionFeedback message={message} error={error} siteId={siteId} />
    </div>
  )
}
