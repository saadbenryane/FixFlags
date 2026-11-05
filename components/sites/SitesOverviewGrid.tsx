import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Route } from 'next'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { WEBSITES_COPY } from '@/lib/marketing/copy/terminology'
import { customerAttention } from '@/lib/sites/presentation'
import styles from './SitesOverviewGrid.module.css'
import { SiteCaptureThumb } from './SiteCaptureThumb'
import { SiteEvidenceTime } from './SiteEvidenceTime'
import { Skeleton } from '@/components/ui/skeleton'

/** Loading shares the same container queries, card sizes, and spacing as the list. */
export function SitesOverviewSkeleton() {
  return <div className={styles.overview} aria-hidden="true">
    <Skeleton className="mb-3 h-4 w-24 animate-none" />
    <ul className={styles.list}>{[0, 1, 2].map(index => <li key={index}>
      <div className={`${styles.site} pointer-events-none`}>
        <Skeleton className={`${styles.preview} animate-none`} />
        <div className={styles.identity}>
          <Skeleton className="h-5 w-40 max-w-full animate-none" />
          <div className={styles.context}><Skeleton className="h-4 w-20 animate-none" /><Skeleton className="h-4 w-24 animate-none" /></div>
        </div>
        <div className={styles.facts}>{[0, 1].map(fact => <div key={fact}>
          <Skeleton className="mb-1 h-3 w-16 max-w-full animate-none" />
          <Skeleton className="h-4 w-24 max-w-full animate-none" />
        </div>)}</div>
        <Skeleton className={`${styles.arrow} h-4 w-4 animate-none`} />
      </div>
    </li>)}</ul>
  </div>
}

export function SitesOverviewGrid({ sites, action }: { sites: SiteSummary[]; action?: ReactNode }) {
  if (sites.length === 0) return null

  return (
    <section className={styles.overview} aria-labelledby="sites-heading">
      <div className={styles.heading}>
        <h2 id="sites-heading" tabIndex={-1} className={`${styles.count} rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}>{WEBSITES_COPY.count(sites.length)}</h2>
        {action}
      </div>
      <ul className={styles.list}>
        {sites.map((site) => {
          const attention = customerAttention(site.presentation)
          const checking = site.presentation.result.state === 'checking'
          const showFreshness = site.presentation.freshness.label !== attention.text
          return <li key={site.id}>
            <Link href={`/sites/${site.id}` as Route} className={styles.site}>
              <SiteCaptureThumb className={styles.preview} src={site.presentation.identity.preview?.url ?? null} />
              <span className={styles.identity}>
                <strong>{site.hostname || site.name}</strong>
                <span className={styles.context}>
                  <span>{site.presentation.coverage.label}</span>
                  {showFreshness ? <><span aria-hidden="true">·</span>{site.presentation.freshness.checkedAt
                    ? <SiteEvidenceTime checkedAt={site.presentation.freshness.checkedAt} label={site.presentation.freshness.label} />
                    : <span>{site.presentation.freshness.label}</span>}</> : null}
                </span>
              </span>
              <dl className={styles.facts}>
                <div><dt>{WEBSITES_COPY.monitoring}</dt><dd>{site.presentation.monitoring.label}</dd></div>
                <div><dt>{WEBSITES_COPY.result}</dt><dd className={styles.result} data-tone={attention.tone}>
                  {checking ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden /> : <i aria-hidden />}
                  <span>{attention.text}</span>
                </dd></div>
              </dl>
              <ArrowRight size={18} className={styles.arrow} aria-hidden />
            </Link>
          </li>
        })}
      </ul>
    </section>
  )
}
