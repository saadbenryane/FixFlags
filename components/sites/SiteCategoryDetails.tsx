'use client'


import { BOARD_CARD_ICONS } from '@/components/sites/BoardCard'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { SitePerformanceFindings } from './SitePerformanceFindings'
import { SiteActionContinuation } from './SiteActionContinuation'
import { OutcomeSummaryCard } from '@/components/sites/OutcomeSummaryCard'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { RecommendationList,SiteCardFindings } from '@/components/sites/SiteCardFindings'
import { SiteCheckResults } from '@/components/sites/SiteCheckResults'
import { Button } from '@/components/ui/button'
import { DialogDescription,DialogTitle } from '@/components/ui/dialog'
import { MONITORING_COPY,SITE_BOARD_COPY } from '@/lib/marketing/copy-barrel'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SitePageResults, type PageResult } from './SitePageResults'
import { projectPageResults } from '@/lib/sites/page-results'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { SiteFlagSelection } from './SiteFlagSelection'
import { SitePromptCopyButton } from './SitePromptCopyButton'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { type SiteCardArea } from '@/lib/sites/card-areas'
import { recoveryReplacesRecheck } from '@/lib/sites/execution-recovery'
import { outcomeCoverageLabel,staleOutcomeRecovery,UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import { FileCheck } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

import { outcomeCardFreshness } from '@/lib/sites/board-view'
import { useState, type ReactNode } from 'react'

/** Keep inspected results mounted across collapse without reading hidden evidence on entry. */
function CategoryCheckDetails({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState(false)
  return <details className="mt-2 rounded-card p-4 shadow-board" onToggle={event => { if (event.currentTarget.open) setRequested(true) }}>
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><FileCheck className="h-4 w-4 text-muted-foreground" aria-hidden />{C.checkDetails}</summary>
    {requested ? <div className="mt-4 space-y-5">{children}</div> : null}
  </details>
}

export function SiteCategoryDetails({ selected, selectedFlags, selectedRecommendations, confirmedOutcomes, findingPages, siteId, view, busy, checkAction, verifyOutcome, onClose, restoreFocus, onOpenFlag }: {
  selected: BoardCardView | null; selectedFlags: SiteHomeView['flags']; selectedRecommendations: SiteHomeView['recommendations'];
  confirmedOutcomes: SiteHomeView['outcomes']; findingPages: number; siteId: string; view: SiteHomeView; busy: boolean;
  checkAction: (area?: SiteCardArea, identify?: boolean) => ReactNode; verifyOutcome: (id: string) => Promise<void>;
  onClose: () => void; restoreFocus: () => void;
  onOpenFlag?: (id: string, trigger?: HTMLElement) => void;
}) {
  const SelectedIcon = selected ? BOARD_CARD_ICONS[selected.id] : null
  const resultSummary = selected && !selectedFlags.length && !selected.incompleteReason && selected.id !== 'site' ? selected.answer : null
  const needsCheck = selected?.state === 'unknown' && !selected.incompleteReason
  const explanation = selected?.detail ?? selected?.coverage ?? null
  const resultDetail = needsCheck && explanation !== resultSummary ? explanation : null
  const evidenceCoverage = selected?.coverage ?? (findingPages > 0 ? SITE_BOARD_COPY.findingPageScope(findingPages) : null)
  const pageResults: PageResult[] = projectPageResults(view.checkedPages ?? [], selectedFlags).map(page => ({ ...page,
    flags: page.flags.map(flag => ({ ...flag, title: customerFindingLabel(flag), href: `/sites/${siteId}/flags/${encodeURIComponent(flag.id)}`, onOpen: onOpenFlag ? trigger => onOpenFlag(flag.id, trigger) : undefined,
      copyAction: view.actions.copy !== 'available' || hasRepairGuidance(flag.fix) ? <SitePromptCopyButton siteId={siteId} flagId={flag.id} flagTitle={customerFindingLabel(flag)} availability={view.actions.copy} compact /> : null })) }))
  return (      <ResponsiveDepth header={<div className="flex flex-wrap items-center justify-between gap-3"><DialogTitle className="flex items-center gap-3 text-xl">{SelectedIcon ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-muted"><SelectedIcon className="h-5 w-5" aria-hidden /></span> : null}{selected?.name}</DialogTitle>{selected?.id === 'site' ? <span className="text-xs font-normal text-muted-foreground">{C.pagesInScope(pageResults.length)}</span> : null}</div>} continuationContext="category" open={Boolean(selected)} onOpenChange={(open) => { if (!open) onClose() }} onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}>

      <SiteFlagSelection key={`${siteId}:${selected?.id}`} siteId={siteId} flags={selectedFlags} availability={view.actions.copy} area={selected?.id}>
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
            <div className="flex flex-wrap gap-2">
              {outcome.state === 'FLAG' && outcome.flagId ? <><SitePromptCopyButton siteId={siteId} flagId={outcome.flagId} availability={view.actions.copy} compact /><Button size="sm" variant="outline" asChild><Link href={`/sites/${siteId}/flags/${outcome.flagId}`}>{C.viewFlag}</Link></Button></> : null}
              {view.actions.check !== 'available' ? <SiteActionContinuation availability={view.actions.check} destination={`/sites/${siteId}/outcomes/${outcome.id}`} action="check" compact /> : !outcome.running ? <Button size="sm" variant={outcome.state === 'FLAG' ? 'default' : 'outline'} disabled={busy || !outcome.enabled || !outcome.bindings.some((binding) => binding.required)} onClick={() => void verifyOutcome(outcome.id)}>
                Check again
              </Button> : null}
            </div>
          )}
        />
      ))}
          <DialogDescription className={resultSummary ? undefined : 'sr-only'}>{resultSummary ?? (selectedFlags.length ? SITE_BOARD_COPY.openFlagCount(selectedFlags.length) : C.categoryDescription)}</DialogDescription>
          {selected ? (
            <>
              {resultDetail ? <p className="text-sm text-muted-foreground">{resultDetail}</p> : null}
              {needsCheck ? checkAction(selected.id) : null}
              {selected.id === 'site' ? <SitePageResults pages={pageResults} headingLevel={3} checking={Boolean(view.audit?.status && !['COMPLETED', 'FAILED'].includes(view.audit.status))} /> : <>
              {selected.id === 'performance' ? <SitePerformanceFindings siteId={siteId} flags={selectedFlags} availability={view.actions.copy} onOpenFlag={onOpenFlag} /> : <SiteCardFindings copyAvailability={view.actions.copy} key={selected.id} siteId={siteId} flags={selectedFlags} recommendations={[]} onOpenFlag={onOpenFlag} />}
              </>}
              <RecommendationList recommendations={selectedRecommendations} />
              {selected.incompleteReason ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-card p-3 text-sm shadow-board"><p>{selected.incompleteReason.replace(/[.!?]?$/, '.')} {recoveryReplacesRecheck(view.executionProgress?.categoryRecovery?.[selected.id]) ? SITE_ACTION_COPY.recovery.setupBody : SITE_BOARD_COPY.cardRetryExplanation}</p>{checkAction(selected.id, Boolean(selected.incompleteReason) && view.actions.check === 'available')}</div> : null}
              <CategoryCheckDetails key={`${siteId}:${selected.id}`}>
              {!selected.incompleteReason && !needsCheck ? checkAction(selected.id) : null}
              {selected.id === 'site' ? <BoardDetails checkedAt={selected.checkedAt} sources={selected.sources} coverage={SITE_ACTION_COPY.pageEvidenceScope} /> : null}
              <SiteCheckResults key={`${selected.id}:${view.audit.id}:${selected.checkedAt}:${view.checkResultsNextCursor}`} siteId={siteId} area={selected.id} results={view.checkResults ?? []} nextCursor={view.checkResultsNextCursor} />
              {selected.id !== 'site' ? <>
              <BoardDetails
                image={selected.captureUrl ? { src: selected.captureUrl, alt: selected.captureAlt ?? selected.name } : null}
                checkedAt={selected.checkedAt} sources={selected.sources}
                coverage={evidenceCoverage === resultSummary || evidenceCoverage === resultDetail ? null : evidenceCoverage}
                facts={selected.facts.filter((fact) => fact !== selected.answer && fact !== resultDetail && !view.outcomes.some((outcome) => outcome.name === fact && !outcome.confirmedAt))}
              />
              </> : null}
              </CategoryCheckDetails>
            </>
          ) : null}
      </SiteFlagSelection></ResponsiveDepth>)
}
