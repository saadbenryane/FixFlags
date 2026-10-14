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
import { SiteActionFeedback } from './SiteActionFeedback'
import { SiteActionContinuation } from './SiteActionContinuation'
import { Button } from '@/components/ui/button'
import { UptimeCard } from '@/components/uptime/UptimeCard'
import { useMe } from '@/hooks/useMe'
import { useSiteResource } from '@/hooks/useSiteResource'
import { SITE_BOARD_COPY,WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { outcomeCardFreshness,projectSiteBoard } from '@/lib/sites/board-view'
import { siteCardArea, type SiteCardArea } from '@/lib/sites/card-areas'
import { cardExecution } from '@/lib/sites/card-execution'
import { siteCheckNotice,siteSummaryNotice } from '@/lib/sites/check-notice'
import { createSiteActionController,executeSiteAction,type SiteActionError } from '@/lib/sites/client-actions'
import { outcomeCoverageLabel,UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import { helpHrefForFailureCode } from '@/lib/help/contextual'
import { runBanner } from '@/lib/sites/presentation'
import { formatAlertDate,NO_ALERT_DELIVERY,siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { RefreshCw } from 'lucide-react'
import type { Route } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect,useRef,useState } from 'react'

const SiteCategoryDetails = dynamic(() => import('./SiteCategoryDetails').then(module => module.SiteCategoryDetails))
const SiteIntegrationsControls = dynamic(() => import('./SiteIntegrationsControls').then(module => module.SiteIntegrationsControls))

export type SiteBoardView = 'home' | 'timeline' | 'integrations'

export function SiteBoard({ siteId, initial, viewMode = 'home', initialCategory = null }: { siteId: string; initial: SiteHomeView; viewMode?: SiteBoardView; initialCategory?: SiteCardArea | null }) {
  const { user } = useMe()
  const signedIn = Boolean(user)
  const { view, refresh, disconnected: updatesDisconnected } = useSiteResource(siteId, initial)
  const disconnected = updatesDisconnected || Boolean(view.recoveryUnavailable)
  const ownsSite = view.actions.ownership === 'owner'
  const [selectedCard, setSelectedCard] = useState<SiteCardArea | null>(initialCategory)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const action = useRef(createSiteActionController(`site:${siteId}`)).current
  const [actionError, setActionError] = useState<SiteActionError | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => { setSelectedCard(viewMode === 'home' ? initialCategory : null) }, [siteId, initialCategory, viewMode])
  useEffect(() => {
    const restoreCategory = () => setSelectedCard(siteCardArea(new URL(window.location.href).searchParams.get('category')))
    window.addEventListener('popstate', restoreCategory)
    return () => window.removeEventListener('popstate', restoreCategory)
  }, [])
  function selectCategory(area: SiteCardArea | null) {
    setSelectedCard(area)
    const url = new URL(window.location.href)
    if (area) url.searchParams.set('category', area)
    else url.searchParams.delete('category')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
  const checking = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  function checkAction(area?: SiteCardArea, identifyArea = false) {
    const name = area ? view.cards.find(card => card.id === area)?.name ?? area : undefined
    const categoryChecking = area && view.activeRuns.some(run => run.scope === 'CATEGORY' && run.targetLabel === name)
    const recovery = area ? view.executionProgress?.categoryRecovery?.[area] : view.executionProgress?.recovery
    if (ownsSite && recovery && recovery.action !== 'retry' && (!area || view.cards.find(card => card.id === area)?.incompleteReason)) {
      const href = recovery.action === 'access' ? `/sites/${siteId}/settings#${recovery.reasons.some(code => code.includes('FIXTURE') || code === 'PROTECTED_EFFECT_UNRESOLVED' || code === 'ACCOUNT_CHECKS_NOT_ADMITTED') ? 'signup-setup' : 'scan-access'}` : recovery.action === 'connections' ? `/sites/${siteId}?view=integrations#integrations` : helpHrefForFailureCode(recovery.reasons[0])
      if (recovery.action === 'inspect' && area) return null
      return <Button asChild variant="outline" size="sm"><Link href={href as Route}>{SITE_ACTION_COPY.recovery[recovery.action]}</Link></Button>
    }
    if (ownsSite) return <Button variant="outline" size="sm" className="min-h-11" aria-label={name && identifyArea ? SITE_BOARD_COPY.checkAreaAgain(name) : undefined} disabled={busy || checking || Boolean(categoryChecking) || disconnected} onClick={() => void refreshSiteEvidence(area)}>
      <RefreshCw className="h-4 w-4" aria-hidden />{busy ? SITE_BOARD_COPY.starting : checking || categoryChecking ? SITE_BOARD_COPY.checking : name && identifyArea ? SITE_BOARD_COPY.checkAreaAgain(name) : SITE_BOARD_COPY.checkAgain}
    </Button>
    if (!ownsSite && (!area || !identifyArea) && !checking && view.audit.id) return <SiteActionContinuation
      availability={view.actions.check} destination={`/sites/${siteId}${area ? `?category=${area}` : ''}`} action="check" compact />
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
    setBusy(true); setToast(null); setActionError(null)
    const completed = await action.submit(mutation, () => refresh(), () => { if (intent) action.completeIntent(intent); setToast(SITE_BOARD_COPY.checkStarted); setActionError(null) })
    if (completed.kind === 'refused') { setToast(completed.error.message); setActionError(completed.error) }
    else if (completed.kind === 'saved_refresh_pending') setToast(SITE_ACTION_COPY.refreshPending)
    else if (completed.kind === 'saved') { setToast(SITE_BOARD_COPY.checkStarted); setActionError(null) }
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
    <SiteShell siteId={siteId} ownerId={view.site.userId} actions={view.actions} activeRoute={viewMode} title={view.presentation.identity.host} description="" presentation={view.presentation} watch={watch} statusMessage={toast}
      analysisStatus={<SiteAnalysisDetails view={view} disconnected={disconnected} />}
      headerAction={!checking ? checkAction() : null}>
      {view.activeRuns.some(run => run.scope !== 'SITE') ? <section className="rounded-card bg-muted/20 p-4" aria-labelledby="scoped-run-heading">
        <h2 id="scoped-run-heading" className="text-sm font-semibold">{SITE_ACTION_COPY.scopedRun.title}</h2>
        <ul className="mt-2 space-y-1 text-sm">{view.activeRuns.filter(run => run.scope !== 'SITE').map(run => <li key={run.id}>
          {run.status === 'INTERRUPTED' ? SITE_ACTION_COPY.scopedRun.interrupted : run.status === 'RUNNING' ? SITE_ACTION_COPY.scopedRun.running : SITE_ACTION_COPY.scopedRun.queued}: {run.targetLabel ?? SITE_ACTION_COPY.scopedRun.unknown}
        </li>)}</ul>
        <p className="mt-2 text-sm text-muted-foreground">{SITE_ACTION_COPY.scopedRun.retained}</p>
      </section> : null}
      <SiteActionFeedback siteId={siteId} message={null} error={actionError} availability={view.actions.check} />
      {viewMode === 'home' && showActivityPanel && !notice ? <SiteActivityPanel banner={banner} disconnected={disconnected}>
      {summaryNote ? <p className="mt-2 text-sm text-muted-foreground">{summaryNote.body}</p> : null}
      </SiteActivityPanel> : null}
      {viewMode === 'home' && notice ? <AuditFailurePanel failureCode={view.audit.failureCode} onRetry={view.presentation.run.recoveryAction === 'retry' ? retryCheck : undefined} retryLoading={busy} /> : null}
      {viewMode === 'home' && !showActivityPanel && summaryNote ? <p role="status" className="text-sm text-muted-foreground">{summaryNote.body}</p> : null}

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
          notice={checking ? SITE_ACTION_COPY.execution.live : undefined}
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
                render: (layout: 'card' | 'row') => <div id={`category-${card.id}`} tabIndex={-1} data-attention={category.flagCount > 0 ? "true" : undefined}><ProductBoardCard compact layout={layout} card={displayCard} recoveryAction={card.incompleteReason ? checkAction(card.id, true) : null} renderFlagCopy={flag => ownsSite ? <SitePromptCopyButton siteId={siteId} flagId={flag.sourceFlagId ?? flag.id} availability={view.actions.copy} compact iconOnly /> : null} onOpen={() => {
                opener.current = document.activeElement as HTMLElement
                selectCategory(card.id)
              }} /></div> }
            })} />
      </section> : null}

      {viewMode === 'timeline' ? <section id="timeline" aria-labelledby="timeline-heading"><h2 id="timeline-heading" className="sr-only">Timeline</h2>
        {ownsSite ? <SiteMonitoringHistory points={monitoringPoints} events={timelineEvents} emptyMessage={disconnected ? B.historyUnavailable : checking ? B.historyChecking : view.audit.id ? B.historyMissing : B.noHistory} /> : <div className="space-y-3 rounded-card bg-muted/20 p-5"><p>{SITE_ACTION_COPY.access.historyBody}</p>
          <SiteActionContinuation availability={view.actions.history} destination={`/sites/${siteId}?view=timeline#timeline`} action="history" /></div>}
      </section> : null}

      {viewMode === 'integrations' ? <section id="integrations" aria-labelledby="integrations-heading"><div><h2 id="integrations-heading" className="sr-only">Integrations</h2><p className="mt-1 text-sm text-muted-foreground">{B.integrationsBody}</p></div><SiteIntegrationsControls siteId={siteId} initial={view.settings} /></section> : null}

      <SiteSignupPrompt key={view.audit.id ?? siteId} siteId={siteId} auditId={view.audit.id} checking={view.presentation.run.state === 'running'} paused={Boolean(selectedCard) || viewMode !== 'home'} />
      {selected ? <SiteCategoryDetails selected={selected} selectedFlags={selectedFlags} selectedRecommendations={selectedRecommendations}
        confirmedOutcomes={confirmedOutcomes} findingPages={findingPages} siteId={siteId} view={view} busy={busy}
        checkAction={checkAction} verifyOutcome={verifyOutcome} onClose={() => selectCategory(null)} restoreFocus={() => (opener.current ?? document.getElementById(`category-${selected.id}`))?.focus()} /> : null}
    </SiteShell>
  )
}
