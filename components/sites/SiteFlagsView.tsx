import Link from 'next/link'
import type { Route } from 'next'
import { Check, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { SiteFlagRow } from '@/components/sites/SiteFlagRow'
import { SiteResolvedFlagRow } from '@/components/sites/SiteResolvedFlagRow'
import { SiteFlagTabs } from '@/components/sites/SiteFlagTabs'
import { SiteShell } from '@/components/sites/SiteShell'
import { Button } from '@/components/ui/button'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { CARD_CATALOG, SITE_CARD_AREAS, type SiteCardArea } from '@/lib/sites/card-areas'

export const SITE_FLAG_TABS = ['open', 'resolved'] as const
export type SiteFlagTab = (typeof SITE_FLAG_TABS)[number]
export type SiteFlagCategory = 'all' | SiteCardArea
const FLAGS_PER_PAGE = 12

/**
 * The tab is read on the server, never from `useSearchParams`. This view is a
 * Server Component like `SiteSettingsView`, and only a Client Component may
 * call that hook. An unknown or missing value is the Open attention default,
 * because a mangled URL must never render a blank Flags page.
 */
export function siteFlagTab(value: string | string[] | undefined): SiteFlagTab {
  return SITE_FLAG_TABS.includes(value as SiteFlagTab) ? (value as SiteFlagTab) : 'open'
}

export function siteFlagCategory(value: string | string[] | undefined): SiteFlagCategory {
  return typeof value === 'string' && SITE_CARD_AREAS.includes(value as SiteCardArea)
    ? value as SiteCardArea
    : 'all'
}

export function siteFlagPage(value: string | string[] | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : 1
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

export function SiteFlagsView({ siteId, view, tab, category = 'all', page = 1 }: { siteId: string; view: SiteHomeView; tab: SiteFlagTab; category?: SiteFlagCategory; page?: number }) {
  const categories = SITE_CARD_AREAS.map((area) => ({
    area,
    label: CARD_CATALOG[area].name,
    count: view.flags.filter((flag) => flag.area === area).length,
  })).filter((item) => item.count > 0)
  const filteredFlags = (category === 'all' ? view.flags : view.flags.filter((flag) => flag.area === category))
    .toSorted((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
  const totalPages = Math.max(1, Math.ceil(filteredFlags.length / FLAGS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visibleFlags = filteredFlags.slice((currentPage - 1) * FLAGS_PER_PAGE, currentPage * FLAGS_PER_PAGE)
  const urgentFlags = visibleFlags.filter((flag) => flag.priorityBand === 'fix_first')
  const otherFlags = visibleFlags.filter((flag) => flag.priorityBand === 'other')
  const categoryHref = (next: SiteFlagCategory) => `/sites/${siteId}/flags?tab=open&category=${next}` as Route
  const pageHref = (next: number) => `/sites/${siteId}/flags?tab=open&category=${category}&page=${next}` as Route

  return (
    <SiteShell
      siteId={siteId}
      ownerId={view.site.userId}
      activeRoute="flags"
      title="Flags"
      description={view.presentation.identity.host}
      presentation={view.presentation}
      watch={view.watch}
    >
      <SiteFlagTabs siteId={siteId} tab={tab} openCount={view.flags.length} resolvedCount={view.resolvedFlags.length} />

      {tab === 'open' ? (
        <section id="open-flags-panel" role="tabpanel" aria-labelledby="open-flags-tab">
          <h2 id="open-flags-heading" className="sr-only">Open Flags</h2>
          {view.flags.length > 0 ? <div className="hidden flex-wrap gap-2 sm:flex" aria-label="Flag categories">
            <Button size="sm" variant={category === 'all' ? 'secondary' : 'ghost'} asChild><Link href={categoryHref('all')} aria-current={category === 'all' ? 'page' : undefined}>All {view.flags.length}</Link></Button>
            {categories.map((item) => <Button key={item.area} size="sm" variant={category === item.area ? 'secondary' : 'ghost'} asChild><Link href={categoryHref(item.area)} aria-current={category === item.area ? 'page' : undefined}>{item.label} {item.count}</Link></Button>)}
          </div> : null}
          {view.flags.length > 0 ? <details className="rounded-control border border-border px-3 py-2 sm:hidden"><summary className="min-h-8 cursor-pointer text-sm font-medium">Filter: {category === 'all' ? 'All categories' : CARD_CATALOG[category].name}</summary><nav className="mt-2 flex flex-col" aria-label="Flag categories"><Link className="min-h-11 py-3 text-sm" href={categoryHref('all')}>All ({view.flags.length})</Link>{categories.map((item) => <Link className="min-h-11 py-3 text-sm" key={item.area} href={categoryHref(item.area)}>{item.label} ({item.count})</Link>)}</nav></details> : null}
          <div className="mt-4 space-y-6">
            {view.flags.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
                {view.presentation.result.state === 'clear' ? <Check className="mx-auto h-8 w-8 text-success" aria-hidden /> : null}
                <h3 className="mt-3 text-xl font-semibold">
                  {view.presentation.result.state === 'clear' ? SITE_BOARD_COPY.flagListNoOpen : view.presentation.result.state === 'checking' ? SITE_BOARD_COPY.flagListRunning : view.presentation.result.state === 'failed' ? SITE_BOARD_COPY.flagListFailed : view.presentation.result.state === 'stale' ? SITE_BOARD_COPY.flagListStale : SITE_BOARD_COPY.flagListIncomplete}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{view.presentation.coverage.label} · {view.presentation.freshness.label}</p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link href={`/sites/${siteId}`}>{view.presentation.result.state === 'failed' ? SITE_BOARD_COPY.flagListRetry : SITE_BOARD_COPY.flagListBack}</Link>
                </Button>
              </div>
            ) : filteredFlags.length === 0 ? <p className="rounded-2xl border border-border/80 p-6 text-sm text-muted-foreground">{SITE_BOARD_COPY.flagListNoFilter}</p> : <>
              {urgentFlags.length > 0 ? <section aria-labelledby="urgent-flags-heading"><div className="mb-2 flex items-center justify-between"><h3 id="urgent-flags-heading" className="text-sm font-semibold">Fix first</h3><span className="text-xs text-muted-foreground">{urgentFlags.length} on this page</span></div><div className="overflow-hidden rounded-2xl border border-border/80">{urgentFlags.map((flag) => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}</div></section> : null}
              {otherFlags.length > 0 ? <section aria-labelledby="other-flags-heading"><div className="mb-2 flex items-center justify-between"><h3 id="other-flags-heading" className="text-sm font-semibold">Other Flags</h3><span className="text-xs text-muted-foreground">{otherFlags.length} on this page</span></div><div className="overflow-hidden rounded-2xl border border-border/80">{otherFlags.map((flag) => <SiteFlagRow key={flag.id} siteId={siteId} flag={flag} />)}</div></section> : null}
              {totalPages > 1 ? <nav className="flex items-center justify-between border-t border-border/60 pt-4" aria-label="Flag pages"><span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage === 1} asChild={currentPage > 1}>{currentPage > 1 ? <Link href={pageHref(currentPage - 1)}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden />Previous</Link> : <span><ChevronLeft className="mr-1 h-4 w-4" aria-hidden />Previous</span>}</Button><Button size="sm" variant="outline" disabled={currentPage === totalPages} asChild={currentPage < totalPages}>{currentPage < totalPages ? <Link href={pageHref(currentPage + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Link> : <span>Next<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></span>}</Button></div></nav> : null}
            </>}
          </div>
        </section>
      ) : null}

      {tab === 'resolved' ? (
        <section id="resolved-flags-panel" role="tabpanel" aria-labelledby="resolved-flags-tab">
          <h2 id="resolved-flags-heading" className="sr-only">Resolved</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {SITE_BOARD_COPY.flagResolvedList}
          </p>
          <div className="mt-4 space-y-3">
            {view.resolvedFlags.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-background p-8 text-center">
                <History className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <h3 className="mt-3 text-xl font-semibold">{SITE_BOARD_COPY.flagListNoRecoveries}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {SITE_BOARD_COPY.flagListNoRecoveriesBody}
                </p>
              </div>
            ) : <div className="overflow-hidden rounded-2xl border border-border/80">{view.resolvedFlags.map((flag) => <SiteResolvedFlagRow key={flag.id} siteId={siteId} flag={flag} />)}</div>}
          </div>
        </section>
      ) : null}

    </SiteShell>
  )
}
