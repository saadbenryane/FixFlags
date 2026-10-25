'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
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
  flags?: readonly { id: string; title: string; href?: string; onOpen?: (trigger: HTMLElement) => void }[]
  dateTime?: string
  detail?: string
  evidenceHref?: string
  evidenceLabel?: string
  resultLabel?: string
}

function chartGeometry(points: readonly MonitoringHistoryPoint[], width: number, height: number) {
  const left = 32
  const right = width - 16
  const top = 16
  const bottom = height - 20
  const peak = Math.max(1, ...points.map(point => point.flagCount ?? 0))
  const step = Math.max(1, Math.ceil(peak / 4))
  const max = step * 4
  const yFor = (count: number) => bottom - (count / max) * (bottom - top)
  const xFor = (index: number) => points.length === 1 ? (left + right) / 2 : left + index * ((right - left) / (points.length - 1))
  const positions = points.map((point, index) => {
    if (point.flagCount === null) return null
    return { x: xFor(index), y: yFor(point.flagCount) }
  })
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  for (const point of positions) {
    if (point) current.push(point)
    else if (current.length) { segments.push(current); current = [] }
  }
  if (current.length) segments.push(current)
  return { width, height, left, right, bottom, positions, segments, xFor, ticks: Array.from({ length: 5 }, (_, index) => ({ value: index * step, y: yFor(index * step) })) }
}

export function SiteMonitoringHistory({ points, events, emptyMessage, variant = 'full' }: {
  variant?: 'full' | 'overview'
  points: readonly MonitoringHistoryPoint[]
  events: readonly MonitoringTimelineEvent[]
  emptyMessage: string
}) {
  const compact = variant === 'overview'
  const chartId = useId()
  const plot = useRef<HTMLDivElement>(null)
  const [plotWidth, setPlotWidth] = useState(640)
  const geometry = chartGeometry(points, plotWidth, compact ? 112 : 144)
  const latest = points.at(-1)
  const hasGaps = points.some(point => point.flagCount === null)
  const hasCompleteCheck = points.some(point => point.flagCount !== null)
  const showPlot = points.length > 1 && hasCompleteCheck
  useLayoutEffect(() => {
    const element = plot.current
    if (!element) return
    const measure = () => { if (element.clientWidth > 0) setPlotWidth(element.clientWidth) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [showPlot, compact])
  return <section className={`${styles.panel} ${compact ? styles.overview : styles.history}`} aria-label={compact ? C.flagTrend : C.checkHistory}>
    {points.length > 0 ? <div className={styles.chart}>
      <div className={styles.chartIntro}><div className={styles.header}><div><h2>{C.flagTrend}</h2><p>{C.checksCount(points.length)}</p></div></div>
      {!compact ? <div className={styles.summary}>
        <strong className={styles.latest} data-attention={latest?.flagCount != null && latest.flagCount > 0}>{latest?.flagCount == null ? C.incomplete : C.flags(latest.flagCount)}</strong>
        <span>{C.latestCheck} · {latest?.label}</span>
      </div> : null}
      {!compact || !showPlot ? <p className={styles.explanation}>{!hasCompleteCheck ? C.awaitingCompleteCheck : points.length === 1 ? C.firstCheck : C.trendHelp}</p> : null}
      {!compact && latest?.flagCount === 0 ? <p className={styles.explanation}>{C.zeroFlagsScope}</p> : null}
      </div>
      <div className={styles.chartData}>{showPlot ? <><div ref={plot} className={styles.chartPlot}>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-labelledby={`${chartId}-title`} aria-describedby={`${chartId}-description`}>
        <title id={`${chartId}-title`}>{C.trendDescription(points.length)}</title>
        <desc id={`${chartId}-description`}>{points.map(point => `${point.label}: ${point.flagCount === null ? C.incomplete : C.flags(point.flagCount)}`).join('; ')}</desc>
        {geometry.ticks.map(tick => <text key={`axis-${tick.value}`} className={styles.axisLabel} x="0" y={tick.y} dominantBaseline="middle" aria-hidden="true">{tick.value}</text>)}
        {geometry.ticks.map(tick => <line key={tick.value} className={styles.gridLine} x1={geometry.left} x2={geometry.right} y1={tick.y} y2={tick.y} aria-hidden="true" />)}
        {geometry.segments.filter(segment => segment.length > 1).map((segment, index) => <polygon key={index} className={styles.area} points={`${segment[0].x},${geometry.bottom} ${segment.map(point => `${point.x},${point.y}`).join(' ')} ${segment.at(-1)!.x},${geometry.bottom}`} />)}
        {geometry.segments.map((segment, index) => <polyline key={index} className={styles.trend} points={segment.map(point => `${point.x},${point.y}`).join(' ')} />)}
        {geometry.positions.map((point, index) => point ? <g key={index}><circle className={styles.point} data-latest={index === points.length - 1} cx={point.x} cy={point.y} r={index === points.length - 1 ? 6 : 4}><title>{`${points[index].label}: ${C.flags(points[index].flagCount!)}`}</title></circle>{(points.length <= 8 || index === 0 || index === points.length - 1) ? <text data-count-label className={styles.pointLabel} x={point.x} y={point.y < 36 ? point.y + 24 : point.y - 12} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} aria-hidden="true">{points[index].flagCount}</text> : null}</g> : <circle key={index} className={styles.gap} cx={geometry.xFor(index)} cy={geometry.bottom} r="4"><title>{`${points[index].label}: ${C.incomplete}`}</title></circle>)}
      </svg></div>
      <div className={styles.chartLabels}><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div></> : null}
      {showPlot && hasGaps ? <p className={styles.gapNote}><i aria-hidden />{C.incompleteTrend}</p> : null}
      </div>
    </div> : events.length === 0 ? <div className={styles.chart}><div className={styles.header}><h2>{C.flagTrend}</h2></div><p className={styles.explanation}>{emptyMessage}</p></div> : <div className={styles.chart}><div className={styles.header}><h2>{C.flagTrend}</h2></div><p className={styles.explanation}>{C.scopedHistoryTrend}</p></div>}
    {!compact && events.length > 0 ? <><h2 className={styles.timelineHeading}>{C.checkHistory}</h2><ol className={styles.timeline} aria-label={C.checkHistory}>
      {events.map(event => <li key={event.id} className={styles.event}><i data-state={event.state} aria-hidden="true" /><div>
        <div className={styles.eventHeader}><strong>{event.title}</strong><time dateTime={event.dateTime}>{event.time}</time></div>
        {event.evidenceHref ? <Link className={styles.count} href={event.evidenceHref as Route}>{event.evidenceLabel}</Link> : null}
        {event.detail ? <p className={styles.count}>{event.detail}</p> : null}
        {event.resultLabel ? <p className={styles.count}>{event.resultLabel}</p> : null}
        {event.flagCount !== undefined && (event.state !== 'unknown' || event.flagCount > 0) ? <span className={styles.count}>{C.flags(event.flagCount)}</span> : null}
        {event.flags?.length ? <ul className={styles.flags}>{event.flags.map(flag => <li key={flag.id}>
          {flag.onOpen ? <InteractiveButton type="button" onClick={event => flag.onOpen?.(event.currentTarget)}>{flag.title}<ArrowUpRight size={14} aria-hidden /></InteractiveButton> : flag.href ? <Link href={flag.href as Route}>{flag.title}<ArrowUpRight size={14} aria-hidden /></Link> : <span>{flag.title}</span>}
        </li>)}</ul> : null}
      </div></li>)}
    </ol></> : null}
  </section>
}
