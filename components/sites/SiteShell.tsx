'use client'

import type { ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Flag, Globe2, LayoutGrid, RefreshCw } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { SiteAgentPanel } from '@/components/sites/SiteAgentPanel'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { cn } from '@/lib/utils'

type SiteRoute = 'home' | 'flags' | 'settings'

const routes = [
  ['home', 'Home', LayoutGrid],
  ['flags', 'Flags', Flag],
  ['settings', 'Settings', Globe2],
] as const

function routeHref(siteId: string, route: SiteRoute): Route {
  if (route === 'home') return `/sites/${siteId}` as Route
  return `/sites/${siteId}/${route}` as Route
}

export function SiteShell({
  siteId,
  activeRoute,
  title,
  description,
  flagCount,
  watch,
  checking = false,
  statusMessage,
  children,
}: {
  siteId: string
  activeRoute: SiteRoute
  title: string
  description: string
  flagCount: number
  watch: SiteHomeView['watch']
  checking?: boolean
  statusMessage?: string | null
  children: ReactNode
}) {
  const { user } = useMe()
  const signedIn = Boolean(user)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1360px] gap-8 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
        <aside className="hidden w-44 shrink-0 flex-col gap-6 lg:flex">
          <Logo variant="lockup" size="sm" />
          <nav className="flex flex-col gap-1" aria-label="Site">
            {routes.map(([id, label, Icon]) => (
              <Link
                key={id}
                href={routeHref(siteId, id)}
                aria-current={activeRoute === id ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                  activeRoute === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                {id === 'flags' && flagCount > 0 ? (
                  <span className="ml-auto rounded-full bg-foreground/10 px-2 py-0.5 text-xs">{flagCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          {signedIn ? (
            <div className="mt-auto space-y-3 border-t border-border/70 pt-4">
              <p className="text-xs text-muted-foreground">{watch.label}</p>
              {watch.lastError ? <p className="text-xs text-muted-foreground">{watch.lastError}</p> : null}
              <Link href={`/sites/${siteId}/settings`} className="block text-sm text-muted-foreground hover:text-foreground">
                Watch settings
              </Link>
              <Link href="/dashboard" className="block text-sm text-muted-foreground hover:text-foreground">
                All Sites
              </Link>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                <Logo variant="lockup" size="sm" />
                {signedIn ? (
                  <Link href="/dashboard" className="text-xs text-muted-foreground">All Sites</Link>
                ) : (
                  <SiteChromeAuth />
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
              {statusMessage ? <p role="status" className="mt-2 text-sm text-foreground">{statusMessage}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-sm text-brand" role="status">
                  <RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  Learning your website
                </span>
              ) : null}
              {signedIn ? (
                <>
                  <Button variant="outline" className="lg:hidden" asChild>
                    <Link href={`/sites/${siteId}/settings`}>Watch</Link>
                  </Button>
                  <SiteAgentPanel siteId={siteId} />
                </>
              ) : (
                <SiteChromeAuth className="hidden lg:inline-flex" />
              )}
            </div>
          </header>
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="Mobile Site">
        {routes.map(([id, label, Icon]) => (
          <Link
            key={id}
            href={routeHref(siteId, id)}
            aria-current={activeRoute === id ? 'page' : undefined}
            className={cn(
              'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-xs',
              activeRoute === id ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
            {id === 'flags' && flagCount > 0 ? (
              <span className="absolute right-1/4 top-1 rounded-full bg-brand px-1.5 text-3xs text-brand-foreground">{flagCount}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  )
}
