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
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { SettingsSkeleton } from '@/components/settings/settings-skeleton'
import { createApiKey } from '@/lib/api/api-key-client'
import type { ApiKeyClient } from '@/lib/mcp/builders'

interface ApiKey {
  id: string
  name: string
  prefix: string
  lastFour: string
  client: ApiKeyClient | null
  lastUsed: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const { user, isLoading: meLoading } = useMe()
  const { confirm, confirmDialog } = useConfirm()
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
      const data = await createApiKey({
        name: newKeyName || 'Default',
        client: 'other',
      })
      setNewKey(data.key)
      setKeys((prev) => [{
        id: data.id,
        name: data.name,
        prefix: data.prefix,
        lastFour: data.lastFour,
        client: data.client,
        lastUsed: null,
        createdAt: new Date().toISOString(),
      }, ...prev])
      setNewKeyName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the key. Try again.')
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    const ok = await confirm({
      title: 'Delete this API key?',
      description: 'Any integrations using it will stop working.',
      confirmLabel: 'Delete key',
      destructive: true,
    })
    if (!ok) return
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
    return <SettingsSkeleton />
  }

  return (
    <Container variant="narrow" className="py-8 space-y-8">
      <PageHeader
        title="API Keys"
        description={`Use API keys to connect ${BRAND.name} to Cursor, Claude Code, Windsurf, Lovable, Bolt, or VS Code via MCP.`}
      />

      {!canUseKeys && (
        <Card variant="subtle" className="bg-brand/5">
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
        <Card variant="subtle">
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
              description="Create a key above to connect FixFlags to Cursor, Claude Code, Windsurf, Lovable, Bolt, or VS Code via MCP."
            />
          ) : (
            keys.map((key) => (
              <Surface key={key.id} variant="flat" className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{key.name}</div>
                  <code className="text-xs text-muted-foreground">
                    {key.prefix}…{key.lastFour}
                  </code>
                  {key.client ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {key.client}
                    </span>
                  ) : null}
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
        <TextLink href="/help/mcp">MCP setup guide</TextLink>{' '}
        to connect your key to Cursor, Claude Code, Windsurf, Lovable, Bolt, or VS Code.
      </div>
      {confirmDialog}
    </Container>
  )
}
