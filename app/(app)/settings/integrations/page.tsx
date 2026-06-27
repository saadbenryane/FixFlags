'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TextLink } from '@/components/ui/text-link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { Checkbox } from '@/components/ui/checkbox'
import { Github, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface GithubRepo {
  fullName: string
  private: boolean
}

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'GitHub integration is not configured on this deployment.',
  upgrade_required: 'Codebase scanning requires the Max plan.',
  invalid_state: 'That GitHub connection link expired. Please try connecting again.',
  connect_failed: 'Could not connect to GitHub. Please try again.',
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPageContent />
    </Suspense>
  )
}

function IntegrationsPageContent() {
  const { user, isLoading: meLoading } = useMe()
  const searchParams = useSearchParams()

  const [connected, setConnected] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const canScan = user?.entitlements?.canScanRepositories ?? false

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) toast.error(ERROR_MESSAGES[error] ?? 'Something went wrong connecting GitHub.')
    if (searchParams.get('connected')) toast.success('GitHub connected')
  }, [searchParams])

  useEffect(() => {
    if (meLoading || !canScan) {
      setLoading(false)
      return
    }
    fetch('/api/integrations/github/repos')
      .then(async (r) => {
        if (r.status === 409) {
          setConnected(false)
          return null
        }
        if (!r.ok) throw new Error((await parseApiErrorResponse(r)).message)
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setConnected(true)
        setRepos(data.repos ?? [])
        setSelected(new Set(data.selectedRepos ?? []))
        setGithubLogin(data.githubLogin ?? null)
      })
      .catch(() => toast.error('Failed to load GitHub repositories'))
      .finally(() => setLoading(false))
  }, [meLoading, canScan])

  const sortedRepos = useMemo(
    () => [...repos].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [repos]
  )

  function toggleRepo(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  async function saveSelection() {
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/github/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: [...selected] }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      toast.success('Allow-listed repositories updated')
    } catch {
      toast.error('Could not save your selection. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect GitHub? This revokes access and stops all repo scans.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/github/disconnect', { method: 'POST' })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      setConnected(false)
      setRepos([])
      setSelected(new Set())
      toast.success('GitHub disconnected')
    } catch {
      toast.error('Could not disconnect GitHub. Try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (meLoading || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-32 rounded bg-muted" />
        <Surface variant="flat" className="h-24" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect GitHub to scan your codebase for issues, not just live URLs."
      />

      {!canScan && (
        <Card className="bg-brand/5 ring-2 ring-brand/25">
          <CardContent className="space-y-3 py-5">
            <p className="text-sm font-medium">Codebase scanning is a Max plan feature.</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Max to connect GitHub and scan your repositories for exposed secrets,
              dependency hygiene issues, and dangerous code patterns.
            </p>
            <Button asChild size="sm">
              <TextLink href="/pricing">Upgrade to Max</TextLink>
            </Button>
          </CardContent>
        </Card>
      )}

      {canScan && !connected && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Connect GitHub</CardTitle>
            <CardDescription>
              We request the standard OAuth &quot;repo&quot; scope, which can read any repo you have
              access to. We only ever scan the repositories you explicitly allow-list below, and
              you can disconnect and revoke access at any time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/integrations/github/connect">
                <Github className="mr-2 h-4 w-4" />
                Connect GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {canScan && connected && (
        <>
          <Card className="border-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">GitHub connected</CardTitle>
                <CardDescription>{githubLogin ? `Signed in as ${githubLogin}` : null}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Allow-listed repositories</CardTitle>
              <CardDescription>
                Only checked repositories will ever be cloned or scanned, even though the GitHub
                token can see more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedRepos.length === 0 ? (
                <EmptyState
                  title="No repositories found"
                  description="We couldn't find any repositories for this GitHub account."
                />
              ) : (
                <div className="max-h-96 space-y-1 overflow-y-auto">
                  {sortedRepos.map((repo) => (
                    <label
                      key={repo.fullName}
                      className="flex items-center gap-3 rounded px-2 py-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selected.has(repo.fullName)}
                        onCheckedChange={() => toggleRepo(repo.fullName)}
                      />
                      <span className="text-sm">{repo.fullName}</span>
                      {repo.private && (
                        <span className="text-xs text-muted-foreground">private</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              <Button onClick={saveSelection} disabled={saving || sortedRepos.length === 0}>
                Save selection
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
