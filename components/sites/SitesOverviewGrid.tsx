import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2, Loader2 } from 'lucide-react'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { WEBSITES_COPY } from '@/lib/marketing/copy/terminology'
import { customerAttention } from '@/lib/sites/presentation'
import styles from './SitesOverviewGrid.module.css'

export function SitesOverviewGrid({ sites }: { sites: SiteSummary[] }) {
  if (sites.length === 0) return null

  return (
    <section className={styles.overview} aria-labelledby="sites-heading">
      <h2 id="sites-heading" className={styles.count}>{WEBSITES_COPY.count(sites.length)}</h2>
      <ul className={styles.list}>
        {sites.map((site) => {
          const attention = customerAttention(site.presentation)
          const checking = site.presentation.result.state === 'checking'
          return <li key={site.id}>
            <Link href={`/sites/${site.id}` as Route} className={styles.site}>
              <span className={styles.preview}>
                {site.presentation.identity.preview ? (
                  // Authorized captures use the current browser session.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={site.presentation.identity.preview.url} alt="" width={176} height={128} loading="lazy" />
                ) : <Globe2 size={20} aria-hidden />}
              </span>
              <span className={styles.identity}>
                <strong>{site.hostname || site.name}</strong>
                <span className={styles.context}>
                  <span>{site.presentation.coverage.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{site.presentation.freshness.label}</span>
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
