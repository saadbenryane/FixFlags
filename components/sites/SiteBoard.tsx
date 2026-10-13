'use client'


import { AuditFailurePanel } from '@/components/audit/AuditFailurePanel'
import { SiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { ProductBoardCard } from '@/components/sites/BoardCard'
import { SiteOverview } from '@/components/sites/SiteOverview'
import { SiteCheckSections } from '@/components/sites/SiteCheckSections'
import { OutcomeSummaryCard } from '@/components/sites/OutcomeSummaryCard'
import { SiteActivityPanel } from '@/components/sites/SiteActivityPanel'
import { SiteMonitoringHistory } from '@/components/sites/SiteMonitoringHistory'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteSignupPrompt } from '@/components/sites/SiteSignupPrompt'
import { Button } from '@/components/ui/button'
import { UptimeCard } from '@/components/uptime/UptimeCard'
import { useMe } from '@/hooks/useMe'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SITE_BOARD_COPY,WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { outcomeCardFreshness,projectSiteBoard } from '@/lib/sites/board-view'
import { type SiteCardArea } from '@/lib/sites/card-areas'
import { cardExecution } from '@/lib/sites/card-execution'
import { siteCheckNotice,siteSummaryNotice } from '@/lib/sites/check-notice'
import { createSiteActionController,executeSiteAction } from '@/lib/sites/client-actions'
import { outcomeCoverageLabel,UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import { runBanner } from '@/lib/sites/presentation'
import { formatAlertDate,NO_ALERT_DELIVERY,siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { RefreshCw } from 'lucide-react'
import type { Route } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRef,useState } from 'react'

const SiteCategoryDetails = dynamic(() => import('./SiteCategoryDetails').then(module => module.SiteCategoryDetails))
const SiteIntegrationsControls = dynamic(() => import('./SiteIntegrationsControls').then(module => module.SiteIntegrationsControls))

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

  const { selected, selectedFlags, findingPages, selectedRecommendations, cardsById, visibleCategories,
    confirmedOutcomes, pagesNeedingAttention, summaryItems, technologies, monitoringPoints, timelineEvents } =
    projectSiteBoard(view, siteId, signedIn, checking, selectedCard)
  const banner = runBanner({
    run: view.presentation.run,
    monitoring: view.presentation.monitoring,
    disconnected,
  })
  const showActivityPanel = Boolean(banner && banner.kind !== 'details' && banner.kind !== 'analyzing')

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
        <SiteOverview host={view.presentation.identity.host} captures={view.captures ?? []} summaryItems={summaryItems}
          notice={['flags', 'clear'].includes(view.presentation.result.state) ? undefined : checking ? SITE_ACTION_COPY.execution.live : view.presentation.result.label}
          technologies={technologies} onSelectSummary={item => {
            if (item.id === 'pages') { opener.current = document.activeElement as HTMLElement; setSelectedCard('site'); return }
            const target = document.querySelector<HTMLElement>('[data-attention="true"]') ?? document.getElementById('website-checks')
            target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: 'instant', block: 'start' })
          }} />
        <SiteCheckSections uptime={ownsSite ? <div id="category-uptime" tabIndex={-1}><UptimeCard siteId={siteId} summary={view.uptime ?? null}
          verification={confirmedOutcomes.filter(outcome => outcome.kind === 'AVAILABILITY' && outcome.inferenceSource !== 'user' && outcome.name === 'This page loads').map(outcome => <OutcomeSummaryCard key={outcome.id}
            compact layout="row" name={SITE_ACTION_COPY.outcome.availability} expectation={outcome.expectation ?? outcome.summary} coverage={outcomeCoverageLabel(outcome.environment, outcome.bindings)} href={`/sites/${siteId}/outcomes/${outcome.id}` as Route}
            answer={outcome.summary !== UNASSESSED_OUTCOME_SUMMARY ? outcome.summary : undefined} freshness={outcomeCardFreshness(outcome)}
            state={outcome.state} running={outcome.running} />)} /></div> : null}
            items={visibleCategories.map((category) => {
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
              return { id: card.id, flagCount: category.flagCount,
                healthy: !checking && displayCard.state === 'healthy' && category.flagCount === 0 && displayCard.activity !== 'checking' && !card.incompleteReason,
                render: (layout: 'card' | 'row') => <div id={`category-${card.id}`} tabIndex={-1} data-attention={category.flagCount > 0 ? "true" : undefined}><ProductBoardCard compact layout={layout} card={displayCard} recoveryAction={card.incompleteReason ? checkAction(card.id, true) : null} renderFlagCopy={flag => <SitePromptCopyButton siteId={siteId} flagId={flag.id} compact iconOnly />} onOpen={() => {
                opener.current = document.activeElement as HTMLElement
                setSelectedCard(card.id)
              }} /></div> }
            })} />
      </section> : null}

      {viewMode === 'timeline' ? <section id="timeline" aria-labelledby="timeline-heading"><h2 id="timeline-heading" className="sr-only">Timeline</h2><SiteMonitoringHistory points={monitoringPoints} events={timelineEvents} emptyMessage={B.noHistory} /></section> : null}

      {viewMode === 'integrations' ? <section id="integrations" aria-labelledby="integrations-heading"><div><h2 id="integrations-heading" className="sr-only">Integrations</h2><p className="mt-1 text-sm text-muted-foreground">{B.integrationsBody}</p></div>{ownsSite ? <SiteIntegrationsControls siteId={siteId} initial={view.settings} /> : <p className="mt-4 text-sm text-muted-foreground">Sign in as the website owner to manage integrations.</p>}</section> : null}

      <SiteSignupPrompt key={view.audit.id ?? siteId} siteId={siteId} auditId={view.audit.id} checking={view.presentation.run.state === 'running'} paused={Boolean(selectedCard) || viewMode !== 'home'} />
      {selected ? <SiteCategoryDetails selected={selected} selectedFlags={selectedFlags} selectedRecommendations={selectedRecommendations}
        confirmedOutcomes={confirmedOutcomes} findingPages={findingPages} siteId={siteId} view={view} busy={busy}
        checkAction={checkAction} verifyOutcome={verifyOutcome} onClose={() => setSelectedCard(null)} restoreFocus={() => opener.current?.focus()} /> : null}
    </SiteShell>
  )
}
