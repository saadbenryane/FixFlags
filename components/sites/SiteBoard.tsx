'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  Flag,
  Gauge,
  Globe2,
  LayoutGrid,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Check,
  CircleAlert,
  ChevronRight,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  site: Globe2,
  security: ShieldCheck,
  search: Search,
  performance: Gauge,
  conversion: Target,
  tracking: Radio,
  uptime: Activity,
}

function StatusDot({ state }: { state: CardHealthState }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        state === 'healthy' && 'bg-success',
        state === 'attention' && 'bg-warning',
        state === 'problem' && 'bg-destructive',
        state === 'checking' && 'bg-brand animate-pulse',
        state === 'unknown' && 'bg-muted-foreground/40'
      )}
      aria-hidden
    />
  )
}

function StatusLabel({ state, children }: { state: CardHealthState; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <StatusDot state={state} />
      {children}
    </span>
  )
}

export function SiteBoard({
  siteId,
  initial,
}: {
  siteId: string
  initial: SiteHomeView
}) {
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [nav, setNav] = useState<'Dashboard' | 'Flags' | 'Site'>('Dashboard')
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const checking =
    view.audit.status != null && !['COMPLETED', 'FAILED'].includes(view.audit.status)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}`)
    if (!res.ok) return
    const data = (await res.json()) as SiteHomeView
    setView(data)
  }, [siteId])

  useEffect(() => {
    if (!checking) return
    const timer = setInterval(() => {
      void refresh()
    }, 2500)
    return () => clearInterval(timer)
  }, [checking, refresh])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  async function confirmOutcome(outcomeId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeId, confirmed: true }),
      })
      if (res.ok) {
        setToast('Outcome saved')
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function keepWatching() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'weekly' }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; signup?: boolean }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}`)
        return
      }
      if (!res.ok) {
        setToast(body.error || 'Could not start watching yet')
        return
      }
      setToast('You’re covered. We’ll check this Site again.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function copyFix(text: string, flagId: string) {
    try {
      await navigator.clipboard.writeText(text)
      setToast('Fix instructions copied')
      await fetch(`/api/sites/${siteId}/flags/${flagId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy' }),
      }).catch(() => {})
    } catch {
      setToast('Select and copy the instructions below')
    }
  }

  async function verifyFlag(flagId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/flags/${flagId}/verify`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        signup?: boolean
        siteId?: string
      }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}`)
        return
      }
      if (!res.ok) {
        setToast(body.error || 'Could not start verification')
        return
      }
      setToast('Verification started. Related cards will update when it finishes.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const selected = selectedCard
    ? view.cards.find((c) => c.id === selectedCard) ?? null
    : null
  const selectedFlags = selected
    ? view.flags.filter((f) => selected.flagIds.includes(f.id) || f.area === selected.id)
    : []

  return (
    <div className="min-h-screen bg-[var(--canvas,#f4f5f7)] text-foreground">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
          <Logo variant="lockup" size="sm" />
          <div>
            <p className="font-medium">{view.host}</p>
            <StatusLabel state={view.statusState}>{view.statusLabel}</StatusLabel>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Site">
            {(
              [
                ['Dashboard', LayoutGrid],
                ['Flags', Flag],
                ['Site', Globe2],
              ] as const
            ).map(([label, Icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setNav(label)
                  setSelectedCard(null)
                }}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                  nav === label ? 'bg-brand-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === 'Flags' && view.flags.length > 0 ? (
                  <span className="ml-auto rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                    {view.flags.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-3 border-t border-border/70 pt-4">
            <StatusLabel state={view.watching ? 'healthy' : 'unknown'}>
              {view.watching ? 'Keeping watch' : 'First look'}
            </StatusLabel>
            {!view.watching ? (
              <Button variant="brand" size="sm" disabled={busy} onClick={() => void keepWatching()}>
                Keep watching
              </Button>
            ) : null}
            <Link href="/dashboard" className="block text-sm text-muted-foreground hover:text-foreground">
              All Sites
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                <Logo variant="lockup" size="sm" />
                <StatusLabel state={view.statusState}>{view.statusLabel}</StatusLabel>
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {nav === 'Dashboard' ? 'Your board' : nav === 'Flags' ? 'Flags' : 'Your Site'}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {nav === 'Dashboard'
                  ? checking
                    ? 'Your website, already being looked after.'
                    : view.flags.length
                      ? 'Issues show up by area. Open a card to dig in.'
                      : 'Everything we’re watching looks good.'
                  : nav === 'Flags'
                    ? 'The things worth your attention.'
                    : 'What FixFlags knows, and what it’s watching.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-sm text-brand">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking…
                </span>
              ) : null}
              {!view.watching ? (
                <Button
                  variant="brand"
                  className="lg:hidden"
                  disabled={busy}
                  onClick={() => void keepWatching()}
                >
                  Keep watching
                </Button>
              ) : null}
            </div>
          </header>

          {nav === 'Dashboard' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {view.cards.map((card) => {
                const Icon = ICONS[card.id] ?? Globe2
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCard(card.id)}
                    className={cn(
                      'flex min-h-[180px] flex-col rounded-2xl border border-border/80 bg-background p-5 text-left shadow-sm transition hover:border-foreground/20',
                      card.id === 'site' && 'sm:col-span-2 xl:col-span-2',
                      card.state === 'problem' && 'border-destructive/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {card.name}
                      </span>
                      {card.state === 'checking' ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-brand" />
                      ) : (
                        <StatusDot state={card.state} />
                      )}
                    </div>
                    <p className="mt-4 font-display text-xl font-semibold tracking-tight">
                      {card.answer}
                    </p>
                    {card.detail ? (
                      <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
                    ) : null}
                    {card.score != null ? (
                      <p className="mt-auto pt-4 text-xs text-muted-foreground">Score {card.score}</p>
                    ) : (
                      <p className="mt-auto pt-4 text-xs text-muted-foreground">
                        {card.openFlagCount
                          ? `${card.openFlagCount} Flag${card.openFlagCount === 1 ? '' : 's'}`
                          : card.checkedAt
                            ? 'Checked'
                            : '—'}
                      </p>
                    )}
                  </button>
                )
              })}
              <div className="flex min-h-[180px] flex-col items-start justify-center rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-left">
                <p className="font-medium">Add card</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connections enrich these same cards. More cards come as we learn your Site.
                </p>
              </div>
            </div>
          ) : null}

          {nav === 'Flags' ? (
            <div className="space-y-3">
              {view.flags.length === 0 ? (
                <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
                  <Check className="mx-auto h-8 w-8 text-success" />
                  <h2 className="mt-3 font-display text-xl font-semibold">Nothing needs you right now.</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {view.coverageSummary}
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => setNav('Dashboard')}>
                    Back to your board
                  </Button>
                </div>
              ) : (
                view.flags.map((flag) => (
                  <Link
                    key={flag.id}
                    href={`/sites/${siteId}/flags/${flag.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background p-5 transition hover:border-foreground/20"
                  >
                    <CircleAlert
                      className={cn(
                        'mt-0.5 h-5 w-5',
                        flag.severity === 'CRITICAL' ? 'text-destructive' : 'text-warning'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {flag.area} · {flag.severity.toLowerCase()}
                      </p>
                      <h2 className="mt-1 font-medium">{flag.problem}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{flag.whyItMatters}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))
              )}
            </div>
          ) : null}

          {nav === 'Site' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border/80 bg-background p-5">
                <h2 className="font-display text-lg font-semibold">What people come here to do</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We inferred these. Confirm what looks right.
                </p>
                <ul className="mt-4 space-y-2">
                  {view.outcomes.map((outcome) => (
                    <li
                      key={outcome.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium">{outcome.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {outcome.confirmedAt ? 'Confirmed' : 'Inferred'} · {outcome.inferenceSource}
                        </p>
                      </div>
                      {!outcome.confirmedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void confirmOutcome(outcome.id)}
                        >
                          Looks right
                        </Button>
                      ) : (
                        <Check className="h-4 w-4 text-success" />
                      )}
                    </li>
                  ))}
                  {view.outcomes.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Still learning your Outcomes.</li>
                  ) : null}
                </ul>
              </section>
              <section className="rounded-2xl border border-border/80 bg-background p-5">
                <h2 className="font-display text-lg font-semibold">Coverage</h2>
                <p className="mt-1 text-sm text-muted-foreground">{view.coverageSummary}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {view.cards
                    .filter((c) => c.id !== 'site')
                    .map((card) => (
                      <li key={card.id} className="flex items-center justify-between gap-3">
                        <span>{card.name}</span>
                        <StatusLabel state={card.state}>{card.answer}</StatusLabel>
                      </li>
                    ))}
                </ul>
              </section>
            </div>
          ) : null}

          {selected && nav === 'Dashboard' ? (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/20 p-4 sm:items-center">
              <div
                role="dialog"
                aria-modal="true"
                aria-label={selected.name}
                className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-background p-5 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">{selected.question}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCard(null)}>
                    Close
                  </Button>
                </div>
                <p className="mt-4 text-lg font-medium">{selected.answer}</p>
                {selected.detail ? (
                  <p className="mt-1 text-sm text-muted-foreground">{selected.detail}</p>
                ) : null}
                <div className="mt-5 space-y-3">
                  {selectedFlags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open Flags in this area.</p>
                  ) : (
                    selectedFlags.map((flag) => (
                      <div key={flag.id} className="rounded-xl border border-border/70 p-4">
                        <p className="font-medium">{flag.problem}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{flag.whyItMatters}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyFix(flag.fix, flag.id)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Fix this
                          </Button>
                          <Button size="sm" variant="brand" disabled={busy} onClick={() => void verifyFlag(flag.id)}>
                            Verify fix
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/sites/${siteId}/flags/${flag.id}`}>Open Flag</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden"
        aria-label="Mobile Site"
      >
        {(
          [
            ['Dashboard', 'Home', LayoutGrid],
            ['Flags', 'Flags', Flag],
            ['Site', 'Site', Globe2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={cn(
              'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-xs',
              nav === id ? 'text-foreground' : 'text-muted-foreground'
            )}
            onClick={() => {
              setNav(id)
              setSelectedCard(null)
            }}
          >
            <Icon className="h-5 w-5" />
            {label}
            {id === 'Flags' && view.flags.length > 0 ? (
              <span className="absolute right-1/4 top-1 rounded-full bg-brand px-1.5 text-[10px] text-brand-foreground">
                {view.flags.length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-background px-4 py-2 text-sm shadow-lg lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
