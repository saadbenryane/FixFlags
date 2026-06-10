'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Trash2, Plus, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  key: string
  lastUsed: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/api-keys')
      .then((r) => r.json())
      .then(setKeys)
      .catch(() => toast.error('Failed to load API keys'))
  }, [])

  async function createKey() {
    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create key')
        return
      }
      setNewKey(data.key)
      setKeys((prev) => [...prev, { ...data, key: `qos_live_...${data.key.slice(-4)}` }])
      setNewKeyName('')
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' })
    setKeys((prev) => prev.filter((k) => k.id !== id))
    toast.success('API key deleted')
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use API keys to connect QualityOS to Claude Code, Cursor, or Windsurf via MCP.
        </p>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-sm font-medium text-green-800">
            API key created — copy it now, you won&apos;t see it again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border rounded px-3 py-2 font-mono break-all">
              {newKey}
            </code>
            <Button size="sm" variant="outline" onClick={() => copyKey(newKey)}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNewKey(null)}>
            Done
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create new key</CardTitle>
          <CardDescription>Give it a name to remember where it&apos;s used</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Claude Code"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
            />
            <Button onClick={createKey} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No API keys yet</p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{key.name}</div>
                <code className="text-xs text-muted-foreground">{key.key}</code>
              </div>
              {key.lastUsed && (
                <span className="text-xs text-muted-foreground shrink-0">
                  Used {new Date(key.lastUsed).toLocaleDateString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteKey(key.id)}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        See the{' '}
        <a href="/docs/mcp" className="text-primary hover:underline">
          MCP setup guide
        </a>{' '}
        to connect your key to Claude Code, Cursor, or Windsurf.
      </div>
    </div>
  )
}
