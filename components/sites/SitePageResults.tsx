'use client'

import Link from 'next/link'
import { SiteFlagSelectionCheckbox } from './SiteFlagSelection'
import type { Route } from 'next'
import { Check, ChevronDown, Flag, LoaderCircle } from 'lucide-react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { PageCapturePreview } from './PageCapturePreview'
import styles from './SitePageResults.module.css'
import type { ReactNode } from 'react'

export type PageResult = {
  url: string; label: string; status: string;
  capture?: { src: string; alt: string } | null;
  flags: readonly { id: string; title: string; priorityBand?: 'fix_first' | 'other'; onOpen?: (trigger: HTMLButtonElement) => void; href?: string; copyAction?: ReactNode }[];
}

function PageCard({ page, checking }: { page: PageResult; checking: boolean }) {
  const complete = page.status === 'COMPLETED'
  const active = checking && ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING'].includes(page.status)
  const status = complete ? C.checked : active ? page.status === 'QUEUED' ? C.pageWaiting : C.pageChecking : C.checkIncomplete
  return <article className={styles.page} data-incomplete={!complete || undefined}>
    <PageCapturePreview page={page.label} capture={page.capture} />
    <div className={styles.content}>
      <div className={styles.heading}><strong>{page.label}</strong><div className={styles.pageState}>
        {page.flags.length ? <span className={styles.flag}><Flag size={13} aria-hidden />{C.pageFlags(page.flags.length)}</span> : null}
        {!page.flags.length || !complete ? <span className={styles.status}>{complete ? <Check size={14} aria-hidden /> : active ? <LoaderCircle size={14} className="motion-safe:animate-spin" aria-hidden /> : null}{status}</span> : null}
      </div></div>
      {page.flags.length ? <ul>{page.flags.map(flag => {
        const content = <><span>{flag.title}</span>{flag.priorityBand ? <small data-priority={flag.priorityBand}>{C.priority[flag.priorityBand]}</small> : null}</>
        return <li key={flag.id}><div className={styles.finding}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} />{flag.onOpen ? <InteractiveButton type="button" id={`page-flag-${encodeURIComponent(page.url)}-${flag.id}`} aria-label={C.open(flag.title)} onClick={event => flag.onOpen?.(event.currentTarget)}>{content}</InteractiveButton> : <Link href={(flag.href ?? page.url) as Route} aria-label={C.open(flag.title)}>{content}</Link>}</div>{flag.copyAction ? <div className={styles.flagActions}>{flag.copyAction}</div> : null}</li>
      })}</ul> : null}
    </div>
  </article>
}

export function SitePageResults({ pages, headingLevel = 2, checking = false }: { pages: readonly PageResult[]; headingLevel?: 2 | 3; checking?: boolean }) {
  const attention = pages.filter(page => page.flags.length)
  const unfinished = pages.filter(page => !page.flags.length && page.status !== 'COMPLETED')
  const other = pages.filter(page => !page.flags.length && page.status === 'COMPLETED')
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const Subheading = headingLevel === 2 ? 'h3' : 'h4'
  return <section className={styles.results}>
    <Heading className={styles.title}>{attention.length ? C.pagesNeedAttention(attention.length) : unfinished.length ? C.pageChecksIncomplete : pages.length ? C.noPageFlags : C.noRecordedPages}</Heading>
    {attention.length ? <div className={styles.grid}>{attention.map(page => <PageCard key={page.url} page={page} checking={checking} />)}</div> : null}
    {unfinished.length ? <>
      {attention.length ? <Subheading className={styles.title}>{C.pageChecksIncomplete}</Subheading> : null}
      <div className={styles.grid}>{unfinished.map(page => <PageCard key={page.url} page={page} checking={checking} />)}</div>
    </> : null}
    {other.length ? <details className={styles.other}><summary>{C.otherPages(other.length)}<ChevronDown size={16} aria-hidden /></summary><div className={styles.grid}>{other.map(page => <PageCard key={page.url} page={page} checking={checking} />)}</div></details> : null}
  </section>
}
