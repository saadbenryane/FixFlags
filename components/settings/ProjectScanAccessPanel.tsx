'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Callout } from '@/components/ui/callout'
import { Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface ScanAccessSummary {
  hasHttpBasic: boolean
  cookieCount: number
  headerKeys: string[]
  label: string | null
}

interface Props {
  projectId: string
  projectUrl: string
}

export function ProjectScanAccessPanel({ projectId, projectUrl }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [summary, setSummary] = useState<ScanAccessSummary | null>(null)
  const [label, setLabel] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cookieHeader, setCookieHeader] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/scan-access`)
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      const data = await res.json()
      setConfigured(Boolean(data.configured))
      setSummary(data.summary ?? null)
      setLabel(data.summary?.label ?? '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load scan access')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const cookies = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const eq = part.indexOf('=')
          if (eq <= 0) return null
          return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() }
        })
        .filter((c): c is { name: string; value: string } => Boolean(c))

      const scanAccess = {
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(username.trim() && password
          ? { httpBasic: { username: username.trim(), password } }
          : {}),
        ...(cookies.length ? { cookies } : {}),
      }

      const res = await fetch(`/api/projects/${projectId}/scan-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanAccess }),
      })
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      const data = await res.json()
      setConfigured(Boolean(data.configured))
      setSummary(data.summary ?? null)
      setPassword('')
      toast.success('Preview scan access saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save scan access')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/scan-access`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      setConfigured(false)
      setSummary(null)
      setUsername('')
      setPassword('')
      setCookieHeader('')
      toast.success('Preview scan access removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not clear scan access')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading preview access…
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-card border border-border/70 bg-card p-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <div>
          <p className="font-medium">Preview and staging access</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Paste a public preview URL (ngrok, Vercel preview, Cloudflare tunnel) for{' '}
            <span className="font-mono text-xs">{projectUrl}</span>. Add HTTP basic auth or a session
            cookie when the preview is protected.
          </p>
        </div>
      </div>

      {configured && summary ? (
        <Callout variant="success" title="Scan access configured">
          {summary.label ? `${summary.label}. ` : ''}
          {summary.hasHttpBasic ? 'HTTP basic auth on. ' : ''}
          {summary.cookieCount > 0 ? `${summary.cookieCount} cookie(s). ` : ''}
          Credentials are encrypted and never shown again.
        </Callout>
      ) : null}

      <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`scan-label-${projectId}`}>Label (optional)</Label>
          <Input
            id={`scan-label-${projectId}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Client staging handoff"
          />
        </div>
        <div>
          <Label htmlFor={`scan-user-${projectId}`}>HTTP basic username</Label>
          <Input
            id={`scan-user-${projectId}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor={`scan-pass-${projectId}`}>HTTP basic password</Label>
          <Input
            id={`scan-pass-${projectId}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={configured ? 'Leave blank to keep existing' : ''}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`scan-cookie-${projectId}`}>Session cookie</Label>
          <Input
            id={`scan-cookie-${projectId}`}
            value={cookieHeader}
            onChange={(e) => setCookieHeader(e.target.value)}
            placeholder="session=abc123; other=value"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" loading={saving} loadingLabel="Saving access…">
            Save access
          </Button>
          {configured ? (
            <Button type="button" variant="outline" disabled={saving} onClick={() => void handleClear()}>
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
