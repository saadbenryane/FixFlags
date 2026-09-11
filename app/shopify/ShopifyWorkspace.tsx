'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/brand/Logo'
import type { ShopifyWorkspace as Workspace } from '@/lib/shopify/workspace'
import { INTEGRITY_WAITLIST_FEATURES } from '@/lib/shopify/waitlist-features'
import { BRAND } from '@/lib/marketing/copy'

type Surface = 'overview' | 'path' | 'understand' | 'improve' | 'settings'

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> }
  }
}

async function shopifyRequest(
  path: string,
  fixtureToken: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const token = fixtureToken ?? (await window.shopify?.idToken())
  if (!token) throw new Error('Shopify session is not ready')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(path, { ...init, headers })
}

function healthClass(health: Workspace['storeHealth']): string {
  if (health === 'GREEN') return 'text-success'
  if (health === 'RED') return 'text-destructive'
  return 'text-muted-foreground'
}

export function ShopifyWorkspace({
  workspace,
  fixtureToken,
}: {
  workspace: Workspace
  fixtureToken: string | null
}) {
  const router = useRouter()
  const [surface, setSurface] = useState<Surface>('overview')
  const [pathId, setPathId] = useState(workspace.paths[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(workspace.waitlist)
  const [slackUrl, setSlackUrl] = useState('')
  const [slackSaved, setSlackSaved] = useState(workspace.shop.hasSlack)

  const path = workspace.paths.find((entry) => entry.id === pathId) ?? workspace.paths[0] ?? null

  useEffect(() => {
    void shopifyRequest('/api/shopify/session', fixtureToken, { method: 'POST' }).catch(() => {})
  }, [fixtureToken])

  useEffect(() => {
    if (!workspace.walking) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [workspace.walking, router])

  async function recheck() {
    if (!path) return
    setError(null)
    setBusy(true)
    try {
      const response = await shopifyRequest('/api/shopify/recheck', fixtureToken, {
        method: 'POST',
        body: JSON.stringify({ pathId: path.id }),
      })
      if (response.status === 429) {
        setError('Daily recheck limit reached.')
        return
      }
      if (!response.ok) {
        setError('Could not start a recheck.')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function joinWaitlist(featureKey: string) {
    const response = await shopifyRequest('/api/integrity/waitlist', fixtureToken, {
      method: 'POST',
      body: JSON.stringify({ featureKey, email: workspace.shop.email }),
    })
    if (!response.ok) {
      setError('Could not join the waitlist.')
      return
    }
    setJoined((current) => Array.from(new Set([...current, featureKey])))
  }

  async function saveSlack(event: React.FormEvent) {
    event.preventDefault()
    const response = await shopifyRequest('/api/shopify/slack', fixtureToken, {
      method: 'POST',
      body: JSON.stringify({ webhookUrl: slackUrl }),
    })
    if (!response.ok) {
      setError('Paste a Slack incoming webhook URL.')
      return
    }
    setSlackSaved(true)
    setSlackUrl('')
  }

  function openPath(id: string) {
    setPathId(id)
    setSurface('path')
  }

  const nav: Array<{ id: Surface; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'path', label: 'Path' },
    { id: 'understand', label: 'Understand' },
    { id: 'improve', label: 'Improve' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo variant="lockup" size="sm" />
          <p className="text-sm text-muted-foreground">{workspace.shop.name ?? workspace.shop.shopDomain}</p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {workspace.rechecksRemaining} rechecks left today
        </p>
      </header>

      <Card className="border-border/80 bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">Shopify is a connection</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Purchase-path walks stay available here. Can&apos;t buy becomes a Flag on the matching Site,
          same Home · Flags as a URL you Analyze. Hostname alone never claims a Site.
        </p>
      </Card>

      <nav aria-label="App sections" className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Button
            key={item.id}
            variant={surface === item.id ? 'brand' : 'outline'}
            size="sm"
            onClick={() => setSurface(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {surface === 'overview' ? (
        <section className="space-y-4">
          <h1 className={`font-display text-3xl font-bold tracking-display ${healthClass(workspace.storeHealth)}`}>
            {workspace.storeHeadline}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            FixFlags walks the purchase path on a phone-sized browser and stops before payment. RED is
            confirmed twice. Unclear stays in the app, not in email. This remains install plumbing until
            the walk feeds the same Site Flags.
          </p>
          {workspace.emptyCatalog ? (
            <Card className="p-5">
              <p className="font-medium">No buyable product was found yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish an active product with a storefront URL and we will walk it.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {workspace.paths.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openPath(entry.id)}
                  className="rounded-card p-4 text-left shadow-card"
                >
                  <p className={`font-mono text-xs font-semibold ${healthClass(entry.health)}`}>
                    {entry.walking ? 'Walking' : entry.healthLabel}
                  </p>
                  <p className="mt-3 font-display text-lg font-semibold">{entry.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.reasonLabel}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {surface === 'path' && !path ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Watch verification</h2>
          <p className="text-sm text-muted-foreground">
            No buyable product was found yet. Publish an active product with a storefront URL and we
            will walk it.
          </p>
        </section>
      ) : null}

      {surface === 'path' && path ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Watch verification</h2>
              <Button variant="outline" size="sm" disabled={busy || workspace.rechecksRemaining <= 0} onClick={() => void recheck()}>
                {busy ? 'Walking…' : 'Recheck'}
              </Button>
            </div>
            {path.videoUrl ? (
              // Storefront walk recordings do not ship captions; the walk label is adjacent.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="w-full rounded-nested-md bg-black" src={path.videoUrl} controls playsInline />
            ) : path.gifUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Video was not recorded. This GIF is the walk FixFlags ran.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={path.gifUrl} alt={`Walk of ${path.label}`} className="w-full rounded-nested-md" />
              </div>
            ) : path.screenshotUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This walk has screenshots. Video was not recorded.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={path.screenshotUrl} alt={`Last capture of ${path.label}`} className="w-full rounded-nested-md" />
              </div>
            ) : path.walking ? (
              <p className="text-sm text-muted-foreground">
                First walk is in progress. Video appears when the path is verified.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No video or screenshots for this walk yet. Recheck to capture proof.
              </p>
            )}
          </Card>
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold">{path.label}</h2>
            <ol className="space-y-3">
              {(path.runs[0]?.steps ?? []).map((step) => (
                <li key={step.label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{step.title}</span>
                  <span className={`font-mono text-xs ${step.failed ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {step.failed ? 'failed' : 'checked'}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}

      {surface === 'understand' && !path ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Where the walk went</h2>
          <p className="text-sm text-muted-foreground">
            Steps appear after the first walk. Store-wide conversion numbers wait for approved
            reports access. We never invent percentages.
          </p>
        </section>
      ) : null}

      {surface === 'understand' && path ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Where the walk went</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            These are steps FixFlags verified. Store-wide conversion numbers appear when reports access
            is approved.
          </p>
          <ol className="space-y-3">
            {(path.runs[0]?.steps ?? []).map((step) => (
              <li key={step.label} className="rounded-card p-4 shadow-card">
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {step.failed ? 'This is where the walk failed.' : 'Verified on the last walk.'}
                </p>
              </li>
            ))}
          </ol>
          {joined.includes('funnel_analytics') ? (
            <p className="text-sm">You are on the funnel waitlist.</p>
          ) : (
            <Button variant="outline" onClick={() => void joinWaitlist('funnel_analytics')}>
              Join funnel numbers waitlist
            </Button>
          )}
        </section>
      ) : null}

      {surface === 'improve' ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Improve</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A short secondary list. It never goes in email or Slack.
          </p>
          {(path?.improve.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No Improve items yet. They appear after a GREEN walk.</p>
          ) : (
            <div className="space-y-3">
              {path?.improve.map((item) => (
                <Card key={item.id} className="p-4">
                  <p className="font-mono text-xs uppercase tracking-label text-brand">{item.group}</p>
                  <p className="mt-2 font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {surface === 'settings' ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold">Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Email goes to {workspace.shop.email ?? 'the store owner'} when a path turns RED, and again
              when it recovers. Optional Slack uses an incoming webhook.
            </p>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void saveSlack(event)}>
              <Input
                type="url"
                value={slackUrl}
                onChange={(event) => setSlackUrl(event.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                aria-label="Slack incoming webhook URL"
              />
              <Button type="submit" variant="outline">
                {slackSaved ? 'Update Slack' : 'Save Slack'}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">Support: {BRAND.supportEmail}</p>
          </Card>
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold">Pro waitlist</h2>
            <div className="grid gap-3">
              {INTEGRITY_WAITLIST_FEATURES.map((feature) => {
                const onList = joined.includes(feature.key)
                return (
                  <div key={feature.key} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{feature.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={onList} onClick={() => void joinWaitlist(feature.key)}>
                      {onList ? 'Joined' : 'Join'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
