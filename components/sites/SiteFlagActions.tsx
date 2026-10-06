'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export function SiteFlagActions({
  siteId,
  flagId,
  fixText,
  promptText,
  verifying = false,
}: {
  siteId: string
  flagId: string
  fixText: string
  promptText?: string | null
  verifying?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [verificationRunning, setVerificationRunning] = useState(verifying)
  const [message, setMessage] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState('')

  useEffect(() => {
    setVerificationRunning(verifying)
  }, [verifying])

  useEffect(() => {
    if (!verificationRunning) return
    const timer = window.setInterval(() => router.refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [router, verificationRunning])

  async function recordCopy() {
    await fetch(`/api/sites/${siteId}/flags/${flagId}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy' }),
    }).catch(() => {})
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(success)
      await recordCopy()
    } catch {
      setMessage('Select and copy the instructions above')
    }
  }

  async function copyFix() {
    await copyText(fixText, 'Fix instructions copied')
  }

  async function copyPrompt() {
    await copyText(promptText?.trim() || fixText, 'Prompt copied')
  }

  async function verify() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/flags/${flagId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeSummary: changeSummary.trim() }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; signup?: boolean }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}/flags/${flagId}`)}`)
        return
      }
      if (!res.ok) {
        setMessage(body.message || body.error || SITE_BOARD_COPY.verificationFailed)
        return
      }
      setVerificationRunning(true)
      setMessage(SITE_BOARD_COPY.verificationStarted)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copyPrompt()}>
          {SITE_BOARD_COPY.sendFlagToAi}
        </Button>
        <Button variant="outline" onClick={() => void copyFix()}>
          {SITE_BOARD_COPY.fixThis}
        </Button>
      </div>
      <div className="space-y-1 pt-2">
        <label htmlFor="flag-change-summary" className="text-sm font-medium">
          {SITE_BOARD_COPY.changeLabel}
        </label>
        <p id="flag-change-summary-hint" className="text-xs text-muted-foreground">
          {SITE_BOARD_COPY.changeHint}
        </p>
        <Textarea
          id="flag-change-summary"
          aria-describedby="flag-change-summary-hint"
          value={changeSummary}
          onChange={(event) => setChangeSummary(event.target.value)}
          rows={2}
          placeholder={SITE_BOARD_COPY.changePlaceholder}
          className="mt-1"
        />
      </div>
      <Button
        variant="brand"
        disabled={busy || verificationRunning}
        onClick={() => void verify()}
      >
        {verificationRunning ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}
      </Button>
      {message ? <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p> : null}
    </div>
  )
}
