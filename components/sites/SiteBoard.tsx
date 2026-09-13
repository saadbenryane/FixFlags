'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flag,
  Globe2,
  LayoutGrid,
  RefreshCw,
  Check,
  CircleAlert,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import {
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import { AddBoardCard, AddCardLibrary, BoardGrid, BoardSurface, ProductBoardCard } from '@/components/sites/BoardCard'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { BoardDetails } from '@/components/sites/BoardDetails'

function StatusDot({ state }: { state: CardHealthState }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        state === 'healthy' && 'bg-success',
        state === 'attention' && 'bg-brand',
        state === 'problem' && 'bg-brand',
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
  const opener = useRef<HTMLElement | null>(null)
  const openCard = (id: SiteCardArea) => { opener.current = document.activeElement as HTMLElement; setSelectedCard(id) }
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [addedCards, setAddedCards] = useState<SiteCardArea[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const checking =
    view.audit.status != null &&
    !['COMPLETED', 'FAILED'].includes(view.audit.status)
  const learningCopy = 'Learning your website'
  const watch = view.watch ?? {
    state: view.watching ? 'watching' : 'off',
    interval: null,
    nextRunAt: null,
    lastError: null,
    covered: view.watching,
    label: view.watching ? 'Watching weekly' : 'Not watching',
  }

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
        setToast('Journey saved')
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function keepWatching() {
    setBusy(true)
    try {
      // Server picks the best allowed interval for the signed-in plan.
      const res = await fetch(`/api/sites/${siteId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'daily' }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        signup?: boolean
        interval?: string
      }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}`)
        return
      }
      if (!res.ok) {
        setToast(body.error || 'Could not start watching yet')
        return
      }
      if (body.interval) {
        setToast(
          body.interval === 'daily'
            ? 'You’re covered. We’ll check this Site daily.'
            : 'You’re covered. We’ll check this Site weekly.'
        )
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function pauseWatching() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: null }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; signup?: boolean }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}`)
        return
      }
      if (!res.ok) {
        setToast(body.error || 'Could not pause watching')
        return
      }
      setToast('Watch paused. This Site is not on a check schedule.')
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
  const selectedRecommendations = selected
    ? (view.recommendations ?? []).filter((f) => f.area === selected.id)
    : []
  const visibleCards = view.cards.filter(
    (card) =>
      STARTER_BOARD_CARDS.includes(card.id) || addedCards.includes(card.id)
  )
  const presentAreas = visibleCards.map((card) => card.id)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1360px] gap-8 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
        <aside className="hidden w-44 shrink-0 flex-col gap-6 lg:flex">
          <Logo variant="lockup" size="sm" />
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
                  nav === label ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {label === 'Dashboard' ? 'Home' : label === 'Site' ? 'Settings' : label}
                {label === 'Flags' && view.flags.length > 0 ? (
                  <span className="ml-auto rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                    {view.flags.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-3 border-t border-border/70 pt-4">
            <StatusLabel
              state={
                watch.covered
                  ? 'healthy'
                  : watch.state === 'off'
                    ? 'unknown'
                    : 'attention'
              }
            >
              {watch.label}
            </StatusLabel>
            {watch.lastError ? (
              <p className="text-xs text-muted-foreground">{watch.lastError}</p>
            ) : null}
            {watch.state === 'watching' || watch.state === 'delayed' || watch.state === 'quota' ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void pauseWatching()}>
                Pause watching
              </Button>
            ) : (
              <Button variant="brand" size="sm" disabled={busy} onClick={() => void keepWatching()}>
                Keep watching
              </Button>
            )}
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
                <Link href="/dashboard" className="text-xs text-muted-foreground">All Sites</Link>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {nav === 'Dashboard' ? 'Your board' : nav === 'Flags' ? 'Flags' : 'Site settings'}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {nav === 'Dashboard'
                  ? checking
                    ? `${learningCopy}. Cards update as each area finishes.`
                    : view.flags.length
                      ? 'Flags show up by area. Open a card to dig in.'
                      : view.statusState === 'healthy'
                        ? 'Checked areas look good. Unchecked areas stay unknown.'
                        : view.coverageSummary
                  : nav === 'Flags'
                    ? 'The things worth your attention.'
                    : 'Watch, connections, and how FixFlags notifies you.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-sm text-brand" role="status">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  {learningCopy}
                </span>
              ) : null}
              {!watch.covered ? (
                <Button
                  variant="brand"
                  className="lg:hidden"
                  disabled={busy}
                  onClick={() => void keepWatching()}
                >
                  Keep watching
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="lg:hidden"
                  disabled={busy}
                  onClick={() => void pauseWatching()}
                >
                  Pause
                </Button>
              )}
            </div>
          </header>

          {nav === 'Dashboard' ? (
            <BoardSurface host={view.host} state={view.statusState} label={view.statusLabel} count={view.flags.length} onOpen={() => openCard('site')}>
            <BoardGrid>
              {visibleCards.map((card) => (
                <ProductBoardCard
                  key={card.id}
                  card={card}
                  onOpen={() => openCard(card.id)}
                />
              ))}
              <AddBoardCard onOpen={() => setLibraryOpen(true)} />
            </BoardGrid>
            </BoardSurface>
          ) : null}

          {nav === 'Flags' ? (
            <div className="space-y-3">
              {view.flags.length === 0 ? (
                <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
                  {view.statusState === 'healthy' ? (
                    <Check className="mx-auto h-8 w-8 text-success" />
                  ) : null}
                  <h2 className="mt-3 text-xl font-semibold">
                    {view.statusState === 'healthy'
                      ? 'Nothing needs you right now.'
                      : 'No Flags yet. Coverage is still incomplete.'}
                  </h2>
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
                <h2 className="text-lg font-semibold">What people come here to do</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We inferred these. Confirm what looks right.
                </p>
                <ul className="mt-4 space-y-2">
                  {view.outcomes.map((outcome) => (
                    <li
                      key={outcome.id}
                      className="flex items-center justify-between gap-3 rounded-card border border-border/60 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium">{outcome.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {outcome.confirmedAt ? 'Confirmed' : 'Inferred'} · Journey
                        </p>
                        {outcome.pageUrls?.[0] ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {outcome.pageUrls[0]}
                          </p>
                        ) : null}
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
                    <li className="text-sm text-muted-foreground">Still learning your Journeys.</li>
                  ) : null}
                </ul>
              </section>
              <section className="rounded-2xl border border-border/80 bg-background p-5">
                <h2 className="text-lg font-semibold">Coverage</h2>
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

          <Dialog open={Boolean(selected && nav === 'Dashboard')} onOpenChange={open => { if (!open) setSelectedCard(null) }}>
            <DialogContent className="max-h-[85dvh] w-[calc(100%-32px)] max-w-xl overflow-y-auto rounded-2xl bg-background p-6 sm:p-8" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }}>
              <DialogTitle className="pr-8 text-2xl">{selected?.name}</DialogTitle>
              <DialogDescription>{selected?.question}</DialogDescription>
              {selected ? <>
                <p className="text-xl font-semibold tracking-tight">{selectedFlags.length ? `${selectedFlags.length} ${selectedFlags.length === 1 ? 'Flag' : 'Flags'}` : selected.answer}</p>
                <BoardDetails
                  image={selected.captureUrl ? { src: selected.captureUrl, alt: selected.captureAlt ?? selected.name } : null}
                  checkedAt={selected.checkedAt}
                  sources={selected.sources}
                  coverage={selected.id === 'site' ? 'Page results from the latest check. Areas without sufficient evidence remain unverified.' : selected.coverage}
                  facts={selected.id === 'site' ? [] : selected.facts.filter(fact => fact !== selected.answer)}
                  pages={selected.id === 'site' ? view.checkedPages ?? [] : undefined}
                />
                <div className="mt-5 space-y-3">
                  {selectedFlags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open Flags in this area.</p>
                  ) : (
                    selectedFlags.map((flag) => (
                      <div key={flag.id} className="rounded-card border border-border/70 p-4">
                        <Link
                          href={`/sites/${siteId}/flags/${flag.id}`}
                          className="flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="line-clamp-2 font-medium">{flag.problem}</p>

                          </div>
                          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                        </Link>

                      </div>
                    ))
                  )}
                  {selectedRecommendations.length > 0 ? (
                    <div className="pt-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommendations</p>
                      <ul className="mt-2 space-y-2">
                        {selectedRecommendations.map((item) => (
                          <li key={item.id} className="rounded-card border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                            {item.problem}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </> : null}
            </DialogContent>
          </Dialog>
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
            ['Site', 'More', Globe2],
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
              <span className="absolute right-1/4 top-1 rounded-full bg-brand px-1.5 text-3xs text-brand-foreground">
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

      <AddCardLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        present={presentAreas}
        onAdd={(id) => {
          setAddedCards((current) => (current.includes(id) ? current : [...current, id]))
          setLibraryOpen(false)
        }}
      />
    </div>
  )
}
