'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function SiteFlagActions({
  siteId,
  flagId,
  fixText,
}: {
  siteId: string
  flagId: string
  fixText: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function copyFix() {
    try {
      await navigator.clipboard.writeText(fixText)
      setMessage('Fix instructions copied')
      await fetch(`/api/sites/${siteId}/flags/${flagId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy' }),
      }).catch(() => {})
    } catch {
      setMessage('Select and copy the instructions above')
    }
  }

  async function verify() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/flags/${flagId}/verify`, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string; signup?: boolean }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}/flags/${flagId}`)}`)
        return
      }
      if (!res.ok) {
        setMessage(body.error || 'Could not start verification')
        return
      }
      setMessage('Verification started. This Flag stays open until the same page and action pass.')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copyFix()}>
          Copy fix instructions
        </Button>
        <Button variant="brand" disabled={busy} onClick={() => void verify()}>
          Verify fix
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
