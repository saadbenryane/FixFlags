'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy-barrel'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export type OutcomeEnabledReceipt = { enabled: boolean; verificationQueued: boolean }

export function OutcomeEnabledControl({ siteId, outcomeId, enabled, running, onRefresh, onAccepted }: {
  siteId: string
  outcomeId: string
  enabled: boolean
  running: boolean
  onRefresh?: () => Promise<unknown>
  onAccepted?: (receipt: OutcomeEnabledReceipt) => void
}) {
  const router = useRouter()
  const { busy, message, error, submit } = useSiteAction({ scope: JSON.stringify([siteId, outcomeId]) })

  async function update() {
    const nextEnabled = !enabled
    await submit(async signal => {
      const body = await executeSiteAction(`/api/sites/${siteId}/outcomes/${outcomeId}`, {
        signal,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      }, 'outcomeEnabled')
      if (body.outcome.id !== outcomeId || body.outcome.enabled !== nextEnabled) throw new SiteActionError(C.invalidResponse)
      return body
    }, body => {
      onAccepted?.({ enabled: body.outcome.enabled, verificationQueued: body.verificationQueued })
      return !body.outcome.enabled
        ? running ? C.outcome.pausedRunning : C.outcome.paused
        : body.verificationQueued ? C.outcome.enabledVerifying : body.verificationError ?? C.outcome.enabled
    },
      onRefresh ?? (() => router.refresh()))
  }

  return (
    <div className="min-w-0 max-w-full">
      <Button className="h-auto min-h-11 max-w-full whitespace-normal py-2" variant="outline" disabled={busy} onClick={() => void update()}>
        {enabled ? OUTCOME_DETAIL_COPY.pause : OUTCOME_DETAIL_COPY.enable}
      </Button>
      <p className="mt-2 max-w-md text-xs text-muted-foreground">{OUTCOME_DETAIL_COPY.pauseHelp}</p>
      <SiteActionFeedback message={message} error={error} siteId={siteId} />
    </div>
  )
}
