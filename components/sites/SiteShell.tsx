'use client'

import { useState, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Flag, Globe2, LayoutGrid, Radio } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Logo } from '@/components/brand/Logo'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
import { useMe } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { cn } from '@/lib/utils'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { CustomerMain, customerMobileBarClass } from '@/components/layout/customer-frame'
import { customerAttention, type MonitoringState, type SitePresentation } from '@/lib/sites/presentation'

type SiteRoute = 'home' | 'flags' | 'settings'

const routes = [
  ['home', 'Overview', LayoutGrid],
  ['flags', 'Flags', Flag],
  ['settings', 'Settings', Globe2],
] as const

function monitoringClass(state: MonitoringState | undefined, legacy: SiteHomeView['watch']['state']): string {
  const resolved = state ?? (legacy === 'watching' ? 'weekly' : legacy === 'off' ? 'not_monitored' : legacy === 'quota' ? 'quota_blocked' : legacy)
  if (resolved === 'weekly' || resolved === 'daily') return 'border-success/60 text-success'
  if (resolved === 'not_monitored') return 'border-border text-muted-foreground'
  return 'border-brand text-brand'
}

function routeHref(siteId: string, route: SiteRoute): Route {
  if (route === 'home') return `/sites/${siteId}` as Route
  return `/sites/${siteId}/${route}` as Route
}

export function SiteShell({
  siteId,
  ownerId,
  activeRoute,
  title,
  description,
  presentation,
  watch,
  statusMessage,
  headerAction,
  children,
}: {
  siteId: string
  ownerId?: string | null
  activeRoute: SiteRoute
  title: string
  description: string
  presentation?: SitePresentation
  watch: SiteHomeView['watch']
  checking?: boolean
  statusMessage?: string | null
  headerAction?: ReactNode
  children: ReactNode
}) {
  const { user } = useMe()
  const signedIn = Boolean(user)
  const ownsSite = Boolean(user && ownerId && user.id === ownerId)
  const visibleRoutes = routes.filter(([id]) => id !== 'settings' || ownsSite)
  const [captureOpen, setCaptureOpen] = useState(false)
  const monitoring = presentation?.monitoring
  const watchLabel = monitoring?.label ?? watch.label
  const identity = presentation?.identity
  const attention = presentation ? customerAttention(presentation) : null
  const flagCount = presentation?.flags.count ?? 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1360px] gap-8 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
        <aside className="hidden w-44 shrink-0 flex-col gap-6 lg:flex">
          <Logo variant="lockup" size="sm" />
          {signedIn ? <Link href="/dashboard" className="flex min-h-11 items-center text-sm text-muted-foreground">← All websites</Link> : <SiteChromeAuth />}
          <nav className="flex flex-col gap-1" aria-label="Site">
            {visibleRoutes.map(([id, label, Icon]) => (
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
        </aside>

        <CustomerMain className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex w-full items-center justify-between gap-3 lg:hidden">
              <Logo variant="lockup" size="sm" />
              {signedIn ? <Link href="/dashboard" className="flex min-h-11 items-center text-sm text-muted-foreground">← All websites</Link> : <SiteChromeAuth />}
            </div>
            <div className="flex min-w-0 items-center gap-3">
              {identity ? identity.preview ? <button type="button" className="h-14 w-16 shrink-0 overflow-hidden rounded-control border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setCaptureOpen(true)} aria-label={`Open captured page for ${identity.host}`}>
                {/* Authorized captures use the current browser session. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={identity.preview.url} alt="" width={128} height={112} className="h-full w-full object-cover object-top" />
              </button> : <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground" aria-label="No website preview yet"><Globe2 className="h-5 w-5" aria-hidden /></span> : null}
              <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="break-words text-2xl font-semibold tracking-tight">{identity?.host ?? title}</h1>
                {attention ? <Link href={`/sites/${siteId}/flags`} className={cn('text-sm font-medium', attention.tone === 'attention' ? 'text-brand' : attention.tone === 'clear' ? 'text-success' : 'text-muted-foreground')} aria-label={`${attention.text}. View Flags`}>
                  {attention.text}
                </Link> : null}
              </div>
              {identity && activeRoute !== 'home' ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{activeRoute === 'flags' ? 'Flags' : 'Settings'}</p> : null}
              {identity && activeRoute === 'home' ? <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{presentation.coverage.label}</span>
                <span aria-hidden="true">·</span>
                <span>{presentation.freshness.label}</span>
              </p> : null}
              {!identity && description ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
              {statusMessage ? <p role="status" className="mt-2 text-sm text-foreground">{statusMessage}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {identity && ownsSite ? <Link href={`/sites/${siteId}/settings#watch`} className={cn('inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', monitoringClass(monitoring?.state, watch.state))}>
                <Radio className="h-4 w-4" aria-hidden />
                {watchLabel}
              </Link> : identity ? <span className={cn('inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium', monitoringClass(monitoring?.state, watch.state))}>
                <Radio className="h-4 w-4" aria-hidden />
                {watchLabel}
              </span> : null}
              {headerAction}
              {!signedIn ? (
                <SiteChromeAuth className="hidden lg:inline-flex" />
              ) : null}
            </div>
          </header>
          {children}
        </CustomerMain>
      </div>

      <nav className={customerMobileBarClass} aria-label="Mobile Site">
        {visibleRoutes.map(([id, label, Icon]) => (
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
      {identity?.preview ? <Dialog open={captureOpen} onOpenChange={setCaptureOpen}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-auto rounded-card">
        <DialogTitle>{identity.host}</DialogTitle>
        <DialogDescription>{identity.preview.pageUrl} · {identity.preview.viewport} · {formatEvidenceTimestamp(identity.preview.recordedAt)}</DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={identity.preview.url} alt={`Captured ${identity.host}`} width={1280} height={720} className="h-auto w-full" />
      </DialogContent></Dialog> : null}
    </div>
  )
}
