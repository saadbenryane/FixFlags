'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FileCheck, RefreshCw } from 'lucide-react'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { BOARD_CARD_ICONS, BoardGrid, BoardSummaryStrip, ProductBoardCard } from '@/components/sites/BoardCard'
import { RecommendationList, SiteCardFindings } from '@/components/sites/SiteCardFindings'
import { SiteCheckResults } from '@/components/sites/SiteCheckResults'
import { SiteActivityPanel } from '@/components/sites/SiteActivityPanel'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SiteCheckLibrary } from '@/components/sites/SiteCheckLibrary'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { MONITORING_COPY } from '@/lib/marketing/copy'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { SiteMonitoringActivation } from '@/components/sites/SiteMonitoringActivation'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { SiteMonitoringSchedule } from '@/components/sites/SiteMonitoringSchedule'
import { nextCheckCompactLabel, nextCheckLabel, scheduleFromWatch, scheduleLabel } from '@/lib/sites/monitoring-schedule'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { IntegrationList, TechnologyStrip, type ToolItem } from '@/components/sites/SiteTooling'
import { SiteFlagRow } from '@/components/sites/SiteFlagRow'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
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

export type SiteBoardView = 'home' | 'flags' | 'monitoring' | 'integrations'

export function SiteBoard({ siteId, initial, viewMode = 'home' }: { siteId: string; initial: SiteHomeView; viewMode?: SiteBoardView }) {
  const router = useRouter()
  const { user } = useMe()
  const signedIn = Boolean(user)
  const { view, refresh, disconnected: updatesDisconnected } = useSiteResource(siteId, initial)
  const disconnected = updatesDisconnected || Boolean(view.recoveryUnavailable)
  const setView = (update: (current: SiteHomeView) => SiteHomeView) => { void refresh(update(view), { revalidate: false }) }
  const ownsSite = Boolean(user?.id && view.site.projectId && view.site.userId === user.id)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
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
      setToast(SITE_BOARD_COPY.connectionInterrupted)
    } finally {
      setBusy(false)
    }
  }

  async function verifyOutcome(outcomeId: string) {
    if (busy) return
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
      setToast(SITE_BOARD_COPY.checkStarted)
      await refresh()
    } catch {
      setToast(SITE_BOARD_COPY.connectionInterrupted)
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
      setToast(SITE_BOARD_COPY.connectionInterrupted)
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
  const confirmedOutcomes = view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC' && outcome.confirmedAt).sort((left, right) => {
    const rank = { FLAG: 0, COULD_NOT_VERIFY: 1, STALE: 2, CLEAR: 3 }
    return rank[left.state] - rank[right.state]
  })
  const pagesNeedingAttention = new Set(view.flags.filter(flag => flag.area === 'site').map(flag => flag.pageUrl ?? view.site.url)).size
  const pageCount = view.checkedPages?.length ?? view.presentation.coverage.pagesExpected
  const pageEvidence = Boolean(pageCount && cardsById.get('site')?.evidenced && cardsById.get('site')?.state === 'healthy')
  const monitoringActive = view.watch.state === 'watching'
  const monitoringCadence = scheduleLabel(scheduleFromWatch(view.watch.interval, view.watch.everyMinutes))
  const summaryItems = [
    { value: view.presentation.flags.count, label: view.presentation.flags.count === 1 ? 'Flag' : 'Flags', state: 'attention' as const },
    { id: 'pages', value: pageCount, label: B.pages, detail: pagesNeedingAttention ? B.pagesNeedAttention(pagesNeedingAttention) : pageEvidence ? B.noPageFlags : pageCount ? B.pagesUnknown : B.pagesUnchecked, state: pagesNeedingAttention ? 'attention' as const : pageEvidence ? 'healthy' as const : 'unknown' as const },
    { id: 'monitoring', value: M.title, label: monitoringActive ? monitoringCadence : view.watch.interval ? view.watch.label : M.off, detail: view.watch.interval ? now === null ? M.scheduled : nextCheckCompactLabel(view.watch.nextRunAt, now) : M.noNext, accessibleDetail: view.watch.interval && now !== null ? nextCheckLabel(view.watch.nextRunAt, now) : M.notScheduled, state: monitoringActive ? 'healthy' as const : 'unknown' as const },
  ]
  const technologies: ToolItem[] = (view.technology?.items ?? []).slice(0, 6).map(item => ({
    name: item.name,
    status: view.technology?.status === 'complete' ? 'Detected' : 'Detected in partial check',
    state: view.technology?.status === 'complete' ? 'healthy' : 'attention',
  }))
  const detectedTechnologies = new Set((view.technology?.items ?? []).map(item => item.name))
  const framework = ['Next.js', 'React', 'WordPress', 'Webflow', 'Shopify'].find(name => detectedTechnologies.has(name))
  const connectionItem = (name: string, status: string, detail: string, configured: boolean, anchor: string): ToolItem => {
    const connected = status === 'connected'
    const detected = detectedTechnologies.has(name) ? name : name === 'Google Search Console' ? framework : undefined
    const href = `/sites/${siteId}/settings#${anchor}`
    return {
      name,
      detail: connected ? detail : `${detected ? `${B.detected(detected)} ` : ''}${configured ? detail : B.connectionUnavailable}`,
      status: connected ? B.connected : B.connect,
      state: connected ? 'healthy' : 'attention',
      suggested: !connected && Boolean(detected),
      actionHref: ownsSite ? href : `/sign-in?next=${encodeURIComponent(href)}`,
      actionDisabled: !connected && !configured,
    }
  }
  const integrations: ToolItem[] = [
    connectionItem('Shopify', view.settings.shopify.state, view.settings.shopify.domain ?? 'Store and product context', view.settings.shopify.configured !== false, 'connection-shopify'),
    connectionItem('Google Analytics', view.settings.analytics.status, view.settings.analytics.propertyLabel ?? 'Audience context', view.settings.analytics.configured, 'connection-analytics'),
    connectionItem('Google Search Console', view.settings.searchConsole.status, view.settings.searchConsole.propertyLabel ?? 'Search performance context', view.settings.searchConsole.configured, 'connection-search-console'),
  ]
  const monitoringPoints = (view.monitoringHistory ?? []).map(item => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.checkedAt)),
    flagCount: item.flagCount,
  }))
  const monitoringEvents = (view.monitoringHistory ?? []).toReversed().map(item => ({
    id: item.id ?? item.checkedAt,
    title: item.status === 'FAILED' ? B.incomplete : B.complete,
    time: formatEvidenceTimestamp(item.checkedAt) ?? item.checkedAt,
    dateTime: item.checkedAt,
    state: item.status === 'FAILED' ? 'unknown' as const : item.flagCount > 0 ? 'attention' as const : 'healthy' as const,
    flagCount: item.flagCount,
    flags: (item.flags ?? []).map(flag => ({ ...flag, href: `/sites/${siteId}/flags/${flag.id}` })),
  }))
  const banner = runBanner({
    run: view.presentation.run,
    monitoring: view.presentation.monitoring,
    disconnected,
  })
  const showActivityPanel = Boolean(banner && banner.kind !== 'details')

  return (
    <SiteShell siteId={siteId} ownerId={view.site.userId} activeRoute={viewMode} title={view.presentation.identity.host} description="" presentation={view.presentation} watch={watch} statusMessage={toast}
      headerAction={<>
        {ownsSite ? <span className="text-xs text-muted-foreground sm:text-sm">{view.presentation.freshness.label.replace(/^Checked\s+/, '')}</span> : null}
        {ownsSite ? <Button variant="outline" size="sm" className="min-h-11" disabled={busy || checking || disconnected} onClick={() => void refreshSiteEvidence()}>
          <RefreshCw className="h-4 w-4" aria-hidden />{checking ? SITE_BOARD_COPY.checking : 'Recheck'}
        </Button> : null}
        <SiteCheckLibrary open={libraryOpen} onOpenChange={setLibraryOpen} siteId={siteId} view={view} owner={ownsSite} onRefresh={refresh} onOpenCard={setSelectedCard} onCheck={refreshSiteEvidence} />
      </>}>
      {viewMode === 'home' && showActivityPanel ? <SiteActivityPanel banner={banner} activity={view.activity} disconnected={disconnected} onRetry={ownsSite ? refreshSiteEvidence : undefined} retryBusy={busy}>
      {notice ? (
        <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} />
      ) : summaryNote && view.activity?.state !== 'partial' ? (
        <p className="mt-2 text-sm text-muted-foreground">{summaryNote.body}</p>
      ) : null}
      </SiteActivityPanel> : null}
      {viewMode === 'home' && !view.activity && notice ? <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} /> : null}
      {viewMode === 'home' && !view.activity && summaryNote ? <p role="status" className="text-sm text-muted-foreground">{summaryNote.body}</p> : null}

      {viewMode === 'home' ? <SiteMonitoringActivation hideSettled siteId={siteId} view={view} owner={ownsSite} checking={checking} onRefresh={refresh} onExploreCoverage={() => setLibraryOpen(true)} /> : null}
      {viewMode === 'home' && alertNotice ? (
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

      {viewMode === 'home' ? <section aria-labelledby="website-cards-heading" className="space-y-3">
        <h2 id="website-cards-heading" className="sr-only">{SITE_BOARD_COPY.cardsHeading}</h2>
        <TechnologyStrip items={technologies} label={null} />
        <BoardSummaryStrip items={summaryItems} onSelect={(item) => {
          if (item.label.includes('Flag')) router.push(`/sites/${siteId}?view=flags#flags`)
          else if (item.id === 'monitoring') {
            if (ownsSite) setScheduleOpen(true)
            else router.push(`/sites/${siteId}?view=monitoring#monitoring`)
          }
          else if (item.id === 'pages') { opener.current = document.activeElement as HTMLElement; setSelectedCard('site') }
          else setLibraryOpen(true)
        }} />
        <BoardGrid layout="rows">
      {confirmedOutcomes.map((outcome) => (
        <OutcomeSummaryCard
          key={outcome.id}
          compact
          name={outcome.name}
          href={`/sites/${siteId}/outcomes/${outcome.id}` as Route}
          expectation={outcome.expectation ?? outcome.summary}
          answer={outcome.kind === 'AVAILABILITY' && outcome.state === 'CLEAR' ? MONITORING_COPY.pageClear : outcome.summary !== UNASSESSED_OUTCOME_SUMMARY ? outcome.summary : undefined}
          coverage={outcomeCoverageLabel(outcome.environment, outcome.bindings)}
          freshness={outcomeCardFreshness(outcome)}
          nextStep={outcome.state === 'STALE' ? staleOutcomeRecovery() : undefined}
          state={outcome.state}
          running={outcome.running}
          label={outcome.enabled ? SITE_BOARD_COPY.websiteCheck : 'Paused'}
          layout="row"
          actions={(
            <div className="flex gap-2">
              {outcome.state === 'FLAG' && outcome.flagId ? <Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${outcome.flagId}`}>Open Flag</Link></Button> : null}
              <Button size="sm" variant={outcome.state === 'FLAG' ? 'brand' : 'outline'} disabled={busy || !outcome.enabled || outcome.running || !outcome.bindings.some((binding) => binding.required)} onClick={() => void verifyOutcome(outcome.id)}>
                {outcome.running ? 'Checking again…' : 'Check again'}
              </Button>
            </div>
          )}
        />
      ))}
            {visibleCategories.map((category) => {
              const card = cardsById.get(category.id)!
              const displayCard = {
                ...card,
                state: category.state,
                status: category.status,
                answer: category.answer,
                detail: card.id === 'site' ? null : card.detail,
                openFlagCount: category.flagCount,
                ...(card.id === 'site' ? { facts: [], captureUrl: null, captureAlt: null } : {}),
              }
              return <ProductBoardCard key={card.id} compact layout="row" card={displayCard} renderFlagCopy={flag => <SitePromptCopyButton siteId={siteId} flagId={flag.id} compact iconOnly />} onOpen={() => {
                opener.current = document.activeElement as HTMLElement
                setSelectedCard(card.id)
              }} />
            })}
        </BoardGrid>
      </section> : null}

      {viewMode === 'flags' ? <section id="flags" className="space-y-4" aria-labelledby="flags-heading">
        <div><h2 id="flags-heading" className="text-xl font-semibold">Flags</h2><p className="mt-1 text-sm text-muted-foreground">Everything that needs attention on this Site.</p></div>
        {view.flags.length > 0 ? <div className="space-y-2">{view.flags.map(flag => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}</div>
          : <p className="rounded-2xl bg-muted/50 p-6 text-sm text-muted-foreground">No open Flags for the checked scope.</p>}
      </section> : null}

      {viewMode === 'monitoring' ? <section id="monitoring" aria-labelledby="monitoring-heading"><h2 id="monitoring-heading" className="sr-only">{M.title}</h2><SiteMonitoringHistory points={monitoringPoints} events={monitoringEvents} emptyMessage={B.noHistory} /></section> : null}

      {viewMode === 'integrations' ? <section id="integrations" aria-labelledby="integrations-heading"><div><h2 id="integrations-heading" className="text-xl font-semibold">Integrations</h2><p className="mt-1 text-sm text-muted-foreground">{B.integrationsBody}</p></div><IntegrationList items={integrations} /></section> : null}

      {scheduleOpen && ownsSite ? <SiteMonitoringSchedule siteId={siteId} interval={view.watch.interval} everyMinutes={view.watch.everyMinutes} onClose={() => setScheduleOpen(false)} onRefresh={refresh} /> : null}
      <ResponsiveDepth open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedCard(null) }} onCloseAutoFocus={(event) => {
          event.preventDefault()
          opener.current?.focus()
        }}>
          <DialogTitle className="flex items-center gap-3 pr-12 text-2xl">{SelectedIcon ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-muted"><SelectedIcon className="h-5 w-5" aria-hidden /></span> : null}{selected?.name}</DialogTitle>
          <DialogDescription>{selectedFlags.length ? `${selectedFlags.length} open Flags` : selected?.answer}</DialogDescription>
          {selected && ownsSite ? <Button variant="outline" size="sm" className="w-fit" disabled={busy || checking || disconnected} onClick={() => void refreshSiteEvidence()}><RefreshCw size={15} aria-hidden="true" />{checking ? SITE_BOARD_COPY.checking : 'Recheck'}</Button> : null}
          {selected ? (
            <>
              <SiteCardFindings key={selected.id} siteId={siteId} flags={selectedFlags} recommendations={[]} />
              <SiteCheckResults key={`${selected.id}:${view.audit.id}`} siteId={siteId} area={selected.id} results={view.checkResults ?? []} nextCursor={view.checkResultsNextCursor} />
              <RecommendationList recommendations={selectedRecommendations} />
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
