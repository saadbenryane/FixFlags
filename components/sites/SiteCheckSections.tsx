import { Fragment, type ReactNode } from 'react'
import { BoardGrid } from './BoardCard'
import styles from './SiteCheckSections.module.css'

export type SiteCheckItem = {
  id: string
  flagCount: number
  healthy: boolean
  render: (layout: 'card' | 'row') => ReactNode
}

export function SiteCheckSections({ items, uptime }: { items: readonly SiteCheckItem[]; uptime?: ReactNode }) {
  const rows = items.filter(item => !item.healthy).sort((a, b) => Number(b.flagCount > 0) - Number(a.flagCount > 0))
  const healthy = items.filter(item => item.healthy)
  return <div className={styles.checks}>
    {rows.length ? <BoardGrid layout="rows">{rows.map(item => <Fragment key={item.id}>{item.render('row')}</Fragment>)}</BoardGrid> : null}
    {uptime}
    {healthy.length ? <BoardGrid className={styles.healthyGrid}>{healthy.map(item => <Fragment key={item.id}>{item.render('card')}</Fragment>)}</BoardGrid> : null}
  </div>
}
