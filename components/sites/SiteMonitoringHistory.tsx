import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'
import styles from './SiteMonitoringHistory.module.css'

export type MonitoringHistoryPoint = {
  label: string
  flagCount: number
}

export type MonitoringTimelineEvent = {
  id: string
  title: string
  time: string
  state: 'healthy' | 'attention' | 'unknown'
  flagCount?: number
  flags?: readonly { id: string; title: string; href?: string; onOpen?: () => void }[]
  dateTime?: string
}

function chartGeometry(points: readonly MonitoringHistoryPoint[]) {
  const width = 520
  const height = 132
  const inset = 10
  const max = Math.max(1, ...points.map(point => point.flagCount))
  const positions = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : inset + index * ((width - inset * 2) / (points.length - 1))
    const y = height - inset - (point.flagCount / max) * (height - inset * 2)
    return { x, y }
  })
  const line = positions.map(point => `${point.x},${point.y}`).join(' ')
  const area = positions.length > 0
    ? `M ${positions[0].x} ${height - inset} L ${positions.map(point => `${point.x} ${point.y}`).join(' L ')} L ${positions.at(-1)!.x} ${height - inset} Z`
    : ''
  return { width, height, positions, line, area }
}

export function SiteMonitoringHistory({ points, events, emptyMessage }: {
  points: readonly MonitoringHistoryPoint[]
  events: readonly MonitoringTimelineEvent[]
  emptyMessage: string
}) {
  const geometry = chartGeometry(points)
  return <section className={styles.panel} aria-label={C.checkHistory}>
    {points.length > 1 ? <div className={styles.chart}>
      <div className={styles.header}><h2>{C.flagTrend}</h2><span>{C.flags(points.at(-1)?.flagCount ?? 0)}</span></div>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={`Flag count across ${points.length} checks`}>
        <path className={styles.area} d={geometry.area} />
        <polyline className={styles.trend} points={geometry.line} />
        {geometry.positions.map((point, index) => <circle key={`${points[index].label}-${index}`} className={styles.point} cx={point.x} cy={point.y} r="4" />)}
      </svg>
      <div className={styles.chartLabels}><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div>
    </div> : <p className={styles.empty}>{emptyMessage}</p>}
    {events.length > 0 ? <><h2 className={styles.timelineHeading}>{C.checkHistory}</h2><ol className={styles.timeline} aria-label={C.checkHistory}>
      {events.map(event => <li key={event.id} className={styles.event}><i data-state={event.state} aria-hidden="true" /><div>
        <div className={styles.eventHeader}><strong>{event.title}</strong><time dateTime={event.dateTime}>{event.time}</time></div>
        {event.flagCount !== undefined && (event.state !== 'unknown' || event.flagCount > 0) ? <span className={styles.count}>{C.flags(event.flagCount)}</span> : null}
        {event.flags?.length ? <ul className={styles.flags}>{event.flags.map(flag => <li key={flag.id}>
          {flag.onOpen ? <button type="button" onClick={flag.onOpen}>{flag.title}<ArrowUpRight size={14} aria-hidden /></button> : flag.href ? <Link href={flag.href as Route}>{flag.title}<ArrowUpRight size={14} aria-hidden /></Link> : <span>{flag.title}</span>}
        </li>)}</ul> : null}
      </div></li>)}
    </ol></> : null}
  </section>
}
