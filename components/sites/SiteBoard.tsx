'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { FileCheck } from 'lucide-react'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { BOARD_CARD_ICONS, BoardGrid, ProductBoardCard } from '@/components/sites/BoardCard'
import { SiteCardFindings } from '@/components/sites/SiteCardFindings'
import { SiteActivityPanel } from '@/components/sites/SiteActivityPanel'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SiteCheckLibrary } from '@/components/sites/SiteCheckLibrary'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { SiteShell } from '@/components/sites/SiteShell'
import { OutcomeSummaryCard } from '@/components/sites/OutcomeSummaryCard'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { useMe } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { ADDABLE_BOARD_CARDS, STARTER_BOARD_CARDS, type SiteCardArea } from '@/lib/sites/card-areas'
import { siteCheckNotice, siteSummaryNotice } from '@/lib/sites/check-notice'
import { formatAlertDate, NO_ALERT_DELIVERY, siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { firstOutcomePrompt } from '@/lib/sites/first-outcome'
import { outcomeCoverageLabel, outcomeFreshnessDisclosure, staleOutcomeRecovery, UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import { SITE_BOARD_COPY, WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { projectSiteActivity } from '@/lib/sites/activity'
import { runBanner } from '@/lib/sites/presentation'

function isEmptyUncheckedCard(card: BoardCardView) {
  return card.id !== 'site' && !card.evidenced && card.state === 'unknown' && card.openFlagCount === 0 && card.activity !== 'checking'
}

function outcomeCardFreshness(outcome: SiteHomeView['outcomes'][number]): string {
  const when = outcome.lastVerifiedAt ? formatEvidenceTimestamp(outcome.lastVerifiedAt) : null
  if (!when) return 'No completed verification yet'
  if (outcome.state === 'COULD_NOT_VERIFY') return `Last attempted ${when}`
  if (outcome.state === 'STALE') {
    return `Last verified ${when}. ${outcomeFreshnessDisclosure(outcome.state, outcome.staleAfterMinutes)}`
  }
  return `Last verified ${when}`
}

export function SiteBoard({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  const router = useRouter()
  const { user } = useMe()
  const signedIn = Boolean(user)
  const { view, refresh, disconnected } = useSiteResource(siteId, initial)
  const setView = (update: (current: SiteHomeView) => SiteHomeView) => { void refresh(update(view), { revalidate: false }) }
  const ownsSite = Boolean(user?.id && view.site.projectId && view.site.userId === user.id)
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const checking = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  const watch = view.watch
  // A view predating alert delivery has no evidence to report, which is
  // 'none' rather than a failure. Absent evidence is not a delivery problem.
  const alert = watch.alert ?? NO_ALERT_DELIVERY
  const notice = siteCheckNotice({ status: view.audit.status, failureCode: view.audit.failureCode })
  // Home's own question is what FixFlags is watching. When the answer is nothing
  // yet, that is said here rather than left for the customer to infer.
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

  async function retryCheck() {
    if (!view.audit.id || busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/reports/${view.audit.id}/retry`, { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) return setToast(body.message ?? 'Could not retry this check. Try again.')
      setToast('Check started again')
      setView((current) => ({ ...current,
        activity: projectSiteActivity({ status: 'QUEUED', startedAt: null, failureCode: null, pages: [], events: [] }),
        audit: { ...current.audit, status: 'QUEUED', failureCode: null, progress: 0 } }))
      await refresh()
    } catch {
      setToast('The connection was interrupted. Your evidence is saved. Please try again.')
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
      const body = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push(`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`)
          return
        }
        return setToast(body.message || 'Could not start this verification')
      }
      setToast('Outcome verification started')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function refreshSiteEvidence() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/sites/${siteId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `web:site-care:${siteId}:${Date.now()}`,
        },
        body: JSON.stringify({ scope: 'site', outcomeIds: [] }),
      })
      const body = await response.json().catch(() => ({})) as { auditId?: string | null; message?: string; code?: string }
      if (!response.ok) {
        if (response.status === 401) router.push(`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`)
        // A spent allowance and a busy Site both explain themselves. Replacing
        // that sentence with a generic failure leaves the customer retrying a
        // check that cannot start.
        else setToast(body.message || SITE_BOARD_COPY.checkStartFailed)
        return
      }
      setSelectedCard(null)
      setToast(SITE_BOARD_COPY.checkStarted)
      setView((current) => ({
        ...current,
        audit: {
          ...current.audit,
          id: body.auditId ?? current.audit.id,
          status: 'QUEUED',
          progress: 0,
          walkFinished: false,
          failureCode: null,
        },
        activity: projectSiteActivity({ status: 'QUEUED', startedAt: null, failureCode: null, pages: [], events: [] }),
      }))
      await refresh()
    } catch {
      setToast('The connection was interrupted. Your evidence is saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const selected = selectedCard ? view.cards.find((card) => card.id === selectedCard) ?? null : null
  const SelectedIcon = selected ? BOARD_CARD_ICONS[selected.id] : null
  const selectedFlags = selected ? view.flags.filter((flag) => selected.flagIds.includes(flag.id) || flag.area === selected.id) : []
  const findingPages = new Set(selectedFlags.map((flag) => flag.pageUrl).filter(Boolean)).size
  const selectedRecommendations = selected ? (view.recommendations ?? []).filter((item) => item.area === selected.id) : []
  const cardsById = new Map(view.cards.map((card) => [card.id, card]))
  const visibleCategories = view.presentation.categories.filter((category) => {
    const card = cardsById.get(category.id)
    if (!card) return false
    if (ADDABLE_BOARD_CARDS.includes(category.id)) {
      return card.evidenced || category.flagCount > 0
    }
    if (!STARTER_BOARD_CARDS.includes(category.id)) return false
    return signedIn || checking || !isEmptyUncheckedCard(card)
  })
  const banner = runBanner({
    run: view.presentation.run,
    monitoring: view.presentation.monitoring,
    disconnected,
  })
  const showActivityPanel = Boolean(banner && banner.kind !== 'details')

  return (
    <SiteShell siteId={siteId} ownerId={view.site.userId} activeRoute="home" title={view.presentation.identity.host} description="" presentation={view.presentation} watch={watch} statusMessage={toast}
      headerAction={<SiteCheckLibrary siteId={siteId} view={view} owner={ownsSite} onRefresh={refresh} onOpenCard={setSelectedCard} onCheck={refreshSiteEvidence} />}>
      {showActivityPanel ? <SiteActivityPanel banner={banner} activity={view.activity} disconnected={disconnected} onRetry={ownsSite ? refreshSiteEvidence : undefined} retryBusy={busy}>
      {notice ? (
        <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} />
      ) : summaryNote && view.activity?.state !== 'partial' ? (
        <p className="mt-2 text-sm text-muted-foreground">{summaryNote.body}</p>
      ) : null}
      </SiteActivityPanel> : null}
      {!view.activity && notice ? <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} /> : null}
      {!view.activity && summaryNote ? <p role="status" className="text-sm text-muted-foreground">{summaryNote.body}</p> : null}

      {alertNotice ? (
        <section className="rounded-card border border-border/80 bg-background p-5" role="status">
          <h2 className="text-sm font-semibold">{alertNotice.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {WATCH_ALERT_DELIVERY.undeliveredBody(formatAlertDate(alertNotice.at))}
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href={alertNotice.actionHref as Route}>{alertNotice.actionLabel}</Link>
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="website-cards-heading" className="space-y-3">
        <h2 id="website-cards-heading" className="sr-only">{SITE_BOARD_COPY.cardsHeading}</h2>
        <BoardGrid>
            {visibleCategories.map((category) => {
              const card = cardsById.get(category.id)!
              const displayCard = {
                ...card,
                state: category.state,
                status: category.status,
                answer: category.answer,
                detail: card.id === 'site' ? null : card.detail,
                openFlagCount: category.flagCount,
                ...(card.id === 'site' ? { facts: [], flagIds: [], flagChips: [], captureUrl: null, captureAlt: null } : {}),
              }
              return <ProductBoardCard key={card.id} compact card={displayCard} onOpen={() => {
                opener.current = document.activeElement as HTMLElement
                setSelectedCard(card.id)
              }} />
            })}
      {view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC' && outcome.confirmedAt).map((outcome) => (
        <OutcomeSummaryCard
          key={outcome.id}
          compact
          name={outcome.name}
          href={`/sites/${siteId}/outcomes/${outcome.id}` as Route}
          expectation={outcome.expectation ?? outcome.summary}
          answer={outcome.summary !== UNASSESSED_OUTCOME_SUMMARY ? outcome.summary : undefined}
          coverage={outcomeCoverageLabel(outcome.environment, outcome.bindings)}
          freshness={outcomeCardFreshness(outcome)}
          nextStep={outcome.state === 'STALE' ? staleOutcomeRecovery() : undefined}
          state={outcome.state}
          running={outcome.running}
          label={outcome.enabled ? 'Visitor action' : 'Paused'}
          actions={(
            <div className="flex gap-2">
              {outcome.state === 'FLAG' && outcome.flagId ? <Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${outcome.flagId}`}>Open Flag</Link></Button> : null}
              <Button size="sm" variant={outcome.state === 'FLAG' ? 'brand' : 'outline'} disabled={busy || !outcome.enabled || outcome.running || !outcome.bindings.some((binding) => binding.required)} onClick={() => void verifyOutcome(outcome.id)}>
                {outcome.running ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          )}
        />
      ))}
        </BoardGrid>
        {outcomePrompt && ownsSite ? <Button variant="outline" disabled={busy} onClick={() => void confirmPageOutcome()}>Confirm this page</Button> : null}
      </section>

      <ResponsiveDepth open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedCard(null) }} onCloseAutoFocus={(event) => {
          event.preventDefault()
          opener.current?.focus()
        }}>
          <DialogTitle className="flex items-center gap-3 pr-12 text-2xl">{SelectedIcon ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-muted"><SelectedIcon className="h-5 w-5" aria-hidden /></span> : null}{selected?.name}</DialogTitle>
          <DialogDescription>{selectedFlags.length ? `${selectedFlags.length} open Flags` : selected?.answer}</DialogDescription>
          {selected ? (
            <>
              <SiteCardFindings key={selected.id} siteId={siteId} flags={selectedFlags} recommendations={selectedRecommendations} />
              {selected.incompleteReason ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3 text-sm"><p>{selected.incompleteReason}. {SITE_BOARD_COPY.cardRetryExplanation}</p>{ownsSite ? <Button variant="outline" size="sm" disabled={busy || disconnected} onClick={() => void refreshSiteEvidence()}>{busy ? SITE_BOARD_COPY.checking : SITE_BOARD_COPY.checkAgain}</Button> : null}</div> : null}
              <section className="mt-2 rounded-card border border-border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCheck className="h-4 w-4 text-muted-foreground" aria-hidden />{SITE_BOARD_COPY.findingEvidence}</h3>
              <BoardDetails
                image={selected.captureUrl ? { src: selected.captureUrl, alt: selected.captureAlt ?? selected.name } : null}
                checkedAt={selected.checkedAt} sources={selected.sources}
                coverage={selected.id === 'site' ? 'Page results from the latest check. Areas without sufficient evidence remain unverified.' : selected.coverage ?? (findingPages > 0 ? SITE_BOARD_COPY.findingPageScope(findingPages) : null)}
                facts={selected.id === 'site' ? [] : selected.facts.filter((fact) => fact !== selected.answer && !view.outcomes.some((outcome) => outcome.name === fact && !outcome.confirmedAt))}
                pages={selected.id === 'site' ? view.checkedPages ?? [] : undefined}
              />
              </section>
              {selected.status === SITE_BOARD_COPY.checkOutOfDate ? (
                ownsSite ? (
                  <Button className="mt-1 w-fit" variant="brand" disabled={busy} onClick={() => void refreshSiteEvidence()}>
                    {busy ? SITE_BOARD_COPY.checking : SITE_BOARD_COPY.checkAgain}
                  </Button>
                ) : !signedIn ? (
                  <Button asChild className="mt-1 w-fit" variant="brand">
                    <Link href={`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`}>{SITE_BOARD_COPY.signInToCheckAgain}</Link>
                  </Button>
                ) : null
              ) : null}
            </>
          ) : null}
      </ResponsiveDepth>
    </SiteShell>
  )
}
