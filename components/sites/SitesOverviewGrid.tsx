import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2, Loader2 } from 'lucide-react'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { WEBSITES_COPY } from '@/lib/marketing/copy/terminology'
import { customerAttention } from '@/lib/sites/presentation'
import { cn } from '@/lib/utils'

export function SitesOverviewGrid({ sites }: { sites: SiteSummary[] }) {
  return (
    <section aria-labelledby="sites-heading">
      <div className="mb-3 flex items-center justify-between gap-3 sm:grid sm:grid-cols-[88px_minmax(0,1fr)_minmax(300px,auto)_auto] sm:px-5">
        <h2 id="sites-heading" className="sr-only">Sites</h2>
        <span className="ml-auto text-sm text-muted-foreground sm:col-start-2 sm:ml-0">
          {WEBSITES_COPY.count(sites.length)}
        </span>
        {sites.length > 0 ? <span className="hidden grid-cols-2 gap-6 text-xs text-muted-foreground sm:grid">
          <span>{WEBSITES_COPY.monitoring}</span><span>{WEBSITES_COPY.result}</span>
        </span> : null}
      </div>
      {sites.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-background px-5 py-10 text-center">
          <h3 className="text-base font-semibold">{WEBSITES_COPY.emptyTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{WEBSITES_COPY.emptyBody}</p>
        </div>
      ) : <div className="overflow-hidden rounded-card border border-border/70 bg-background">
        {sites.map((site) => {
          const attention = customerAttention(site.presentation)
          const checking = site.presentation.result.state === 'checking'
          const tone = attention.tone === 'attention' ? 'text-brand' : attention.tone === 'clear' ? 'text-success' : 'text-muted-foreground'
          const dot = attention.tone === 'attention' ? 'bg-brand' : attention.tone === 'clear' ? 'bg-success' : 'bg-muted-foreground/60'
          return (
          <Link
            key={site.id}
            href={`/sites/${site.id}` as Route}
            className="group grid min-h-24 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:grid-cols-[88px_minmax(0,1fr)_minmax(300px,auto)_auto] sm:px-5"
          >
            {site.presentation.identity.preview ? (
              <span className="h-14 w-[72px] overflow-hidden rounded-control border border-border bg-muted sm:h-16 sm:w-[88px]">
                {/* Authorized captures use the current browser session. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={site.presentation.identity.preview.url} alt="" width={176} height={128} className="h-full w-full object-cover object-top" />
              </span>
            ) : (
              <span className="flex h-14 w-[72px] items-center justify-center rounded-control border border-border bg-muted text-muted-foreground sm:h-16 sm:w-[88px]">
                <Globe2 className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <strong className="block truncate text-base font-semibold">{site.hostname || site.name}</strong>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{site.presentation.coverage.label}</span>
                <span aria-hidden="true">·</span>
                <span>{site.presentation.freshness.label}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm sm:hidden">
                <span className={cn('flex items-center gap-1.5 font-medium', tone)}>
                  {checking ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <i className={cn('h-2 w-2 rounded-full', dot)} aria-hidden />}
                  {attention.text}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{site.presentation.monitoring.label}</span>
              </span>
            </span>
            <span className="hidden min-w-0 grid-cols-2 items-center gap-6 sm:grid">
              <span className="text-sm font-medium">{site.presentation.monitoring.label}</span>
              <span className={cn('flex items-center gap-2 text-sm font-medium', tone)}>
                  {checking ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <i className={cn('h-2 w-2 rounded-full', dot)} aria-hidden />}
                  {attention.text}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          )
        })}
      </div>}
    </section>
  )
}
