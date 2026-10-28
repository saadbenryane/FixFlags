'use client'

import Link from 'next/link'
import { SiteFlagSelectionCheckbox } from './SiteFlagSelection'
import type { Route } from 'next'
import { Check, ChevronDown, Flag } from 'lucide-react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { PageCapturePreview } from './PageCapturePreview'
import styles from './SitePageResults.module.css'

export type PageResult = {
  url: string; label: string; status: string;
  capture?: { src: string; alt: string } | null;
  flags: readonly { id: string; title: string; priorityBand?: 'fix_first' | 'other'; onOpen?: (trigger: HTMLButtonElement) => void; href?: string }[];
}

function PageCard({ page }: { page: PageResult }) {
  return <article className={styles.page}>
    <PageCapturePreview page={page.label} capture={page.capture} />
    <div className={styles.content}>
      <div className={styles.heading}><strong>{page.label}</strong>{page.flags.length ? <span className={styles.flag}><Flag size={13} aria-hidden />{C.pageFlags(page.flags.length)}</span> : <span className={styles.status}>{page.status === 'COMPLETED' ? <Check size={14} aria-hidden /> : null}{page.status === 'COMPLETED' ? C.checked : C.checkIncomplete}</span>}</div>
      {page.flags.length ? <ul>{page.flags.map(flag => {
        const content = <><span>{flag.title}</span>{flag.priorityBand ? <small data-priority={flag.priorityBand}>{C.priority[flag.priorityBand]}</small> : null}</>
        return <li key={flag.id}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} />{flag.onOpen ? <InteractiveButton type="button" id={`page-flag-${encodeURIComponent(page.url)}-${flag.id}`} aria-label={C.open(flag.title)} onClick={event => flag.onOpen?.(event.currentTarget)}>{content}</InteractiveButton> : <Link href={(flag.href ?? page.url) as Route} aria-label={C.open(flag.title)}>{content}</Link>}</li>
      })}</ul> : null}
    </div>
  </article>
}

export function SitePageResults({ pages, headingLevel = 2 }: { pages: readonly PageResult[]; headingLevel?: 2 | 3 }) {
  const attention = pages.filter(page => page.flags.length)
  const other = pages.filter(page => !page.flags.length)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return <section className={styles.results}>
    <Heading className={styles.title}>{attention.length ? C.pagesNeedAttention(attention.length) : C.noPageFlags}</Heading>
    {attention.length ? <div className={styles.grid}>{attention.map(page => <PageCard key={page.url} page={page} />)}</div> : null}
    {other.length ? <details className={styles.other}><summary>{C.otherPages(other.length)}<ChevronDown size={16} aria-hidden /></summary><div className={styles.grid}>{other.map(page => <PageCard key={page.url} page={page} />)}</div></details> : null}
  </section>
}
