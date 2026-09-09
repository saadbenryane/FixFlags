'use client'

import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'
import styles from './BoardDetails.module.css'

export type CheckedPage = { url: string; title: string | null; status: string }

export function BoardDetails({ image, checkedAt, sources, coverage, facts = [], pages, children }: {
  image?: { src: string; alt: string } | null
  checkedAt?: string | null
  sources?: readonly string[]
  coverage?: string | null
  facts?: readonly string[]
  pages?: CheckedPage[]
  children?: React.ReactNode
}) {
  return <div className={styles.details}>
    {image ? <a href={image.src} target="_blank" rel="noopener noreferrer" aria-label={C.capture} className={styles.capture}>
      {/* Authenticated captures must use the viewer's session, not next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} width={1280} height={720} />
    </a> : null}
    <section>
      <h3>{C.checkedScope}</h3>
      {coverage ? <p>{coverage}</p> : null}
      {facts.length > 0 ? <ul>{[...new Set(facts)].filter(fact => fact !== coverage).map(fact => <li key={fact}>{fact}</li>)}</ul> : null}
      {pages ? pages.length > 0 ? <ul className={styles.pages}>{pages.map(page => <li key={page.url}>
        <a href={page.url} target="_blank" rel="noopener noreferrer">{page.title || page.url}<small>{page.title ? page.url : null}</small></a>
        <span>{page.status === 'COMPLETED' ? 'Checked' : page.status === 'PARTIAL' ? 'Partial' : page.status === 'FAILED' ? 'Could not check' : 'In progress'}</span>
      </li>)}</ul> : <p>{C.noPages}</p> : null}
    </section>
    <dl className={styles.provenance}>
      {sources?.length ? <div><dt>{C.sources}</dt><dd>{[...new Set(sources)].join(' · ')}</dd></div> : null}
      <div><dt>{C.lastChecked}</dt><dd>{checkedAt ? <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time> : C.noFreshness}</dd></div>
    </dl>
    {children}
  </div>
}
