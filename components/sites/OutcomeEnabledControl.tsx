'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy'

export function OutcomeEnabledControl({ siteId, outcomeId, enabled, running }: {
  siteId: string
  outcomeId: string
  enabled: boolean
  running: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function update() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/outcomes/${outcomeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string; verificationQueued?: boolean; verificationError?: string | null }
      if (!response.ok) {
        setMessage(body.error ?? 'Could not update this Outcome.')
        return
      }
      setMessage(enabled
        ? running ? 'Paused. The active verification will finish.' : 'Outcome paused.'
        : body.verificationQueued ? 'Outcome enabled. Fresh verification started.' : body.verificationError ?? 'Outcome enabled.')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button variant="outline" disabled={busy} onClick={() => void update()}>
        {enabled ? OUTCOME_DETAIL_COPY.pause : OUTCOME_DETAIL_COPY.enable}
      </Button>
      <p className="mt-2 max-w-md text-xs text-muted-foreground">{OUTCOME_DETAIL_COPY.pauseHelp}</p>
      {message ? <p className="mt-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  )
}
