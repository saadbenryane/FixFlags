'use client'

import { useState } from 'react'
import { Check, Copy, Radio, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REPORT_COPY } from '@/lib/marketing/copy'

export function ProductSignalsSetup({ productId, productUrl }: { productId: string; productUrl: string }) {
  const copy = REPORT_COPY.workspace.dashboard
  const [snippet, setSnippet] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createSnippet() {
    setLoading(true)
    setError(null)
    try {
      const allowedOrigin = new URL(productUrl).origin
      const response = await fetch(`/api/projects/${productId}/signal-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Browser snippet', allowedOrigin }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { key?: string; error?: { message?: string } }
        | null
      if (!response.ok || !payload?.key) {
        throw new Error(payload?.error?.message || 'Could not create the browser snippet')
      }
      setSnippet(
        `<script async src="${window.location.origin}/fixflags.js" data-product="${productId}" data-key="${payload.key}"></script>`
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the browser snippet')
    } finally {
      setLoading(false)
    }
  }

  async function copySnippet() {
    if (!snippet) return
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (!snippet) {
    return (
      <div className="space-y-1.5">
        <Button type="button" size="sm" variant="outline" onClick={createSnippet} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
          {copy.addProductContext}
        </Button>
        <p className="max-w-xs text-xs text-muted-foreground">{error || copy.productContextBody}</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-2 rounded-[var(--radius-control)] border border-border/60 bg-muted/20 p-3 sm:max-w-xl">
      <p className="text-xs text-muted-foreground">{copy.productContextReady}</p>
      <code className="block overflow-x-auto whitespace-nowrap text-2xs">{snippet}</code>
      <Button type="button" size="xs" variant="outline" onClick={copySnippet}>
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? 'Copied' : copy.copySnippet}
      </Button>
    </div>
  )
}
