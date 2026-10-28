'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { useSiteFlagDetail } from '@/hooks/useSiteFlagDetail'
import { ResponsiveDepth } from './ResponsiveDepth'
import { FlagEvidenceDetails } from './FlagEvidenceDetails'
import { SiteFlagActions } from './SiteFlagActions'
import { SitePromptAccessActions } from './SiteActionContinuation'
import { BoardDetails } from './BoardDetails'

export function SiteFlagPanel({ siteId, flagId, view, onClose, restoreFocus, returnLabel }: {
  siteId: string; flagId: string | null; view: SiteHomeView; onClose: () => void; restoreFocus: () => void; returnLabel?: string;
}) {
  const key = `${siteId}:${flagId}`
  const seed = [...view.flags, ...view.resolvedFlags].find(flag => flag.id === flagId || flag.sourceFlagId === flagId)
  const lastCheck = view.monitoringHistory?.findLast(entry => entry.flags?.some(flag => flag.id === flagId || flag.id === seed?.sourceFlagId))
  const lifecycle = [view.audit?.id, seed?.status, seed?.verificationState, seed?.latestOccurrenceAt,
    lastCheck?.id, view.actions.copy].join(':')
  const { data, failed, stale, refreshing, retry } = useSiteFlagDetail(siteId, flagId, lifecycle, view.actions.copy === 'available')
  const flag = data?.flag
  return <ResponsiveDepth open={Boolean(flagId)} onOpenChange={open => { if (!open) onClose() }}
    header={<div className="space-y-2">{returnLabel ? <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft aria-hidden />{C.backTo(returnLabel)}</Button> : null}<DialogTitle>{flag?.problem ?? seed?.problem ?? SITE_BOARD_COPY.openFlag}</DialogTitle></div>}
    className="max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus() }}>
    <DialogDescription>{flag?.whyItMatters || seed?.whyItMatters || C.loadingFlag}</DialogDescription>
    {flag && failed ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-control bg-muted/30 p-3 text-sm"><p>{C.flagRefreshFailed}</p><Button variant="outline" size="sm" onClick={() => void retry()}>{SITE_ACTION_COPY.retryResults}</Button></div>
      : flag && stale ? <p role="status" className="text-xs text-muted-foreground">{refreshing ? C.flagRefreshing : C.flagPrevious}</p> : null}
    {flag ? <>
      {flag.status === 'FIXED' ? <p role="status" className="rounded-control bg-muted/30 p-4 text-sm">{C.flagResolved}</p> : null}
      <section className="space-y-3" aria-label={SITE_BOARD_COPY.flagEvidence}>
        <FlagEvidenceDetails observed={flag.evidenceMissing ? null : flag.evidence} expected={flag.expectedBehavior}
          factsClassName="grid gap-3 text-sm sm:grid-cols-2 [&>div]:rounded-control [&>div]:bg-muted/30 [&>div]:p-4"
          observedLabel={flag.status === 'FIXED' ? C.previousObservation : undefined}
          supportingObservations={flag.supportingObservations.map(item => ({ ...item, references: item.references.map(reference => ({ ...reference, selector: reference.selector })) }))} supportingEvidenceUnreadable={flag.supportingEvidenceUnreadable} />
      </section>
      {view.actions.copy === 'available' && !['FIXED', 'VERIFIED', 'DISMISSED'].includes(flag.status) ? <SiteFlagActions compact key={key}
        siteId={siteId} flagId={flag.sourceFlagId ?? flag.id} sourceAuditId={flag.sourceAuditId}
        initial={view} initialFix={flag.fix} repairGuidance={flag.repairGuidance} verifying={flag.verifying} /> :
        view.actions.copy !== 'available' ? <SitePromptAccessActions availability={view.actions.copy} destination={`/sites/${siteId}?flag=${encodeURIComponent(flagId ?? '')}`} label={SITE_BOARD_COPY.copyPrompt} /> : null}
      <details className="text-sm"><summary className="flex min-h-11 cursor-pointer items-center font-medium">{C.evidenceDetails}</summary>
        <div className="mt-3 space-y-4">
          {flag.performanceEvidenceSource ? <p className="text-xs leading-relaxed text-muted-foreground">{SITE_ACTION_COPY.flagEvidence[flag.performanceEvidenceSource]}</p> : null}
          {flag.pageUrl ? <a href={flag.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center break-all underline">{flag.pageUrl}</a> : null}
          {flag.affectedPaths.length > 1 ? <ul className="space-y-2">{flag.affectedPaths.map(path => <li key={path} className="break-all">{path}</li>)}</ul> : null}
          {flag.viewport ? <p className="text-muted-foreground">{flag.viewport}</p> : null}
          {data?.capture ? <BoardDetails image={{ src: data.capture.url, alt: SITE_BOARD_COPY.flagCaptureAlt }} checkedAt={data.capture.recordedAt} checkedLabel={SITE_BOARD_COPY.captureRecorded} /> : null}
        </div>
      </details>
    </> : failed ? <div role="status" className="space-y-3"><p>{C.flagUnavailable}</p><Button variant="outline" onClick={() => void retry()}>{SITE_ACTION_COPY.retryResults}</Button></div> : <p role="status" className="text-sm text-muted-foreground">{C.loadingFlag}</p>}
    {flagId ? <Button asChild variant="ghost" className="justify-start"><Link href={`/sites/${siteId}/flags/${encodeURIComponent(flagId)}`}>{C.fullFlag}</Link></Button> : null}
  </ResponsiveDepth>
}
