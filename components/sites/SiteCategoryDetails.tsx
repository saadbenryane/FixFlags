'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { BOARD_CARD_ICONS } from './BoardCard'
import { ResponsiveDepth } from './ResponsiveDepth'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { projectPageResults } from '@/lib/sites/page-results'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { recoveryReplacesRecheck } from '@/lib/sites/execution-recovery'

export type SiteCategoryDetailsProps = {
  selected: BoardCardView | null; selectedFlags: SiteHomeView['flags']; selectedRecommendations: SiteHomeView['recommendations'];
  confirmedOutcomes: SiteHomeView['outcomes']; findingPages: number; siteId: string; view: SiteHomeView; busy: boolean;
  checkAction: (area?: SiteCardArea, identify?: boolean) => ReactNode; verifyOutcome: (id: string) => Promise<void>;
  onClose: () => void; restoreFocus: () => void; onOpenFlag?: (id: string, trigger?: HTMLElement) => void;
}
export type SiteCategorySummary = { resultSummary: string | null; resultDetail: string | null; needsCheck: boolean }

const SiteCategoryContent = dynamic(() => import('./SiteCategoryContent').then(module => module.SiteCategoryContent), {
  loading: () => <p role="status" className="min-h-40 text-sm text-muted-foreground">{SITE_ACTION_COPY.loading}</p>,
})

/** Navigation and focus remain available while the detail content loads. */
export function SiteCategoryDetails({ onClose, restoreFocus, ...details }: SiteCategoryDetailsProps) {
  const { selected, selectedFlags, view } = details
  const SelectedIcon = selected ? BOARD_CARD_ICONS[selected.id] : null
  const resultSummary = selected && !selectedFlags.length && !selected.incompleteReason && selected.id !== 'site' ? selected.answer : null
  const needsCheck = selected?.state === 'unknown' && !selected.incompleteReason
  const explanation = selected?.detail ?? selected?.coverage ?? null
  const resultDetail = needsCheck && explanation !== resultSummary ? explanation : null
  const pageCount = selected?.id === 'site' ? projectPageResults(view.checkedPages ?? [], selectedFlags).length : 0
  return <ResponsiveDepth header={<div className="flex flex-wrap items-center justify-between gap-3">
    <DialogTitle className="flex items-center gap-3 text-xl">{SelectedIcon ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-muted"><SelectedIcon className="h-5 w-5" aria-hidden /></span> : null}{selected?.name}</DialogTitle>
    {selected?.id === 'site' ? <span className="text-xs font-normal text-muted-foreground">{C.pagesInScope(pageCount)}</span> : null}
  </div>} continuationContext="category" open={Boolean(selected)} onOpenChange={open => { if (!open) onClose() }} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus() }}>
    <DialogDescription className={resultSummary ? undefined : 'sr-only'}>{resultSummary ?? (selectedFlags.length ? SITE_BOARD_COPY.openFlagCount(selectedFlags.length) : C.categoryDescription)}</DialogDescription>
    {resultDetail ? <p className="text-sm text-muted-foreground">{resultDetail}</p> : null}
    {needsCheck && selected ? details.checkAction(selected.id) : null}
    {selected?.incompleteReason ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-card p-3 text-sm shadow-board"><p>{selected.incompleteReason.replace(/[.!?]?$/, '.')} {recoveryReplacesRecheck(view.executionProgress?.categoryRecovery?.[selected.id]) ? SITE_ACTION_COPY.recovery.setupBody : SITE_BOARD_COPY.cardRetryExplanation}</p>{details.checkAction(selected.id, view.actions.check === 'available')}</div> : null}
    {selected ? <SiteCategoryContent {...details} summary={{ resultSummary, resultDetail, needsCheck }} /> : null}
  </ResponsiveDepth>
}
