'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createApiKey, type CreatedApiKey } from '@/lib/api/api-key-client'
import type { ApiKeyClient } from '@/lib/mcp/builders'

interface ApiKeySummary {
  id: string
  name: string
  prefix: string
  lastFour: string
  client: ApiKeyClient | null
  lastUsed: string | null
  createdAt: string
}

const CLIENTS: Array<{ value: ApiKeyClient; label: string }> = [
  { value: 'codex', label: 'Codex' },
  { value: 'claudeCode', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'windsurf', label: 'Windsurf' },
  { value: 'cli', label: 'FixFlags CLI' },
  { value: 'other', label: 'Another MCP client' },
]

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [name, setName] = useState('My coding agent')
  const [client, setClient] = useState<ApiKeyClient>('codex')
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')

  async function loadKeys() {
    const response = await fetch('/api/api-keys')
    if (!response.ok) throw new Error('Could not load developer keys.')
    setKeys((await response.json()) as ApiKeySummary[])
  }

  useEffect(() => {
    void loadKeys()
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load developer keys.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setCreated(null)
    try {
      const next = await createApiKey({ name, client })
      setCreated(next)
      await loadKeys()
      setMessage('Key created. Copy it now. FixFlags will not show it again.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create a key.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.key)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setMessage('Copy was blocked by this browser. Select the key above to copy it manually.')
    }
  }

  async function handleRevoke(id: string) {
    setMessage('')
    try {
      const response = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not revoke this key.')
      setKeys((current) => current.filter((key) => key.id !== id))
      setMessage('Key revoked.')
    } catch {
      setMessage('Could not revoke this key.')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <label htmlFor="api-key-name" className="space-y-2 text-sm font-medium">
          Key name
          <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </label>
        <label htmlFor="api-key-client" className="space-y-2 text-sm font-medium">
          Client
          <select
            id="api-key-client"
            value={client}
            onChange={(event) => setClient(event.target.value as ApiKeyClient)}
            className="flex h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {CLIENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={submitting} className="min-h-11">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <KeyRound className="mr-2 h-4 w-4" aria-hidden />}
          Create key
        </Button>
      </form>

      {created ? (
        <div className="rounded-card border border-brand/30 bg-brand-muted p-4">
          <p className="text-sm font-medium">Copy this key now</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-[var(--radius-control)] bg-background px-3 py-3 text-sm">{created.key}</code>
            <Button type="button" variant="outline" onClick={() => void handleCopy()} className="min-h-11">
              {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{message}</p>

      <div>
        <h2 className="text-base font-semibold">Active keys</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No active keys.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-card border border-border/60">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {key.prefix}…{key.lastFour} · {key.client ?? 'MCP'} · {key.lastUsed ? `Last used ${new Date(key.lastUsed).toLocaleDateString()}` : 'Never used'}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void handleRevoke(key.id)} className="min-h-11 sm:self-center">
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
