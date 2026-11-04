'use client'

import { SiteFlagSelectionCheckbox } from './SiteFlagSelection'
import { Check, ChevronDown, Flag, LoaderCircle } from 'lucide-react'
import { SiteFlagTarget, type FlagDestination } from './SiteFlagTarget'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { PageCapturePreview } from './PageCapturePreview'
import styles from './SitePageResults.module.css'
import type { ReactNode } from 'react'
import { RecordedPageLink } from './RecordedPageLink'

export type PageResult = {
  url: string; label: string; status: string;
  capture?: { src: string; alt: string } | null;
  flags: readonly ({ id: string; title: string; priorityBand?: 'fix_first' | 'other'; copyAction?: ReactNode } & FlagDestination)[];
}

function PageCard({ page, checking, linkPages }: { page: PageResult; checking: boolean; linkPages: boolean }) {
  const complete = page.status === 'COMPLETED'
  const active = checking && ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING'].includes(page.status)
  const status = complete ? C.checked : active ? page.status === 'QUEUED' ? C.pageWaiting : C.pageChecking : C.checkIncomplete
  return <article className={styles.page} data-incomplete={!complete || undefined}>
    <PageCapturePreview page={page.label} capture={page.capture} />
    <div className={styles.content}>
      <div className={styles.heading}><strong>{linkPages ? <RecordedPageLink url={page.url}>{page.label}</RecordedPageLink> : page.label}</strong><div className={styles.pageState}>
        {page.flags.length ? <span className={styles.flag}><Flag size={13} aria-hidden />{C.pageFlags(page.flags.length)}</span> : null}
        {!page.flags.length || !complete ? <span className={styles.status}>{complete ? <Check size={14} aria-hidden /> : active ? <LoaderCircle size={14} className="motion-safe:animate-spin" aria-hidden /> : null}{status}</span> : null}
      </div></div>
      {page.flags.length ? <ul>{page.flags.map(flag => {
        const content = <><span>{flag.title}</span>{flag.priorityBand ? <small data-priority={flag.priorityBand}>{C.priority[flag.priorityBand]}</small> : null}</>
        const destination: FlagDestination = flag.href !== undefined ? { href: flag.href, onOpen: flag.onOpen } : flag.onOpen ? { onOpen: flag.onOpen } : { href: page.url }
        return <li key={flag.id}><div className={styles.finding}><SiteFlagSelectionCheckbox flagId={flag.id} title={flag.title} /><SiteFlagTarget {...destination} id={`page-flag-${encodeURIComponent(page.url)}-${flag.id}`} aria-label={C.open(flag.title)}>{content}</SiteFlagTarget></div>{flag.copyAction ? <div className={styles.flagActions}>{flag.copyAction}</div> : null}</li>
      })}</ul> : null}
    </div>
  </article>
}

export function SitePageResults({ pages, headingLevel = 2, checking = false, density = 'compact', linkPages = false }: { pages: readonly PageResult[]; headingLevel?: 2 | 3; checking?: boolean; density?: 'compact' | 'comfortable'; linkPages?: boolean }) {
  const attention = pages.filter(page => page.flags.length)
  const unfinished = pages.filter(page => !page.flags.length && page.status !== 'COMPLETED')
  const other = pages.filter(page => !page.flags.length && page.status === 'COMPLETED')
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const Subheading = headingLevel === 2 ? 'h3' : 'h4'
  return <section className={styles.results} data-density={density}>
    <Heading className={styles.title}>{attention.length ? C.pagesNeedAttention(attention.length) : unfinished.length ? C.pageChecksIncomplete : pages.length ? C.noPageFlags : C.noRecordedPages}</Heading>
    {attention.length ? <div className={styles.grid}>{attention.map(page => <PageCard key={page.url} page={page} checking={checking} linkPages={linkPages} />)}</div> : null}
    {unfinished.length ? <>
      {attention.length ? <Subheading className={styles.title}>{C.pageChecksIncomplete}</Subheading> : null}
      <div className={styles.grid}>{unfinished.map(page => <PageCard key={page.url} page={page} checking={checking} linkPages={linkPages} />)}</div>
    </> : null}
    {other.length ? <details className={styles.other}><summary>{C.otherPages(other.length)}<ChevronDown size={16} aria-hidden /></summary><div className={styles.grid}>{other.map(page => <PageCard key={page.url} page={page} checking={checking} linkPages={linkPages} />)}</div></details> : null}
  </section>
}
