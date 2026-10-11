import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'
import styles from './SiteMonitoringHistory.module.css'

export type MonitoringHistoryPoint = {
  label: string
  flagCount: number | null
}

export type MonitoringTimelineEvent = {
  id: string
  title: string
  time: string
  state: 'healthy' | 'attention' | 'unknown'
  flagCount?: number
  flags?: readonly { id: string; title: string; href?: string; onOpen?: () => void }[]
  dateTime?: string
  detail?: string
  resultLabel?: string
}

function chartGeometry(points: readonly MonitoringHistoryPoint[]) {
  const width = 520
  const height = 132
  const inset = 10
  const max = Math.max(1, ...points.map(point => point.flagCount ?? 0))
  const positions = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : inset + index * ((width - inset * 2) / (points.length - 1))
    if (point.flagCount === null) return null
    const y = height - inset - (point.flagCount / max) * (height - inset * 2)
    return { x, y }
  })
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  for (const point of positions) {
    if (point) current.push(point)
    else if (current.length) { segments.push(current); current = [] }
  }
  if (current.length) segments.push(current)
  return { width, height, positions, segments }
}

export function SiteMonitoringHistory({ points, events, emptyMessage }: {
  points: readonly MonitoringHistoryPoint[]
  events: readonly MonitoringTimelineEvent[]
  emptyMessage: string
}) {
  const geometry = chartGeometry(points)
  return <section className={styles.panel} aria-label={C.checkHistory}>
    {points.length > 1 ? <div className={styles.chart}>
      <div className={styles.header}><h2>{C.flagTrend}</h2><span>{points.at(-1)?.flagCount == null ? C.incomplete : C.flags(points.at(-1)!.flagCount!)}</span></div>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={`Flag count across ${points.length} checks`}>
        {geometry.segments.map((segment, index) => <polyline key={index} className={styles.trend} points={segment.map(point => `${point.x},${point.y}`).join(' ')} />)}
        {geometry.positions.map((point, index) => point ? <circle key={`${points[index].label}-${index}`} className={styles.point} cx={point.x} cy={point.y} r="4" /> : null)}
      </svg>
      <div className={styles.chartLabels}><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div>
    </div> : <p className={styles.empty}>{emptyMessage}</p>}
    {events.length > 0 ? <><h2 className={styles.timelineHeading}>{C.checkHistory}</h2><ol className={styles.timeline} aria-label={C.checkHistory}>
      {events.map(event => <li key={event.id} className={styles.event}><i data-state={event.state} aria-hidden="true" /><div>
        <div className={styles.eventHeader}><strong>{event.title}</strong><time dateTime={event.dateTime}>{event.time}</time></div>
        {event.detail ? <p className={styles.count}>{event.detail}</p> : null}
        {event.resultLabel ? <p className={styles.count}>{event.resultLabel}</p> : null}
        {event.flagCount !== undefined && (event.state !== 'unknown' || event.flagCount > 0) ? <span className={styles.count}>{C.flags(event.flagCount)}</span> : null}
        {event.flags?.length ? <ul className={styles.flags}>{event.flags.map(flag => <li key={flag.id}>
          {flag.onOpen ? <button type="button" onClick={flag.onOpen}>{flag.title}<ArrowUpRight size={14} aria-hidden /></button> : flag.href ? <Link href={flag.href as Route}>{flag.title}<ArrowUpRight size={14} aria-hidden /></Link> : <span>{flag.title}</span>}
        </li>)}</ul> : null}
      </div></li>)}
    </ol></> : null}
  </section>
}
