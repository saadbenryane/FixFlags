import { Fragment, type ReactNode } from 'react'
import { BoardGrid } from './BoardCard'
import styles from './SiteCheckSections.module.css'

export type SiteCheckItem = {
  id: string
  flagCount: number
  healthy: boolean
  render: (layout: 'card' | 'row') => ReactNode
}

export function SiteCheckSections({ items, uptime, trend }: { items: readonly SiteCheckItem[]; uptime?: ReactNode; trend?: ReactNode }) {
  const rows = items.filter(item => !item.healthy).sort((a, b) => Number(b.flagCount > 0) - Number(a.flagCount > 0))
  const healthy = items.filter(item => item.healthy)
  return <div className={styles.checks}>
    {trend || uptime ? <div className={styles.monitoring}>{trend}{uptime}</div> : null}
    {rows.length ? <BoardGrid className={`${styles.categoryGrid} ${rows.length === 2 ? styles.twoCards : rows.length === 1 ? styles.oneCard : ''}`}>{rows.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid> : null}
    {healthy.length ? <BoardGrid className={styles.healthyGrid}>{healthy.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid> : null}
  </div>
}
