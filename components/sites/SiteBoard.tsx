'use client'


import Link from 'next/link'
import type { Route } from 'next'
import { useRef, useState } from 'react'
import { FileCheck, RefreshCw } from 'lucide-react'
import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { BOARD_CARD_ICONS, BoardGrid, BoardSummaryStrip, ProductBoardCard } from '@/components/sites/BoardCard'
import { RecommendationList, SiteCardFindings } from '@/components/sites/SiteCardFindings'
import { SiteCheckResults } from '@/components/sites/SiteCheckResults'
import { SiteSignupPrompt } from '@/components/sites/SiteSignupPrompt'
import { cardExecution } from '@/lib/sites/card-execution'
import { SiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { SitePreviewCard } from '@/components/layout/SitePreviewCard'
import { UptimeCard } from '@/components/uptime/UptimeCard'
import { UPTIME_COPY as U } from '@/lib/marketing/copy/uptime'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import shellStyles from './SiteShell.module.css'
import { SiteActivityPanel } from '@/components/sites/SiteActivityPanel'
import { useSiteResource } from '@/hooks/useSiteResource'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { MONITORING_COPY } from '@/lib/marketing/copy'
import { siteTrendChecks } from '@/lib/sites/monitoring-history'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { TechnologyStrip, type ToolItem } from '@/components/sites/SiteTooling'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SiteIntegrationsControls } from '@/components/sites/SiteIntegrationsControls'
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
import { createSiteActionController, executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { runBanner } from '@/lib/sites/presentation'

function isEmptyUncheckedCard(card: BoardCardView) {
  return card.id !== 'site' && !card.evidenced && !card.incompleteReason && card.state === 'unknown' && card.openFlagCount === 0 && card.activity !== 'checking'
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

export type SiteBoardView = 'home' | 'timeline' | 'integrations'

export function SiteBoard({ siteId, initial, viewMode = 'home' }: { siteId: string; initial: SiteHomeView; viewMode?: SiteBoardView }) {
  const { user } = useMe()
  const signedIn = Boolean(user)
  const { view, refresh, disconnected: updatesDisconnected } = useSiteResource(siteId, initial)
  const disconnected = updatesDisconnected || Boolean(view.recoveryUnavailable)
  const ownsSite = Boolean(user?.id && view.site.projectId && view.site.userId === user.id)
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const action = useRef(createSiteActionController(`site:${siteId}`)).current
  const [authRequired, setAuthRequired] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const checking = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  const signInHref = `/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}` as Route
  function checkAction(area?: SiteCardArea, identifyArea = false) {
    const name = area ? view.cards.find(card => card.id === area)?.name ?? area : undefined
    const categoryChecking = area && view.activeRuns.some(run => run.scope === 'CATEGORY' && run.targetLabel === name)
    if (ownsSite) return <Button variant="outline" size="sm" className="min-h-11" aria-label={name && identifyArea ? SITE_BOARD_COPY.checkAreaAgain(name) : undefined} disabled={busy || checking || Boolean(categoryChecking) || disconnected} onClick={() => void refreshSiteEvidence(area)}>
      <RefreshCw className="h-4 w-4" aria-hidden />{busy ? SITE_BOARD_COPY.starting : checking || categoryChecking ? SITE_BOARD_COPY.checking : SITE_BOARD_COPY.checkAgain}
    </Button>
    if (!signedIn && !checking && view.audit.id) return <Button asChild variant="outline" size="sm" className="min-h-11">
      <Link href={signInHref}>{SITE_BOARD_COPY.signInToCheckAgain}</Link>
    </Button>
    return null
  }
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
    if (!view.audit.id) return
    await submit(() => executeSiteAction(`/api/reports/${view.audit.id}/retry`, { method: 'POST' }, 'retry'))
  }

  async function verifyOutcome(outcomeId: string) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/outcomes/${outcomeId}/verify`, {
        method: 'POST', headers: { 'Idempotency-Key': action.requestKey(`outcome:${outcomeId}`) },
      }, 'run'), `outcome:${outcomeId}`)
  }

  async function refreshSiteEvidence(area?: SiteCardArea) {
    const category = area && !['site', 'uptime'].includes(area) ? area : null
    const intent = category ? `category:${siteId}:${category}` : `site:${siteId}`
    await submit(() => executeSiteAction(`/api/sites/${siteId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': action.requestKey(intent),
        },
        body: JSON.stringify(category ? { scope: 'category', area: category } : { scope: 'site', outcomeIds: [] }),
      }, 'run'), intent)
  }

  async function submit(mutation: () => Promise<unknown>, intent?: string) {
    if (action.pending) return
    setBusy(true); setToast(null)
    const completed = await action.submit(mutation, () => refresh(), () => { if (intent) action.completeIntent(intent); setToast(SITE_BOARD_COPY.checkStarted); setAuthRequired(false) })
    if (completed.kind === 'refused') { setToast(completed.error.message); setAuthRequired(completed.error.status === 401) }
    else if (completed.kind === 'saved_refresh_pending') setToast(SITE_ACTION_COPY.refreshPending)
    else if (completed.kind === 'saved') { setToast(SITE_BOARD_COPY.checkStarted); setAuthRequired(false) }
    setBusy(false)
  }

  const selected = selectedCard ? view.cards.find((card) => card.id === selectedCard) ?? null : null
  const SelectedIcon = selected ? BOARD_CARD_ICONS[selected.id] : null
  const selectedFlags = selected ? view.flags.filter((flag) => selected.flagIds.includes(flag.id) || flag.area === selected.id) : []
  const findingPages = new Set(selectedFlags.map((flag) => flag.pageUrl).filter(Boolean)).size
  const selectedRecommendations = selected ? (view.recommendations ?? []).filter((item) => item.area === selected.id) : []
  const cardsById = new Map(view.cards.map((card) => [card.id, card]))
  const visibleCategories = view.presentation.categories.filter((category) => {
    const card = cardsById.get(category.id)
    if (!card || category.id === 'uptime') return false
    if (ADDABLE_BOARD_CARDS.includes(category.id)) {
      return card.evidenced || category.flagCount > 0
    }
    if (!STARTER_BOARD_CARDS.includes(category.id)) return false
    return signedIn || checking || !isEmptyUncheckedCard(card)
  })
  const confirmedOutcomes = view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC' && outcome.bindings.some(binding => binding.required)).sort((left, right) => {
    const rank = { FLAG: 0, COULD_NOT_VERIFY: 1, STALE: 2, CLEAR: 3 }
    return rank[left.state] - rank[right.state]
  })
  const pagesNeedingAttention = new Set(view.flags.filter(flag => flag.area === 'site').map(flag => flag.pageUrl ?? view.site.url)).size
  const summaryItems = [
    { value: view.presentation.flags.count, label: checking ? SITE_ACTION_COPY.execution.flagsSoFar : view.presentation.flags.count === 1 ? 'Flag' : 'Flags', state: view.presentation.flags.count > 0 ? 'attention' as const : 'unknown' as const },
  ]
  const technologies: ToolItem[] = (view.technology?.items ?? []).slice(0, 6).map(item => ({
    name: item.name,
    status: view.technology?.status === 'complete' ? 'Detected' : 'Detected in partial check',
    state: view.technology?.status === 'complete' ? 'healthy' : 'attention',
  }))
  const monitoringPoints = siteTrendChecks(view.monitoringTrend).map(item => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.checkedAt)),
    flagCount: item.status === 'FAILED' || item.completionState === 'PARTIAL' || !item.evidenceAt ? null : item.flagCount,
  }))
  const monitoringEvents = (view.monitoringHistory ?? []).toReversed().map(item => ({
    id: item.id ?? item.checkedAt,
    title: item.afterFix ? B.history.afterFix : item.status === 'FAILED' || item.completionState === 'PARTIAL' ? B.incomplete : B.complete,
    detail: item.scope ? [item.trigger === 'SCHEDULED' ? B.history.scheduled : item.trigger === 'MANUAL' ? B.history.manual : item.trigger === 'OTHER' ? B.history.other : null,
      item.scope === 'SITE' ? B.history.site : item.scope === 'CATEGORY' ? item.targetLabel ?? B.history.unknown : item.scope === 'OUTCOMES' ? B.history.outcomes : item.scope === 'DIAGNOSTIC' ? B.history.diagnostic : B.history.unknown,
      item.targetLabel].filter(Boolean).join(' · ') : undefined,
    resultLabel: item.result === 'COULD_NOT_VERIFY' ? B.history.uncertain : item.result === 'FLAG' ? B.history.flagged : item.result === 'CLEAR' ? item.afterFix ? B.history.recovered : B.history.clear : undefined,
    time: formatEvidenceTimestamp(item.checkedAt) ?? item.checkedAt,
    dateTime: item.checkedAt,
    state: item.status === 'FAILED' || item.completionState === 'PARTIAL' || item.result === 'COULD_NOT_VERIFY' || item.scope !== 'SITE' && item.result == null ? 'unknown' as const : item.flagCount > 0 || item.result === 'FLAG' ? 'attention' as const : 'healthy' as const,
    flagCount: item.scope && item.scope !== 'SITE' ? undefined : item.flagCount,
    flags: (item.flags ?? []).map(flag => ({ ...flag, href: `/sites/${siteId}/flags/${flag.id}` })),
  }))
  const banner = runBanner({
    run: view.presentation.run,
    monitoring: view.presentation.monitoring,
    disconnected,
  })
  const showActivityPanel = Boolean(banner && banner.kind !== 'details' && banner.kind !== 'analyzing')
  const uptimeEvents = (view.uptimeEvents ?? []).flatMap(incident => [
    { id: `uptime-down-${incident.id}`, title: U.eventDown, detail: incident.targetUrl, time: formatEvidenceTimestamp(incident.confirmedAt) ?? incident.confirmedAt,
      dateTime: incident.confirmedAt, state: 'attention' as const, evidenceHref: `/sites/${siteId}#category-uptime`, evidenceLabel: U.details },
    ...(incident.recoveredAt ? [{ id: `uptime-recovered-${incident.id}`, title: U.eventRecovered, detail: incident.targetUrl,
      time: formatEvidenceTimestamp(incident.recoveredAt) ?? incident.recoveredAt, dateTime: incident.recoveredAt, state: 'healthy' as const,
      evidenceHref: `/sites/${siteId}#category-uptime`, evidenceLabel: U.details }] : []),
  ])
  const timelineEvents = [...monitoringEvents, ...uptimeEvents].sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))

  return (
    <SiteShell siteId={siteId} ownerId={view.site.userId} activeRoute={viewMode} title={view.presentation.identity.host} description="" presentation={view.presentation} watch={watch} statusMessage={toast}
      analysisStatus={<SiteAnalysisDetails view={view} disconnected={disconnected} />}
      headerAction={!checking ? checkAction() : null}>
      {view.activeRuns.some(run => run.scope !== 'SITE') ? <section className="rounded-card bg-muted/20 p-4" aria-labelledby="scoped-run-heading">
        <h2 id="scoped-run-heading" className="text-sm font-semibold">{SITE_ACTION_COPY.scopedRun.title}</h2>
        <ul className="mt-2 space-y-1 text-sm">{view.activeRuns.filter(run => run.scope !== 'SITE').map(run => <li key={run.id}>
          {run.status === 'INTERRUPTED' ? SITE_ACTION_COPY.scopedRun.interrupted : run.status === 'RUNNING' ? SITE_ACTION_COPY.scopedRun.running : SITE_ACTION_COPY.scopedRun.queued}: {run.targetLabel ?? SITE_ACTION_COPY.scopedRun.unknown}
        </li>)}</ul>
        <p className="mt-2 text-sm text-muted-foreground">{SITE_ACTION_COPY.scopedRun.retained}</p>
      </section> : null}
      {authRequired ? <Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={`/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}`}>{SITE_ACTION_COPY.signInAction}</a></Button> : null}
      {viewMode === 'home' && showActivityPanel ? <SiteActivityPanel banner={banner} disconnected={disconnected} onRetry={ownsSite ? () => refreshSiteEvidence() : undefined} retryBusy={busy}>
      {notice ? (
        <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} />
      ) : summaryNote && view.activity?.state !== 'partial' ? (
        <p className="mt-2 text-sm text-muted-foreground">{summaryNote.body}</p>
      ) : null}
      </SiteActivityPanel> : null}
      {viewMode === 'home' && !view.activity && notice ? <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={retryCheck} retryLoading={busy} /> : null}
      {viewMode === 'home' && !view.activity && summaryNote ? <p role="status" className="text-sm text-muted-foreground">{summaryNote.body}</p> : null}

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

      {viewMode === 'home' ? <section id="website-checks" tabIndex={-1} aria-labelledby="website-cards-heading" className="space-y-3">
        <h2 id="website-cards-heading" className="sr-only">{SITE_BOARD_COPY.cardsHeading}</h2>
        <div className={shellStyles.previewSummary}>
          <SitePreviewCard host={view.presentation.identity.host} captures={view.captures ?? []} />
          <section className={shellStyles.findings} aria-label="Findings summary">
            <h2>{SITE_WORKSPACE_COPY.findings}</h2>
            <BoardSummaryStrip items={summaryItems} onSelect={() => {
              const target = document.querySelector<HTMLElement>('[data-attention="true"]') ?? document.getElementById('website-checks')
              target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: 'instant', block: 'start' })
            }} />
            <p>{checking ? SITE_ACTION_COPY.execution.live : view.presentation.result.label}</p>
            {!checking && view.presentation.freshness.checkedAt ? <p>{view.presentation.freshness.label}</p> : null}
            <TechnologyStrip items={technologies} label={null} />
          </section>
        </div>
        {ownsSite ? <div id="category-uptime" tabIndex={-1} className="pb-3"><UptimeCard siteId={siteId} summary={view.uptime ?? null}
          verification={confirmedOutcomes.filter(outcome => outcome.kind === 'AVAILABILITY' && outcome.inferenceSource !== 'user' && outcome.name === 'This page loads').map(outcome => <OutcomeSummaryCard key={outcome.id}
            compact layout="row" name={SITE_ACTION_COPY.outcome.availability} expectation={outcome.expectation ?? outcome.summary} coverage={outcomeCoverageLabel(outcome.environment, outcome.bindings)} href={`/sites/${siteId}/outcomes/${outcome.id}` as Route}
            answer={outcome.summary !== UNASSESSED_OUTCOME_SUMMARY ? outcome.summary : undefined} freshness={outcomeCardFreshness(outcome)}
            state={outcome.state} running={outcome.running} />)} /></div> : null}
        <BoardGrid layout="rows">
            {visibleCategories.map((category) => {
              const card = cardsById.get(category.id)!
              const execution = checking ? cardExecution(card.id, view.executionProgress) : null
              const displayCard = {
                ...card,
                state: disconnected && category.state === 'checking' ? 'unknown' as const : category.state,
                status: execution?.status ?? category.status,
                activity: disconnected ? null : checking && view.executionProgress ? execution ? 'checking' as const : null : card.activity,
                answer: card.id === 'site' && checking && view.presentation.coverage.pagesReached === 0 && category.flagCount === 0
                  ? SITE_ACTION_COPY.execution.pagesChecking
                  : execution && card.id !== 'site' && !card.evidenced && category.flagCount === 0 ? SITE_ACTION_COPY.execution.areaChecking(card.name) : category.answer,
                detail: execution?.detail ?? (card.id === 'site' ? pagesNeedingAttention ? B.pagesNeedAttention(pagesNeedingAttention) : null : card.detail),
                openFlagCount: category.flagCount,
                ...(card.id === 'site' ? { facts: [], captureUrl: null, captureAlt: null } : {}),
              }
              return <div key={card.id} id={`category-${card.id}`} tabIndex={-1} data-attention={category.flagCount > 0 ? "true" : undefined}><ProductBoardCard compact layout="row" card={displayCard} recoveryAction={card.incompleteReason ? checkAction(card.id, true) : null} renderFlagCopy={flag => <SitePromptCopyButton siteId={siteId} flagId={flag.id} compact iconOnly />} onOpen={() => {
                opener.current = document.activeElement as HTMLElement
                setSelectedCard(card.id)
              }} /></div>
            })}
        </BoardGrid>
      </section> : null}

      {viewMode === 'timeline' ? <section id="timeline" aria-labelledby="timeline-heading"><h2 id="timeline-heading" className="sr-only">Timeline</h2><SiteMonitoringHistory points={monitoringPoints} events={timelineEvents} emptyMessage={B.noHistory} /></section> : null}

      {viewMode === 'integrations' ? <section id="integrations" aria-labelledby="integrations-heading"><div><h2 id="integrations-heading" className="sr-only">Integrations</h2><p className="mt-1 text-sm text-muted-foreground">{B.integrationsBody}</p></div>{ownsSite ? <SiteIntegrationsControls siteId={siteId} initial={view.settings} /> : <p className="mt-4 text-sm text-muted-foreground">Sign in as the website owner to manage integrations.</p>}</section> : null}

      <SiteSignupPrompt key={view.audit.id ?? siteId} siteId={siteId} auditId={view.audit.id} checking={view.presentation.run.state === 'running'} paused={Boolean(selectedCard) || viewMode !== 'home'} />
      <ResponsiveDepth open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedCard(null) }} onCloseAutoFocus={(event) => {
          event.preventDefault()
          opener.current?.focus()
        }}>
          <DialogTitle className="flex items-center gap-3 pr-12 text-2xl">{SelectedIcon ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-muted"><SelectedIcon className="h-5 w-5" aria-hidden /></span> : null}{selected?.name}</DialogTitle>
      {confirmedOutcomes.filter(outcome => !(outcome.kind === 'AVAILABILITY' && outcome.inferenceSource !== 'user' && outcome.name === 'This page loads')).filter(outcome => selected?.id === (outcome.kind === 'AVAILABILITY' ? 'site' : 'conversion')).map((outcome) => (
        <OutcomeSummaryCard
          key={outcome.id}
          compact
          name={outcome.kind === 'AVAILABILITY' && outcome.inferenceSource !== 'user' && outcome.name === 'This page loads' ? SITE_ACTION_COPY.outcome.availability : outcome.name}
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
              {!outcome.running ? <Button size="sm" variant={outcome.state === 'FLAG' ? 'default' : 'outline'} disabled={busy || !outcome.enabled || !outcome.bindings.some((binding) => binding.required)} onClick={() => void verifyOutcome(outcome.id)}>
                Check again
              </Button> : null}
            </div>
          )}
        />
      ))}
          <DialogDescription>{selectedFlags.length ? `${selectedFlags.length} open Flags` : selected?.answer}</DialogDescription>
          {selected && !selected.incompleteReason ? checkAction(selected.id) : null}
          {selected ? (
            <>
              <SiteCardFindings key={selected.id} siteId={siteId} flags={selectedFlags} recommendations={[]} />
              <SiteCheckResults key={`${selected.id}:${view.audit.id}:${selected.checkedAt}:${view.checkResultsNextCursor}`} siteId={siteId} area={selected.id} results={view.checkResults ?? []} nextCursor={view.checkResultsNextCursor} />
              <RecommendationList recommendations={selectedRecommendations} />
              {selected.incompleteReason ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3 text-sm"><p>{selected.incompleteReason.replace(/[.!?]?$/, '.')} {SITE_BOARD_COPY.cardRetryExplanation}</p>{checkAction(selected.id)}</div> : null}
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
            </>
          ) : null}
      </ResponsiveDepth>
    </SiteShell>
  )
}
