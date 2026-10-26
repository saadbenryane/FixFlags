import { Fragment, type ReactNode } from 'react'
import { BoardGrid } from './BoardCard'
import styles from './SiteCheckSections.module.css'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'

export type SiteCheckItem = {
  id: string
  flagCount: number
  render: (layout: 'card' | 'row') => ReactNode
}

export function SiteCheckSections({ items, uptime, trend, headingLevel = 2 }: { items: readonly SiteCheckItem[]; uptime?: ReactNode; trend?: ReactNode; headingLevel?: 2 | 3 }) {
  const rows = items.filter(item => item.flagCount > 0)
  const quiet = items.filter(item => item.flagCount === 0)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return <div className={styles.checks}>
    {rows.length ? <section className={styles.group} aria-label={C.attentionHeading}>
      <Heading>{C.attentionHeading}</Heading>
      <BoardGrid layout="rows" className={styles.categoryGrid}>{rows.map(item => <Fragment key={item.id}>{item.render('row')}</Fragment>)}</BoardGrid>
    </section> : null}
    {trend || uptime ? <div className={styles.monitoring}>{trend}{uptime}</div> : null}
    {quiet.length ? <section className={styles.group} aria-label={C.otherChecksHeading}><Heading>{C.otherChecksHeading}</Heading><BoardGrid className={styles.quietGrid}>{quiet.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid></section> : null}
  </div>
}
