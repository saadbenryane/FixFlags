'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { BoardGrid, BoardSurface, ProductBoardCard } from '@/components/sites/BoardCard'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { SiteFlagRow } from '@/components/sites/SiteFlagRow'
import { SiteShell } from '@/components/sites/SiteShell'
import { OutcomeSummaryCard } from '@/components/sites/OutcomeSummaryCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useMe } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { STARTER_BOARD_CARDS, type SiteCardArea } from '@/lib/sites/card-areas'
import { siteCheckNotice, siteSummaryNotice } from '@/lib/sites/check-notice'
import { formatAlertDate, NO_ALERT_DELIVERY, siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { firstOutcomePrompt, homeBoardLead } from '@/lib/sites/first-outcome'
import { outcomeCoverageLabel } from '@/lib/sites/outcome-state'
import { WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'

function isEmptyUncheckedCard(card: BoardCardView) {
  return card.id !== 'site' && card.state === 'unknown' && card.openFlagCount === 0 && card.activity !== 'checking'
}

export function SiteBoard({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  const router = useRouter()
  const { user } = useMe()
  const signedIn = Boolean(user)
  const [view, setView] = useState(initial)
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const checking = view.audit.status != null && !['COMPLETED', 'FAILED'].includes(view.audit.status)
  const watch = view.watch ?? {
    state: view.watching ? 'watching' : 'off', interval: null, nextRunAt: null,
    lastError: null, covered: view.watching, label: view.watching ? 'Watching weekly' : 'Not watching',
  }
  // A view predating alert delivery has no evidence to report, which is
  // 'none' rather than a failure. Absent evidence is not a delivery problem.
  const alert = watch.alert ?? NO_ALERT_DELIVERY
  const notice = siteCheckNotice({ status: view.audit.status, failureCode: view.audit.failureCode })
  // A Site can be checked on schedule and still never tell the customer anything.
  // The notice is stated rather than implied, because silence here reads as
  // "all clear" when it is the opposite.
  const alertNotice = siteWatchAlertNotice(alert)
  const summaryNote = siteSummaryNotice({ status: view.audit.status, failureCode: view.audit.failureCode })
  const outcomePrompt = firstOutcomePrompt({
    checking,
    walkFinished: view.audit.walkFinished,
    customerOutcomeCount: view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC').length,
  })

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/sites/${siteId}`, { cache: 'no-store' })
    if (response.ok) setView(await response.json() as SiteHomeView)
  }, [siteId])

  useEffect(() => {
    if (!checking) return
    const timer = setInterval(() => void refresh(), 2500)
    return () => clearInterval(timer)
  }, [checking, refresh])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  async function retryCheck() {
    if (!view.audit.id || busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/reports/${view.audit.id}/retry`, { method: 'POST' })
      if (!response.ok) return setToast('Could not retry this check. Try again.')
      setToast('Check started again')
      setView((current) => ({ ...current, audit: { ...current.audit, status: 'QUEUED', failureCode: null, progress: 0 } }))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function confirmPageOutcome() {
    setBusy(true)
    try {
      const response = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchPage: true }),
      })
      if (response.ok) {
        const body = await response.json().catch(() => ({})) as { outcome?: SiteHomeView['outcomes'][number] }
        setToast('This page is confirmed')
        if (body.outcome?.kind && body.outcome.kind !== 'GENERIC') {
          setView((current) => ({
            ...current,
            outcomes: current.outcomes.some((outcome) => outcome.id === body.outcome?.id) ? current.outcomes : [...current.outcomes, body.outcome!],
          }))
        }
        await refresh()
      } else if (response.status === 401 || response.status === 403) {
        router.push(`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`)
      } else setToast('Could not confirm this page. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyOutcome(outcomeId: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        method: 'POST', headers: { 'Idempotency-Key': `web:${outcomeId}:${Date.now()}` },
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) return setToast(body.error || 'Could not start this verification')
      setToast('Outcome verification started')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const selected = selectedCard ? view.cards.find((card) => card.id === selectedCard) ?? null : null
  const selectedFlags = selected ? view.flags.filter((flag) => selected.flagIds.includes(flag.id) || flag.area === selected.id) : []
  const selectedRecommendations = selected ? (view.recommendations ?? []).filter((item) => item.area === selected.id) : []
  const visibleCards = view.cards.filter((card) => {
    if (!STARTER_BOARD_CARDS.includes(card.id)) return false
    return signedIn || checking || !isEmptyUncheckedCard(card)
  })
  const description = homeBoardLead({
    checking, hasOutcomePrompt: Boolean(outcomePrompt), flagCount: view.flags.length,
    healthy: view.statusState === 'healthy', coverageSummary: view.coverageSummary, watchCovered: watch.covered,
  })

  return (
    <SiteShell siteId={siteId} activeRoute="home" title="Site home" description={description} flagCount={view.flags.length} watch={watch} checking={checking} statusMessage={toast}>
      {notice ? (
        <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} />
      ) : summaryNote ? (
        <p className="rounded-2xl border border-border/80 bg-background p-4 text-sm text-muted-foreground" role="status">{summaryNote.body}</p>
      ) : null}

      {alertNotice ? (
        <section className="rounded-2xl border border-border/80 bg-background p-5" role="status">
          <h2 className="text-sm font-semibold">{alertNotice.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {WATCH_ALERT_DELIVERY.undeliveredBody(formatAlertDate(alertNotice.at))}
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href={alertNotice.actionHref as Route}>{alertNotice.actionLabel}</Link>
          </Button>
        </section>
      ) : null}

      {outcomePrompt ? (
        <section className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6">
          <p className="text-sm font-medium text-muted-foreground">Outcome setup</p>
          <h2 className="mt-1 text-xl font-semibold">{outcomePrompt.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{outcomePrompt.body}</p>
          <Button className="mt-4" variant="brand" disabled={busy} onClick={() => void confirmPageOutcome()}>{outcomePrompt.action}</Button>
        </section>
      ) : null}

      {view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC').map((outcome) => (
        <OutcomeSummaryCard
          key={outcome.id}
          name={outcome.name}
          href={`/sites/${siteId}/outcomes/${outcome.id}` as Route}
          expectation={outcome.expectation ?? outcome.summary}
          coverage={outcomeCoverageLabel(outcome.environment, outcome.bindings)}
          freshness={outcome.lastVerifiedAt ? `${outcome.state === 'COULD_NOT_VERIFY' ? 'Last attempted' : 'Last verified'} ${new Date(outcome.lastVerifiedAt).toLocaleString()}` : 'No completed verification yet'}
          state={outcome.state}
          running={outcome.running}
          actions={(
            <div className="flex gap-2">
              {outcome.state === 'FLAG' && outcome.flagId ? <Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${outcome.flagId}`}>Open Flag</Link></Button> : null}
              <Button size="sm" variant={outcome.state === 'FLAG' ? 'brand' : 'outline'} disabled={busy || outcome.running || !outcome.bindings.some((binding) => binding.required)} onClick={() => void verifyOutcome(outcome.id)}>
                {outcome.running ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          )}
        />
      ))}

      {view.flags.length > 0 ? (
        <section className="space-y-3" aria-labelledby="site-flags-heading">
          <h2 id="site-flags-heading" className="text-lg font-semibold">Current Flags <span className="text-sm font-normal text-muted-foreground">{view.flags.length}</span></h2>
          {view.flags.map((flag) => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}
        </section>
      ) : null}

      <section aria-labelledby="broader-health-heading">
        <h2 id="broader-health-heading" className="mb-3 text-lg font-semibold">Broader health and recommendations</h2>
        <BoardSurface host={view.host} state={view.statusState} label={view.statusLabel} count={view.flags.length} onOpen={() => {
          opener.current = document.activeElement as HTMLElement
          setSelectedCard('site')
        }}>
          <BoardGrid>
            {visibleCards.map((card) => <ProductBoardCard key={card.id} card={card} onOpen={() => {
              opener.current = document.activeElement as HTMLElement
              setSelectedCard(card.id)
            }} />)}
          </BoardGrid>
        </BoardSurface>
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedCard(null) }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-32px)] max-w-xl overflow-y-auto rounded-2xl bg-background p-6 sm:p-8" onCloseAutoFocus={(event) => {
          event.preventDefault()
          opener.current?.focus()
        }}>
          <DialogTitle className="pr-8 text-2xl">{selected?.name}</DialogTitle>
          <DialogDescription>{selected?.question}</DialogDescription>
          {selected ? (
            <>
              <p className="text-xl font-semibold tracking-tight">{selectedFlags.length ? `${selectedFlags.length} ${selectedFlags.length === 1 ? 'Flag' : 'Flags'}` : selected.answer}</p>
              <BoardDetails
                image={selected.captureUrl ? { src: selected.captureUrl, alt: selected.captureAlt ?? selected.name } : null}
                checkedAt={selected.checkedAt} sources={selected.sources}
                coverage={selected.id === 'site' ? 'Page results from the latest check. Areas without sufficient evidence remain unverified.' : selected.coverage}
                facts={selected.id === 'site' ? [] : selected.facts.filter((fact) => fact !== selected.answer)}
                pages={selected.id === 'site' ? view.checkedPages ?? [] : undefined}
              />
              <div className="mt-5 space-y-3">
                {selectedFlags.length === 0 ? <p className="text-sm text-muted-foreground">No open Flags in this area.</p> : selectedFlags.map((flag) => (
                  <Link key={flag.id} href={`/sites/${siteId}/flags/${flag.id}`} className="flex items-start justify-between gap-3 rounded-card border border-border/70 p-4">
                    <p className="line-clamp-2 font-medium">{flag.problem}</p><ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ))}
                {selectedRecommendations.length > 0 ? (
                  <div className="pt-2"><p className="text-sm font-medium text-muted-foreground">Recommendations</p>
                    <ul className="mt-2 space-y-2">{selectedRecommendations.map((item) => <li key={item.id} className="rounded-card border border-dashed border-border/70 p-3 text-sm text-muted-foreground">{item.problem}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SiteShell>
  )
}
