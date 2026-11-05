'use client'

import { useSiteFlagDetail } from '@/hooks/useSiteFlagDetail'
import { PageFlagReview, type PageReviewFlag } from '@/components/sites/PageFlagReview'
import { SiteFlagContent } from '@/components/sites/SiteFlagContent'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SiteFlagSelection, SiteFlagSelectionCheckbox, useSiteFlagSelection } from '@/components/sites/SiteFlagSelection'
import { SiteResourceBoundary, useSharedSiteResource } from '@/components/sites/SiteResourceBoundary'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { projectPageResults } from '@/lib/sites/page-results'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'

function Detail({ siteId, item, view }: { siteId: string; item: PageReviewFlag; view: SiteHomeView }) {
  const seed = view.flags.find(flag => flag.id === item.id)
  const revision = JSON.stringify([view.audit.id, seed?.sourceFlagId, seed?.status, seed?.verificationState,
    seed?.latestOccurrenceAt, seed?.resolvedInId, seed?.repairEvidenceRevision, seed?.repairGuidance, view.actions.copy])
  const resource = useSiteFlagDetail(siteId, item.id, revision, view.actions.copy === 'available')
  return <SiteFlagContent siteId={siteId} flagId={item.id} view={view} seed={seed} resource={resource} />
}

function Selection({ flags }: { flags: readonly PageReviewFlag[] }) {
  const selection = useSiteFlagSelection()
  return selection?.active ? <ul>{flags.map(flag => <li key={flag.id}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} />{flag.title}</li>)}</ul> : null
}

function Preview({ siteId }: { siteId: string }) {
  const { view } = useSharedSiteResource(siteId)
  const pages = projectPageResults(view.checkedPages ?? [], view.flags).map(page => ({ ...page,
    flags: page.flags.map(flag => ({ ...flag, title: customerFindingLabel(flag) })) }))
  return <PageFlagReview pages={pages}
    renderFlagActions={item => {
      const flag = view.flags.find(flag => flag.id === item.id)
      return view.actions.copy !== 'available' || hasRepairGuidance(flag?.fix)
        ? <SitePromptCopyButton siteId={siteId} flagId={item.id} flagTitle={item.title} availability={view.actions.copy} compact /> : null
    }}
    renderFlagDetails={item => <Detail siteId={siteId} item={item} view={view} />}
    renderPageActions={page => <SiteFlagSelection siteId={siteId} flags={page.flags} availability={view.actions.copy}>
      <Selection flags={page.flags} />
    </SiteFlagSelection>} />
}

/** Retain the recovered interaction design behind the development viewer boundary. */
export function PageReviewPreview({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  return <SiteResourceBoundary siteId={siteId} initial={initial}><Preview siteId={siteId} /></SiteResourceBoundary>
}
