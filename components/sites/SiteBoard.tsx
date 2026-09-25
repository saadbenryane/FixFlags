'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Flag,
  Globe2,
  LayoutGrid,
  RefreshCw,
  Check,
  CircleAlert,
  ChevronRight,
  Clock3,
  CircleHelp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
import { useMe } from '@/hooks/useMe'
import { cn } from '@/lib/utils'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import {
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import { BoardGrid, BoardSurface, ProductBoardCard } from '@/components/sites/BoardCard'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { SiteSettingsControls } from '@/components/sites/SiteSettingsControls'
import { firstOutcomePrompt, homeBoardLead } from '@/lib/sites/first-outcome'
import { siteCheckNotice, siteSummaryNotice } from '@/lib/sites/check-notice'
import { customerFlagContext } from '@/lib/sites/flag-label'
import { outcomeCoverageLabel, outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { SiteAgentPanel } from '@/components/sites/SiteAgentPanel'

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

function isEmptyUncheckedCard(card: BoardCardView) {
  return (
    card.id !== 'site' &&
    card.state === 'unknown' &&
    card.openFlagCount === 0 &&
    card.activity !== 'checking'
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
  activeView = 'home',
}: {
  siteId: string
  initial: SiteHomeView
  activeView?: 'home' | 'flags' | 'settings'
}) {
  const router = useRouter()
  const { user } = useMe()
  const signedIn = Boolean(user)
  const [view, setView] = useState(initial)
  const [checkKind, setCheckKind] = useState<Record<string, '' | 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'>>({})
  const opener = useRef<HTMLElement | null>(null)
  const openCard = (id: SiteCardArea) => { opener.current = document.activeElement as HTMLElement; setSelectedCard(id) }
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const checking =
    view.audit.status != null &&
    !['COMPLETED', 'FAILED'].includes(view.audit.status)
  const learningCopy = 'Learning your website'
  const notice = siteCheckNotice({
    status: view.audit.status,
    failureCode: view.audit.failureCode,
  })
  const summaryNote = siteSummaryNotice({
    status: view.audit.status,
    failureCode: view.audit.failureCode,
  })
  const outcomePrompt = firstOutcomePrompt({
    checking,
    walkFinished: view.audit.walkFinished,
    customerOutcomeCount: view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC').length,
  })
  const watch = view.watch ?? {
    state: view.watching ? 'watching' : 'off',
    interval: null,
    nextRunAt: null,
    lastError: null,
    covered: view.watching,
    label: view.watching ? 'Watching weekly' : 'Not watching',
  }

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}`, { cache: 'no-store' })
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

  async function retryCheck() {
    if (!view.audit.id || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/reports/${view.audit.id}/retry`, { method: 'POST' })
      if (!res.ok) {
        setToast('Could not retry this check. Try again.')
        return
      }
      setToast('Check started again')
      setView((current) => ({
        ...current,
        audit: { ...current.audit, status: 'QUEUED', failureCode: null, progress: 0 },
      }))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function watchPage() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchPage: true }),
      })
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { outcome?: SiteHomeView['outcomes'][number] }
        setToast('This page is confirmed')
        if (body.outcome?.kind && body.outcome.kind !== 'GENERIC') {
          setView((current) => ({
            ...current,
            outcomes: current.outcomes.some((outcome) => outcome.id === body.outcome?.id)
              ? current.outcomes
              : [...current.outcomes, body.outcome!],
          }))
        }
        await refresh()
      } else if (res.status === 401 || res.status === 403) {
        router.push(`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`)
      } else {
        setToast('Could not confirm this page. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmOutcome(outcomeId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcomeId,
          confirmed: true,
          kind: checkKind[outcomeId] || undefined,
        }),
      })
      if (res.ok) {
        setToast('Outcome saved')
        await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  async function verifyOutcome(outcomeId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `web:${outcomeId}:${Date.now()}` },
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setToast(body.error || 'Could not start this verification')
        return
      }
      setToast('Outcome verification started')
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
  const visibleCards = view.cards.filter((card) => {
    const onBoard = STARTER_BOARD_CARDS.includes(card.id)
    if (!onBoard) return false
    if (signedIn || checking) return true
    return !isEmptyUncheckedCard(card)
  })
  const coverageCards = view.cards.filter((card) => {
    if (card.id === 'site') return false
    if (!signedIn && isEmptyUncheckedCard(card)) return false
    return true
  })
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1360px] gap-8 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
        <aside className="hidden w-44 shrink-0 flex-col gap-6 lg:flex">
          <Logo variant="lockup" size="sm" />
          <nav className="flex flex-col gap-1" aria-label="Site">
            {([
              ['home', 'Home', LayoutGrid, `/sites/${siteId}`],
              ['flags', 'Flags', Flag, `/sites/${siteId}/flags`],
              ['settings', 'Settings', Globe2, `/sites/${siteId}/settings`],
            ] as const).map(([id, label, Icon, href]) => (
              <Link
                key={id}
                href={href}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                  activeView === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {id === 'flags' && view.flags.length > 0 ? (
                  <span className="ml-auto rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                    {view.flags.length}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          {signedIn ? (
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
              <h1 className="text-2xl font-semibold tracking-tight">
                {activeView === 'home' ? 'Your board' : activeView === 'flags' ? 'Flags' : 'Site settings'}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {activeView === 'home'
                  ? homeBoardLead({
                      checking,
                      hasOutcomePrompt: Boolean(outcomePrompt),
                      flagCount: view.flags.length,
                      healthy: view.statusState === 'healthy',
                      coverageSummary: view.coverageSummary,
                      watchCovered: watch.covered,
                    })
                  : activeView === 'flags'
                    ? 'The things worth your attention.'
                    : 'Watch, connections, and how FixFlags notifies you.'}
              </p>
              {toast ? (
                <p role="status" className="mt-2 text-sm text-foreground">{toast}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-sm text-brand" role="status">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  {learningCopy}
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

          {notice ? (
            <AuditFailurePanel
              failureCode={view.audit.failureCode}
              onRetry={retryCheck}
              retryLoading={busy}
            />
          ) : summaryNote ? (
            <p className="rounded-2xl border border-border/80 bg-background p-4 text-sm text-muted-foreground" role="status">
              {summaryNote.body}
            </p>
          ) : null}

          {activeView === 'home' ? (
            <>
              {outcomePrompt ? (
                <section className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Outcome</p>
                  <h2 className="mt-1 text-xl font-semibold">{outcomePrompt.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{outcomePrompt.body}</p>
                  <Button className="mt-4" variant="brand" disabled={busy} onClick={() => void watchPage()}>
                    {outcomePrompt.action}
                  </Button>
                </section>
              ) : null}
              {view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC').map((outcome) => {
                const stateLabel = outcomeStatusLabel(outcome.state, outcome.running)
                const StateIcon = outcome.state === 'CLEAR'
                  ? Check
                  : outcome.state === 'FLAG'
                    ? CircleAlert
                    : outcome.state === 'STALE'
                      ? Clock3
                      : CircleHelp
                return (
                  <section key={outcome.id} className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Outcome</p>
                        <h2 className="mt-1 text-xl font-semibold">
                          <Link href={`/sites/${siteId}/outcomes/${outcome.id}`} className="hover:underline">
                            {outcome.name}
                          </Link>
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{outcome.summary}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {outcomeCoverageLabel(outcome.environment, outcome.bindings)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {outcome.lastVerifiedAt
                            ? `${outcome.state === 'COULD_NOT_VERIFY' ? 'Last attempted' : 'Last verified'} ${new Date(outcome.lastVerifiedAt).toLocaleString()}`
                            : 'No completed verification yet'}
                        </p>
                      </div>
                      <div className="flex min-w-[9rem] flex-col items-end gap-3">
                        <span className={cn(
                          'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium',
                          outcome.state === 'CLEAR' && 'border-success/30 text-success',
                          outcome.state === 'FLAG' && 'border-brand text-brand',
                          (outcome.state === 'STALE' || outcome.state === 'COULD_NOT_VERIFY') && 'border-border text-muted-foreground'
                        )} role="status">
                          <StateIcon className={cn('h-4 w-4', outcome.running && 'motion-safe:animate-pulse')} aria-hidden />
                          {stateLabel}
                        </span>
                        <div className="flex gap-2">
                          {outcome.state === 'FLAG' && outcome.flagId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/sites/${siteId}/flags/${outcome.flagId}`}>Open Flag</Link>
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant={outcome.state === 'FLAG' ? 'brand' : 'outline'}
                            disabled={busy || outcome.running || !outcome.bindings.some((binding) => binding.required)}
                            onClick={() => void verifyOutcome(outcome.id)}
                          >
                            {outcome.running ? 'Verifying…' : 'Verify'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })}
              {view.flags.length > 0 ? (
                <section className="space-y-3" aria-labelledby="site-flags-heading">
                  <h2 id="site-flags-heading" className="text-lg font-semibold">
                    Flags
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{view.flags.length}</span>
                  </h2>
                  {view.flags.map((flag) => (
                    <FlagRow key={flag.id} siteId={siteId} flag={flag} />
                  ))}
                </section>
              ) : null}
              <BoardSurface host={view.host} state={view.statusState} label={view.statusLabel} count={view.flags.length} onOpen={() => openCard('site')}>
              <BoardGrid>
                {visibleCards.map((card) => (
                  <ProductBoardCard
                    key={card.id}
                    card={card}
                    onOpen={() => openCard(card.id)}
                  />
                ))}
              </BoardGrid>
              </BoardSurface>
            </>
          ) : null}

          {activeView === 'flags' ? (
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
                  <Button className="mt-4" variant="outline" asChild>
                    <Link href={`/sites/${siteId}`}>Back to your board</Link>
                  </Button>
                </div>
              ) : (
                view.flags.map((flag) => (
                  <FlagRow key={flag.id} siteId={siteId} flag={flag} />
                ))
              )}
            </div>
          ) : null}

          {activeView === 'settings' ? (
            <div className="space-y-4">
              <SiteSettingsControls
                siteId={siteId}
                watch={view.watch}
                initial={view.settings ?? {
                  notificationLevel: 'FLAGS',
                  notifyOnRecovery: true,
                  shopify: { state: 'not_connected', domain: null },
                  searchConsole: { provider: 'SEARCH_CONSOLE', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
                  analytics: { provider: 'ANALYTICS', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
                }}
              />
              <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border/80 bg-background p-5">
                <h2 className="text-lg font-semibold">Outcomes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm the results FixFlags should keep watching.
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
                          {outcome.confirmedAt ? 'Confirmed' : 'Inferred'} · Outcome
                        </p>
                        {outcome.pageUrls?.[0] ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {outcome.pageUrls[0]}
                          </p>
                        ) : null}
                      </div>
                      {!outcome.confirmedAt ? (
                        <div className="flex flex-col items-end gap-2">
                          <label className="text-xs text-muted-foreground" htmlFor={`check-${outcome.id}`}>
                            Check
                          </label>
                          <select
                            id={`check-${outcome.id}`}
                            className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
                            value={checkKind[outcome.id] ?? ''}
                            onChange={(event) => setCheckKind((current) => ({
                              ...current,
                              [outcome.id]: event.target.value as '' | 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY',
                            }))}
                          >
                            <option value="">As noted</option>
                            <option value="CHECKOUT">Purchase path</option>
                            <option value="SIGNUP">Form</option>
                            <option value="AVAILABILITY">Page availability</option>
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void confirmOutcome(outcome.id)}
                          >
                            Looks right
                          </Button>
                        </div>
                      ) : (
                        <Check className="h-4 w-4 text-success" />
                      )}
                    </li>
                  ))}
                  {view.outcomes.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Still learning what matters on this Site.</li>
                  ) : null}
                </ul>
              </section>
              <section className="rounded-2xl border border-border/80 bg-background p-5">
                <h2 className="text-lg font-semibold">Coverage</h2>
                <p className="mt-1 text-sm text-muted-foreground">{view.coverageSummary}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {coverageCards.map((card) => (
                      <li key={card.id} className="flex items-center justify-between gap-3">
                        <span>{card.name}</span>
                        <StatusLabel state={card.state}>{card.answer}</StatusLabel>
                      </li>
                    ))}
                  {coverageCards.length === 0 ? (
                    <li className="text-sm text-muted-foreground">{view.coverageSummary}</li>
                  ) : null}
                </ul>
              </section>
              </div>
            </div>
          ) : null}

          <Dialog open={Boolean(selected && activeView === 'home')} onOpenChange={open => { if (!open) setSelectedCard(null) }}>
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
        {([
          ['home', 'Home', LayoutGrid, `/sites/${siteId}`],
          ['flags', 'Flags', Flag, `/sites/${siteId}/flags`],
          ['settings', 'Settings', Globe2, `/sites/${siteId}/settings`],
        ] as const).map(([id, label, Icon, href]) => (
          <Link
            key={id}
            href={href}
            className={cn(
              'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-xs',
              activeView === id ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
            {id === 'flags' && view.flags.length > 0 ? (
              <span className="absolute right-1/4 top-1 rounded-full bg-brand px-1.5 text-3xs text-brand-foreground">
                {view.flags.length}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

    </div>
  )
}

function FlagRow({ siteId, flag }: { siteId: string; flag: SiteFlagSeed }) {
  return (
    <Link
      href={`/sites/${siteId}/flags/${flag.id}`}
      className="flex min-h-11 items-start gap-3 rounded-2xl border border-border/80 bg-background p-5 transition hover:border-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <CircleAlert
        className={cn(
          'mt-0.5 h-5 w-5',
          flag.severity === 'CRITICAL' ? 'text-destructive' : 'text-brand',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {customerFlagContext(flag.area, flag.severity)}
        </p>
        <h3 className="mt-1 font-medium">{flag.problem}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{flag.whyItMatters}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}
