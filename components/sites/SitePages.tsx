'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { projectPageResults } from '@/lib/sites/page-results'
import { useSiteFlagDetail } from '@/hooks/useSiteFlagDetail'
import { PageFlagReview, type PageReviewFlag, type PageReviewPage } from './PageFlagReview'
import { SiteFlagSelection, SiteFlagSelectionCheckbox, useSiteFlagSelection } from './SiteFlagSelection'
import { SiteFixBundleButton } from './SiteFixBundleButton'
import { SitePromptCopyButton } from './SitePromptCopyButton'
import { FlagEvidenceDetails } from './FlagEvidenceDetails'
import { SiteFlagActions } from './SiteFlagActions'

function PageSelection({ flags }: { flags: PageReviewPage['flags'] }) {
  const selection = useSiteFlagSelection()
  if (!selection?.active) return null
  return <ul>{flags.map(flag => <li key={flag.id}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} /><span>{flag.title}</span></li>)}</ul>
}

function FlagDetail({ siteId, item, view, onOpenFlag }: {
  siteId: string; item: PageReviewFlag; view: SiteHomeView; onOpenFlag: (id: string, trigger?: HTMLElement) => void;
}) {
  const seed = view.flags.find(flag => flag.id === item.id)
  const revision = [view.audit.id, seed?.latestOccurrenceAt, seed?.verificationState, view.actions.copy].join(':')
  const { data, failed, stale, retry } = useSiteFlagDetail(siteId, item.id, revision)
  const flag = data?.flag
  return <>
    {failed ? <div role="status"><p>{flag ? C.flagPrevious : C.flagUnavailable}</p><Button variant="outline" size="sm" onClick={() => void retry()}>{SITE_ACTION_COPY.retryResults}</Button></div> : stale ? <p role="status">{C.flagPrevious}</p> : null}
    {flag ? <>
      {flag.whyItMatters ? <p>{flag.whyItMatters}</p> : null}
      <FlagEvidenceDetails observed={flag.evidenceMissing ? null : flag.evidence} expected={flag.expectedBehavior}
        supportingObservations={flag.supportingObservations} supportingEvidenceUnreadable={flag.supportingEvidenceUnreadable} />
      {view.actions.copy === 'available' ? <SiteFlagActions compact siteId={siteId} flagId={flag.sourceFlagId ?? flag.id}
        sourceAuditId={flag.sourceAuditId} initial={view} repairGuidance={flag.repairGuidance} initialFix={flag.fix} verifying={flag.verifying} /> : null}
      {data?.capture ? <a href={data.capture.url} target="_blank" rel="noopener noreferrer">{SITE_BOARD_COPY.flagCaptureAlt}<ExternalLink size={13} aria-hidden /></a> : null}
      <Button variant="ghost" size="sm" onClick={event => onOpenFlag(item.id, event.currentTarget)}>{C.fullFlag}</Button>
    </> : !failed ? <p role="status">{C.loadingFlag}</p> : null}
  </>
}

export function SitePages({ siteId, view, onOpenFlag }: { siteId: string; view: SiteHomeView; onOpenFlag: (id: string, trigger?: HTMLElement) => void }) {
  const pages: PageReviewPage[] = projectPageResults(view.checkedPages ?? [], view.flags).map(page => ({ ...page,
    flags: page.flags.map(flag => ({ ...flag, title: flag.problem })) }))
  return <section aria-label={C.pages}>
    <PageFlagReview pages={pages}
      renderFlagActions={item => {
        const seed = view.flags.find(flag => flag.id === item.id)
        return view.actions.copy === 'available' && seed?.repairGuidance !== 'ready'
          ? <p role="status" className="text-xs leading-relaxed text-muted-foreground">{SITE_ACTION_COPY.repairGuidance[seed?.repairGuidance ?? 'unavailable']}</p>
          : <SitePromptCopyButton siteId={siteId} flagId={seed?.sourceFlagId ?? item.id} availability={view.actions.copy} compact />
      }}
      renderFlagDetails={item => <FlagDetail key={item.id} siteId={siteId} item={item} view={view} onOpenFlag={onOpenFlag} />}
      renderPageActions={page => <>
        <SiteFixBundleButton siteId={siteId} flagIds={page.flags.map(flag => flag.id)} availability={view.actions.copy} />
        <SiteFlagSelection siteId={siteId} flags={page.flags} availability={view.actions.copy}><PageSelection flags={page.flags} /></SiteFlagSelection>
      </>} />
  </section>
}
