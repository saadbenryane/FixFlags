'use client'

import { Button } from '@/components/ui/button'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { FlagEvidenceDetails } from './FlagEvidenceDetails'
import { SiteFlagActions } from './SiteFlagActions'
import { SitePromptAccessActions } from './SiteActionContinuation'
import { BoardDetails } from './BoardDetails'
import { FlagVerificationNotice } from './FlagVerificationNotice'
import { RecordedPageLink } from './RecordedPageLink'

import type { useSiteFlagDetail } from '@/hooks/useSiteFlagDetail'

export function SiteFlagContent({ siteId, flagId, view, seed, resource }: {
  siteId: string; flagId: string | null; view: SiteHomeView; seed?: SiteHomeView['flags'][number]; resource: ReturnType<typeof useSiteFlagDetail>;
}) {
  const key = `${siteId}:${flagId}`
  const { data, failed, stale, refreshing, retry } = resource
  const flag = data?.flag
  // Retained detail owns its recorded evidence. During a lifecycle refresh,
  // the current Site snapshot owns status and verification activity.
  const current = stale && seed ? seed : flag
  const resolved = current?.status === 'FIXED' || current?.status === 'VERIFIED'
  const dismissed = current?.status === 'DISMISSED' || current?.status === 'IGNORED'
  const verifying = stale && seed ? seed.verificationState === 'verifying' : flag?.verifying
  const otherPaths = [...new Set(flag?.affectedPaths ?? [])].filter(path => path !== flag?.pageUrl)
  return <>
    {flag && failed ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-control bg-muted/30 p-3 text-sm"><p>{C.flagRefreshFailed}</p><Button variant="outline" size="sm" loading={refreshing} loadingLabel={SITE_ACTION_COPY.loading} onClick={() => void retry()}>{SITE_ACTION_COPY.retryResults}</Button></div>
      : flag && stale ? <p role="status" className="text-xs text-muted-foreground">{refreshing ? C.flagRefreshing : C.flagPrevious}</p> : null}
    {flag ? <>
      {resolved ? <p role="status" className="rounded-control bg-muted/30 p-4 text-sm">{C.flagResolved}</p> : null}
      {!resolved && !dismissed && !verifying && !stale && flag.verificationFeedback ? <FlagVerificationNotice feedback={flag.verificationFeedback} /> : null}
      <section className="space-y-3" aria-label={SITE_BOARD_COPY.flagEvidence}>
        <FlagEvidenceDetails observed={flag.evidenceMissing ? null : flag.evidence} expected={flag.expectedBehavior} diagnosis={flag.problem}
          factsClassName="grid gap-3 text-sm sm:grid-cols-2 [&>div]:rounded-control [&>div]:bg-muted/30 [&>div]:p-4"
          observedLabel={resolved ? C.previousObservation : undefined}
          supportingObservations={flag.supportingObservations.map(item => ({ ...item, references: item.references.map(reference => ({ ...reference, selector: reference.selector })) }))} supportingEvidenceUnreadable={flag.supportingEvidenceUnreadable} />
      </section>
      {view.actions.copy === 'available' && !resolved && !dismissed ? <SiteFlagActions compact key={key}
        siteId={siteId} flagId={current?.sourceFlagId ?? current?.id ?? flag.id} referenceFlagId={flagId ?? flag.id} sourceAuditId={flag.sourceAuditId}
        initial={view} initialFix={flag.fix} repairGuidance={flag.repairGuidance} verifying={verifying} /> :
        view.actions.copy !== 'available' ? <SitePromptAccessActions availability={view.actions.copy} destination={`/sites/${siteId}?flag=${encodeURIComponent(flagId ?? '')}`} label={SITE_BOARD_COPY.copyPrompt} /> : null}
      <details className="text-sm"><summary className="flex min-h-11 cursor-pointer items-center font-medium">{C.evidenceDetails}</summary>
        <div className="mt-3 space-y-4">
          {flag.performanceEvidenceSource ? <p className="text-xs leading-relaxed text-muted-foreground">{SITE_ACTION_COPY.flagEvidence[flag.performanceEvidenceSource]}</p> : null}
          {flag.pageUrl ? <RecordedPageLink url={flag.pageUrl} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control break-all underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /> : null}
          {otherPaths.length ? <ul className="space-y-2">{otherPaths.map(path => <li key={path} className="break-all"><RecordedPageLink url={path}
            className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></li>)}</ul> : null}
          {flag.viewport ? <p className="text-muted-foreground">{flag.viewport}</p> : null}
          {data?.capture ? <BoardDetails image={{ src: data.capture.url, alt: SITE_BOARD_COPY.flagCaptureAlt }} checkedAt={data.capture.recordedAt} checkedLabel={SITE_BOARD_COPY.captureRecorded} /> : null}
        </div>
      </details>
    </> : failed ? <div role="status" className="space-y-3"><p>{C.flagUnavailable}</p><Button variant="outline" loading={refreshing} loadingLabel={SITE_ACTION_COPY.loading} onClick={() => void retry()}>{SITE_ACTION_COPY.retryResults}</Button></div> : <p role="status" className="text-sm text-muted-foreground">{C.loadingFlag}</p>}
  </>
}
