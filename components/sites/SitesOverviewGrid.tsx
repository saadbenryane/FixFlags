import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2 } from 'lucide-react'
import { BoardCard } from '@/components/sites/BoardCard'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import styles from '@/components/sites/BoardCard.module.css'

export function SitesOverviewGrid({ sites }: { sites: SiteSummary[] }) {
  return (
    <section aria-labelledby="sites-heading" className={styles.surface}>
      <div className={styles.surfaceHeader}>
        <h2 id="sites-heading" className="font-semibold">Sites</h2>
        <span className="text-xs text-muted-foreground">
          {sites.length} {sites.length === 1 ? 'website' : 'websites'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <BoardCard
            key={site.id}
            name={site.hostname || site.name}
            state={site.state}
            status={site.status}
            answer={site.flagCount ? `${site.flagCount} Flag${site.flagCount === 1 ? '' : 's'} need attention` : site.coverage}
            detail={site.coverage}
            flagCount={site.flagCount}
            footer={site.watch}
            href={`/sites/${site.id}` as Route}
            icon={Globe2}
          />
        ))}
        <Link href={'/new' as Route} aria-label="Analyze a website URL" className={styles.addCard}>
          <Globe2 size={22} aria-hidden="true" />
          <strong>{sites.length ? 'Add a website' : 'Analyze your first website'}</strong>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            Start with a URL <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  )
}
