'use client'

import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { SiteFlagSelection } from './SiteFlagSelection'
import { SitePageResults, type PageResult } from './SitePageResults'
import { projectPageResults } from '@/lib/sites/page-results'

export function SitePages({ siteId, view, onOpenFlag }: { siteId: string; view: SiteHomeView; onOpenFlag: (id: string, trigger?: HTMLElement) => void }) {
  const pages: PageResult[] = projectPageResults(view.checkedPages ?? [], view.flags).map(page => ({ ...page,
    flags: page.flags.map(flag => ({ ...flag, title: flag.problem, href: `/sites/${siteId}/flags/${encodeURIComponent(flag.id)}`, onOpen: trigger => onOpenFlag(flag.id, trigger) })) }))
  return <section aria-label={C.pages}>
    {pages.length ? <SiteFlagSelection siteId={siteId} flags={view.flags} availability={view.actions.copy}><SitePageResults pages={pages} /></SiteFlagSelection> : <p role="status" className="text-sm text-muted-foreground">{C.noPages}</p>}
  </section>
}
