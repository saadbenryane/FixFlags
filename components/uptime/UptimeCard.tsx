'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { UPTIME_COPY as C } from '@/lib/marketing/copy/uptime'
import { uptimeHistorySchema } from '@/lib/uptime/contracts'
import type { UptimeHistory, UptimeSegment, UptimeSummary } from '@/lib/uptime/domain'
import { boardCardFreshnessText } from '@/lib/sites/board-card'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import styles from './UptimeCard.module.css'

function PeriodStrip({ segments }: { segments: readonly UptimeSegment[] }) {
  return <div>
    <div className={styles.marks} role="img" aria-label={C.timeline}>
      {segments.map(segment => <span key={segment.startAt} data-state={segment.state} aria-hidden
        title={`${formatEvidenceTimestamp(segment.startAt)}: ${C.periodSummary(segment.checked, segment.expected, C.states[segment.state])}`} />)}
    </div>
    <div className={styles.legend}>{(['online', 'offline', 'unknown'] as const).map(state => <span key={state}><i data-state={state} aria-hidden />{C.states[state]}</span>)}</div>
  </div>
}

export function UptimeCard({ siteId, summary, verification, historySource, referenceTime }: {
  siteId: string; summary: UptimeSummary | null; verification?: ReactNode;
  historySource?: (window: UptimeHistory['window']) => UptimeHistory;
  referenceTime?: number;
}) {
  const [now, setNow] = useState<number | null>(referenceTime ?? null)
  useEffect(() => {
    if (referenceTime !== undefined) { setNow(referenceTime); return }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [referenceTime])
  const [open, setOpen] = useState(false)
  const [window, setWindow] = useState<UptimeHistory['window']>('24h')
  const [history, setHistory] = useState<UptimeHistory | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const generation = useRef(0)
  const trigger = useRef<HTMLButtonElement>(null)

  async function requestHistory(cursor: string | null, signal?: AbortSignal) {
    if (historySource) {
      const parsed = uptimeHistorySchema.parse(historySource(window))
      if (parsed.window !== window) throw new Error(C.failed)
      return parsed
    }
    const query = new URLSearchParams({ window })
    if (cursor) query.set('cursor', cursor)
    const response = await fetch(`/api/sites/${siteId}/uptime?${query}`, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(C.failed)
    const body = await response.json()
    if (body?.siteId !== siteId) throw new Error(C.failed)
    const parsed = uptimeHistorySchema.parse(body)
    if (parsed.window !== window) throw new Error(C.failed)
    return parsed
  }

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const id = ++generation.current
    const load = async () => {
      setLoading(true); setError(false)
      try {
        const data = await requestHistory(null, controller.signal)
        if (!controller.signal.aborted && generation.current === id) setHistory(data)
      } catch { if (!controller.signal.aborted && generation.current === id) setError(true) }
      finally { if (!controller.signal.aborted && generation.current === id) setLoading(false) }
    }
    setHistory(null)
    void load()
    const timer = historySource ? null : setInterval(() => void load(), 60_000)
    return () => { controller.abort(); if (timer) clearInterval(timer); generation.current = id + 1 }
    // One request owns a Site/window generation; pagination uses that same scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId, window, refreshKey, historySource])

  async function loadMore() {
    if (!history?.nextCursor || loading) return
    const id = generation.current
    setLoading(true); setError(false)
    try {
      const next = await requestHistory(history.nextCursor)
      if (id === generation.current) setHistory(previous => previous ? { ...next, probes: [...previous.probes, ...next.probes] } : next)
    } catch { if (id === generation.current) setError(true) }
    finally { if (id === generation.current) setLoading(false) }
  }

  const state = summary?.state ?? 'unknown'
  const validHistory = history?.window === window ? history : null
  const data = validHistory ?? (window === '24h' ? summary : null)
  return <>
    <article className={styles.card} aria-label={C.title} data-state={state}>
      <InteractiveButton ref={trigger} type="button" className={styles.header} aria-label={C.details} onClick={() => setOpen(true)}>
        <span><Activity size={18} aria-hidden /><strong>{C.title}</strong></span>
        <span className={styles.state}>{state === 'checking' ? <Loader2 size={13} className="text-brand motion-safe:animate-spin" aria-hidden /> : <i data-state={state} aria-hidden />}{C.states[state]}{summary?.lastCheckedAt ? <time className={styles.checkedAt} dateTime={summary.lastCheckedAt} title={formatEvidenceTimestamp(summary.lastCheckedAt) ?? undefined}>{C.checked} {now === null ? formatEvidenceTimestamp(summary.lastCheckedAt) : boardCardFreshnessText(summary.lastCheckedAt, now)?.toLowerCase()}</time> : null}<ArrowRight size={16} aria-hidden /></span>
      </InteractiveButton>
      {summary?.segments ? <PeriodStrip segments={summary.segments} /> : null}
      <div className={styles.meta}>{summary && !summary.enabled ? <span>{C.paused}</span> : null}{!summary?.lastCheckedAt ? <span>{C.firstCheck}</span> : null}</div>
      {summary && summary.openIncidentCount > 0 ? <p className={styles.incidentCount}>{C.openIncidents(summary.openIncidentCount)}</p> : null}
    </article>
    <ResponsiveDepth header={<DialogTitle>{C.details}</DialogTitle>} open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }} className="max-w-3xl">
      <DialogDescription className="sr-only">{C.description}</DialogDescription>
      <div className={styles.overviewStatus}><a href={data?.targetUrl ?? summary?.targetUrl} target="_blank" rel="noopener noreferrer">{data?.targetUrl ?? summary?.targetUrl}</a><span data-state={data?.state ?? state}><i aria-hidden />{C.states[data?.state ?? state]}</span></div>
      <div className={styles.windows}>{(['24h', '7d', '30d'] as const).map(value => <Button key={value} variant={window === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={window === value} onClick={() => setWindow(value)}>{C.periods[value]}</Button>)}</div>
      {data?.segments ? <PeriodStrip segments={data.segments} /> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : null}
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{C.failed}</p><Button variant="outline" size="sm" onClick={() => setRefreshKey(key => key + 1)}>{C.retry}</Button></div> : null}
      {validHistory ? <>
        <section aria-labelledby="uptime-incidents-heading"><h3 id="uptime-incidents-heading" className={styles.sectionTitle}>{C.incidents}</h3>
          {validHistory.incidents.length ? <ul className={styles.incidents}>{validHistory.incidents.map(incident => <li key={incident.id}>
            <strong>{incident.recoveredAt ? C.recovered : incident.supersededAt ? C.targetChanged : C.incidentOpen}</strong>
            {incident.recoveredAt ? <span className={styles.duration} title={C.observedDuration(Math.max(0, Math.round((Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt)) / 60_000)))}>{C.incidentDuration(Math.max(0, Math.round((Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt)) / 60_000)))}</span> : null}
            <dl className={styles.incidentTimes}><div><dt>{C.confirmed}</dt><dd><time dateTime={incident.confirmedAt}>{formatEvidenceTimestamp(incident.confirmedAt)}</time></dd></div>
              {incident.recoveredAt ? <div><dt>{C.recovered}</dt><dd><time dateTime={incident.recoveredAt}>{formatEvidenceTimestamp(incident.recoveredAt)}</time></dd></div> : null}</dl>
            <details className={styles.probeDetails}><summary>{C.probeDetails}</summary><p>{incident.targetUrl}</p><p>{C.reasons[incident.reason as keyof typeof C.reasons] ?? C.states.unknown}</p></details>
          </li>)}</ul> : <p className="text-sm text-muted-foreground">{C.noIncidents}</p>}
        </section>
        <details className={styles.periods}><summary>{C.history}<ChevronDown size={15} aria-hidden /></summary>
          <ul className={styles.probes}>{validHistory.probes.map(probe => <li key={probe.id}>
            <time dateTime={probe.observedAt}>{formatEvidenceTimestamp(probe.observedAt)}</time>
            <span>{C.results[probe.result]}{probe.result === 'FAILED' && !probe.confirmed ? ` · ${C.confirmationPending}` : ''}</span>
            <small>{C.reasons[probe.reason as keyof typeof C.reasons] ?? C.states.unknown}{probe.statusCode ? ` · HTTP ${probe.statusCode}` : ''} · {probe.durationMs} ms</small>
            <small>{probe.finalUrl ?? probe.targetUrl}</small><small>{C.scheduled} {formatEvidenceTimestamp(probe.scheduledAt)}</small>
          </li>)}</ul>
          {validHistory.nextCursor ? <Button variant="outline" size="sm" className="mt-3" disabled={loading} onClick={() => void loadMore()}>{C.loadMore}</Button> : null}
        </details>
      </> : null}
        <details className={styles.periods}><summary>{C.checkDetails}<ChevronDown size={15} aria-hidden /></summary>
          <p className={styles.scope}>{C.scope} {C.limitation}</p>
          {verification ? <details className={styles.periods}><summary>{C.renderedVerification}</summary><p>{C.renderedLimitation}</p>{verification}</details> : null}
          {validHistory ? <details className={styles.periods}><summary>{C.recordedPeriods}</summary><ul>{validHistory.segments.map(segment => <li key={segment.startAt}><time dateTime={segment.startAt}>{formatEvidenceTimestamp(segment.startAt)}</time><span>{C.periodSummary(segment.checked, segment.expected, C.states[segment.state])}</span></li>)}</ul></details> : null}
        </details>
    </ResponsiveDepth>
  </>
}
