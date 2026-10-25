import { Fragment, type ReactNode } from 'react'
import { BoardGrid } from './BoardCard'
import styles from './SiteCheckSections.module.css'

export type SiteCheckItem = {
  id: string
  flagCount: number
  render: (layout: 'card' | 'row') => ReactNode
}

export function SiteCheckSections({ items, uptime, trend }: { items: readonly SiteCheckItem[]; uptime?: ReactNode; trend?: ReactNode }) {
  const rows = items.filter(item => item.flagCount > 0)
  const quiet = items.filter(item => item.flagCount === 0)
  return <div className={styles.checks}>
    {trend || uptime ? <div className={styles.monitoring}>{trend}{uptime}</div> : null}
    {rows.length ? <BoardGrid className={`${styles.categoryGrid} ${rows.length === 2 ? styles.twoCards : rows.length === 1 ? styles.oneCard : ''}`}>{rows.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid> : null}
    {quiet.length ? <BoardGrid className={styles.quietGrid}>{quiet.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid> : null}
  </div>
}
