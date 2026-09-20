'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/brand/Logo'
import type { ShopifyWorkspace as Workspace } from '@/lib/shopify/workspace'

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> }
  }
}

export async function shopifyRequest(
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

function HealthIcon({ health }: { health: Workspace['storeHealth'] }) {
  if (health === 'GREEN') return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
  if (health === 'RED') return <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
  return <CircleDashed className="h-5 w-5 text-muted-foreground" aria-hidden />
}

export function ShopifyWorkspace({
  workspace,
  fixtureToken,
  onRefresh,
}: {
  workspace: Workspace
  fixtureToken: string | null
  onRefresh?: () => Promise<void>
}) {
  const [busyPathId, setBusyPathId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace.walking) return
    const timer = setInterval(() => void onRefresh?.(), 4000)
    return () => clearInterval(timer)
  }, [workspace.walking, onRefresh])

  async function recheck(pathId: string) {
    setBusyPathId(pathId)
    setError(null)
    try {
      const response = await shopifyRequest('/api/shopify/recheck', fixtureToken, {
        method: 'POST',
        body: JSON.stringify({ pathId }),
      })
      if (response.status === 429) setError('Manual checks are temporarily rate-limited. Your scheduled Watch is unchanged.')
      else if (!response.ok) setError('FixFlags could not start this check. Try again.')
      else await onRefresh?.()
    } finally {
      setBusyPathId(null)
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo variant="lockup" size="sm" />
          <span className="text-sm text-muted-foreground">Shopify connection</span>
        </div>
        {workspace.siteId ? (
          <Button asChild size="sm">
            <Link href={`/sites/${workspace.siteId}`} target="_top">
              Open Site <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </header>

      <Card className="space-y-4 p-5 sm:p-6" aria-live="polite">
        <div className="flex items-start gap-3">
          <HealthIcon health={workspace.storeHealth} />
          <div>
            <p className="text-sm text-muted-foreground">
              {workspace.shop.name ?? workspace.shop.shopDomain}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{workspace.storeHeadline}</h1>
          </div>
        </div>
        {workspace.siteId ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Shopify adds purchase-path evidence to this store&apos;s FixFlags Site. Meaningful failures
            become Commerce Flags there, alongside the rest of the website.
          </p>
        ) : (
          <div className="space-y-3 rounded-nested-md bg-muted/40 p-4">
            <p className="font-medium">Finish connecting this store to a Site</p>
            <p className="text-sm leading-6 text-muted-foreground">
              The Shopify installation is authorized, but it is not attached to a FixFlags account.
              Sign in, add this website, then choose Connect Shopify in Site settings. A hostname alone
              can never claim a Site.
            </p>
            <Button asChild variant="outline"><Link href="/sign-in?next=/dashboard" target="_top">Go to FixFlags</Link></Button>
          </div>
        )}
      </Card>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <section className="space-y-3" aria-labelledby="purchase-paths-heading">
        <div>
          <h2 id="purchase-paths-heading" className="text-lg font-semibold">Purchase paths</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            FixFlags stops before payment. Blocked or unclear evidence stays explicit and never certifies recovery.
          </p>
        </div>
        {workspace.paths.length === 0 ? (
          <Card className="p-5">
            <p className="font-medium">No buyable product found</p>
            <p className="mt-1 text-sm text-muted-foreground">Publish an active product with a storefront URL, then try again.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspace.paths.map((path) => (
              <Card key={path.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{path.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{path.reasonLabel}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{path.walking ? 'Checking…' : path.healthLabel}</span>
                </div>
                {path.lastVerifiedAt ? (
                  <p className="text-xs text-muted-foreground">Last checked {new Date(path.lastVerifiedAt).toLocaleString()}</p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(busyPathId) || path.walking || workspace.rechecksRemaining <= 0}
                  onClick={() => void recheck(path.id)}
                >
                  {busyPathId === path.id ? 'Starting…' : 'Check path again'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
