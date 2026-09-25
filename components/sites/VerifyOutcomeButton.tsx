'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function verify() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `web:${outcomeId}:${Date.now()}` },
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        setMessage(body.error ?? 'Could not start this verification')
        return
      }
      setMessage('Verification started')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <Button variant="brand" disabled={disabled || busy} onClick={() => void verify()}>
        {busy ? 'Verifying…' : 'Verify'}
      </Button>
      {message ? <p className="mt-2 text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  )
}
