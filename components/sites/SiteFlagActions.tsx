'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export function SiteFlagActions({
  siteId,
  flagId,
  fixText,
  promptText,
  shareUrl,
}: {
  siteId: string
  flagId: string
  fixText: string
  promptText?: string | null
  shareUrl?: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  async function share() {
    const url =
      shareUrl ??
      (typeof window !== 'undefined' ? window.location.href : `/sites/${siteId}/flags/${flagId}`)
    const absolute =
      url.startsWith('http') || typeof window === 'undefined'
        ? url
        : new URL(url, window.location.origin).toString()
    await copyText(absolute, 'Flag link copied')
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
        <Button variant="outline" onClick={() => void copyPrompt()}>
          {SITE_BOARD_COPY.sendFlagToAi}
        </Button>
        <Button variant="outline" onClick={() => void copyFix()}>
          {SITE_BOARD_COPY.fixThis}
        </Button>
        <Button variant="outline" onClick={() => void share()}>
          {SITE_BOARD_COPY.share}
        </Button>
        <Button variant="brand" disabled={busy} onClick={() => void verify()}>
          {SITE_BOARD_COPY.verifyFix}
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
