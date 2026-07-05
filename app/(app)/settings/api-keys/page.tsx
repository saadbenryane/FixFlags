'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { TextLink } from '@/components/ui/text-link'
import { Trash2, Plus, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { MCP_DOCS, BRAND } from '@/lib/marketing/copy'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface ApiKey {
  id: string
  name: string
  prefix: string
  lastFour: string
  lastUsed: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const { user, isLoading: meLoading } = useMe()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const canUseKeys = user?.entitlements?.canUseMcp ?? false

  useEffect(() => {
    if (meLoading) return
    fetch('/api/api-keys')
      .then(async (r) => {
        if (!r.ok) throw new Error((await parseApiErrorResponse(r)).message)
        return r.json()
      })
      .then((keyList) => {
        if (Array.isArray(keyList)) setKeys(keyList)
      })
      .catch(() => toast.error('Failed to load API keys'))
      .finally(() => setLoading(false))
  }, [meLoading])

  async function createKey() {
    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      const data = await res.json()
      setNewKey(data.key)
      setKeys((prev) => [{
        id: data.id,
        name: data.name,
        prefix: data.prefix,
        lastFour: data.lastFour,
        lastUsed: null,
        createdAt: new Date().toISOString(),
      }, ...prev])
      setNewKeyName('')
    } catch {
      toast.error('Could not create the key. Try again.')
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    if (!window.confirm('Delete this API key? Any integrations using it will stop working.')) return
    try {
      const response = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' })
      if (!response.ok) {
        toast.error((await parseApiErrorResponse(response)).message)
        return
      }
      setKeys((prev) => prev.filter((k) => k.id !== id))
      toast.success('API key revoked')
    } catch {
      toast.error('Could not revoke the API key. Try again.')
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-32 rounded bg-muted" />
        <Surface variant="flat" className="h-24" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Surface key={i} variant="flat" className="h-14" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="API Keys"
        description={`Use API keys to connect ${BRAND.name} to Claude Code, Cursor, or Windsurf via MCP.`}
      />

      {!canUseKeys && (
        <Card className="bg-brand/5 ring-2 ring-brand/25">
          <CardContent className="space-y-3 py-5">
            <p className="text-sm font-medium">{MCP_DOCS.builderRequired}</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro to generate API keys and audit from your editor.
            </p>
            <Button asChild size="sm">
              <TextLink href="/pricing">Upgrade to Pro</TextLink>
            </Button>
          </CardContent>
        </Card>
      )}

      {canUseKeys && newKey && (
        <Callout variant="success" title="API key created, copy it now, you won't see it again">
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded border bg-background px-3 py-2 font-mono text-xs">
              {newKey}
            </code>
            <Button size="icon" variant="outline" onClick={() => copyKey(newKey)} aria-label="Copy API key">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNewKey(null)}>
            Done
          </Button>
        </Callout>
      )}

      {canUseKeys && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Create new key</CardTitle>
            <CardDescription>Give it a name to remember where it&apos;s used</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                aria-label="API key name"
                name="api-key-name"
                autoComplete="off"
                placeholder="e.g. Claude Code"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createKey()}
              />
              <Button onClick={createKey} disabled={creating}>
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canUseKeys && (
        <div className="space-y-2">
          {keys.length === 0 ? (
            <EmptyState
              title="No API keys yet"
              description="Create a key above to connect FixFlags to Claude Code, Cursor, or Windsurf via MCP."
            />
          ) : (
            keys.map((key) => (
              <Surface key={key.id} variant="flat" className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{key.name}</div>
                  <code className="text-xs text-muted-foreground">
                    {key.prefix}…{key.lastFour}
                  </code>
                </div>
                {key.lastUsed && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Used {new Date(key.lastUsed).toLocaleDateString()}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteKey(key.id)}
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label={`Revoke ${key.name} API key`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Surface>
            ))
          )}
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        See the{' '}
        <TextLink href="/docs/mcp">MCP setup guide</TextLink>{' '}
        to connect your key to Claude Code, Cursor, or Windsurf.
      </div>
    </div>
  )
}
