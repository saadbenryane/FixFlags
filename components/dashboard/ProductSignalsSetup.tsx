'use client'

import { useId, useState } from 'react'
import { Check, Copy, Radio, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ProductSignalKeyDTO } from '@/lib/products/workspace'

type CreatedSignalKey = ProductSignalKeyDTO & { key: string }

export function ProductSignalsSetup({
  productId,
  productUrl,
  initialKeys = [],
}: {
  productId: string
  productUrl: string
  initialKeys?: ProductSignalKeyDTO[]
}) {
  const copy = REPORT_COPY.workspace.dashboard
  const errorId = useId()
  const [snippet, setSnippet] = useState<string | null>(null)
  const [keys, setKeys] = useState(initialKeys)
  const [loading, setLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
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
        | (Partial<CreatedSignalKey> & { error?: string | { message?: string }; message?: string })
        | null
      if (
        !response.ok ||
        !payload?.key ||
        !payload.id ||
        !payload.name ||
        !payload.prefix ||
        !payload.lastFour ||
        !payload.allowedOrigin
      ) {
        const apiMessage = typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.message ?? payload?.message
        throw new Error(apiMessage || 'Could not create the browser snippet')
      }
      setSnippet(
        `<script async src="${window.location.origin}/fixflags.js" data-product="${productId}" data-key="${payload.key}"></script>`
      )
      setKeys((current) => [{
        id: payload.id!,
        name: payload.name!,
        prefix: payload.prefix!,
        lastFour: payload.lastFour!,
        allowedOrigin: payload.allowedOrigin!,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      }, ...current])
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

  async function revokeKey(keyId: string) {
    setRevokingId(keyId)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${productId}/signal-keys?keyId=${encodeURIComponent(keyId)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Could not revoke the Product Signal key')
      setKeys((current) => current.filter((key) => key.id !== keyId))
      setSnippet(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke the Product Signal key')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!snippet ? (
        <div className="space-y-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={createSnippet}
          disabled={loading}
          aria-describedby={error ? errorId : undefined}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
          {copy.addProductContext}
        </Button>
        <p className="max-w-xl text-xs text-muted-foreground">{copy.productContextBody}</p>
        </div>
      ) : (
        <div className="w-full space-y-2 rounded-[var(--radius-control)] border border-border/60 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{copy.productContextReady}</p>
          <code className="block overflow-x-auto whitespace-nowrap text-2xs">{snippet}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="outline" onClick={copySnippet}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : copy.copySnippet}
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setSnippet(null)}>
              Hide one-time key
            </Button>
          </div>
        </div>
      )}

      {error ? <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p> : null}

      {keys.length > 0 ? (
        <div className="space-y-2" aria-label="Product Signal keys">
          {keys.map((key) => (
            <div key={key.id} className="flex flex-col gap-3 rounded-nested-md bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-xs">
                <p className="font-medium text-foreground">{key.name}</p>
                <p className="mt-1 break-all font-mono text-muted-foreground">
                  {key.prefix}…{key.lastFour}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {key.lastUsedAt
                    ? `Receiving observations · Last accepted ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : 'Key created · Waiting for the first accepted observation'}
                </p>
                <p className="mt-1 truncate text-muted-foreground">Origin: {key.allowedOrigin}</p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="self-start text-destructive hover:text-destructive sm:self-center"
                disabled={revokingId === key.id}
                onClick={() => void revokeKey(key.id)}
                aria-describedby={error ? errorId : undefined}
              >
                {revokingId === key.id ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                Revoke
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Observations include routes without queries, error types, outcomes, and performance values.
        FixFlags does not collect DOM text, input values, request bodies, or identity. Raw Signals expire
        after 30 days and remain observational context, never verification evidence.
      </p>
    </div>
  )
}
