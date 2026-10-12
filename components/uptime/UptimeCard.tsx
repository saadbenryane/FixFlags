'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { UPTIME_COPY as C } from '@/lib/marketing/copy/uptime'
import { uptimeHistorySchema } from '@/lib/uptime/contracts'
import type { UptimeHistory, UptimeSegment, UptimeSummary } from '@/lib/uptime/domain'
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

export function UptimeCard({ siteId, summary, verification, historySource }: {
  siteId: string; summary: UptimeSummary | null; verification?: ReactNode;
  historySource?: (window: UptimeHistory['window']) => UptimeHistory;
}) {
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
      <button ref={trigger} type="button" className={styles.header} aria-label={C.details} onClick={() => setOpen(true)}>
        <span><Activity size={18} aria-hidden /><strong>{C.title}</strong></span>
        <span className={styles.state}>{state === 'checking' ? <Loader2 size={13} className="text-brand motion-safe:animate-spin" aria-hidden /> : <i data-state={state} aria-hidden />}{C.states[state]}<ArrowRight size={16} aria-hidden /></span>
      </button>
      {summary?.segments ? <PeriodStrip segments={summary.segments} /> : null}
      <div className={styles.meta}><span>{summary ? summary.enabled ? C.cadence : C.paused : C.scope}</span>{summary?.lastCheckedAt ? <time dateTime={summary.lastCheckedAt}>{C.lastChecked} {formatEvidenceTimestamp(summary.lastCheckedAt)}</time> : <span>{C.firstCheck}</span>}</div>
      {summary && summary.openIncidentCount > 0 ? <p className={styles.incidentCount}>{C.openIncidents(summary.openIncidentCount)}</p> : null}
    </article>
    <ResponsiveDepth open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }} className="max-w-3xl">
      <DialogTitle>{C.details}</DialogTitle><DialogDescription>{C.description}</DialogDescription>
      {verification ? <details className={styles.periods}><summary>{C.renderedVerification}</summary><p>{C.renderedLimitation}</p>{verification}</details> : null}
      <p className={styles.scope}>{data?.targetUrl}<br />{C.scope} {C.limitation}</p>
      <div className={styles.windows}>{(['24h', '7d', '30d'] as const).map(value => <Button key={value} variant={window === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={window === value} onClick={() => setWindow(value)}>{C.periods[value]}</Button>)}</div>
      {data?.segments ? <PeriodStrip segments={data.segments} /> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : null}
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{C.failed}</p><Button variant="outline" size="sm" onClick={() => setRefreshKey(key => key + 1)}>{C.retry}</Button></div> : null}
      {validHistory ? <>
        <details className={styles.periods}><summary>{C.recordedPeriods}</summary><ul>{validHistory.segments.map(segment => <li key={segment.startAt}><time dateTime={segment.startAt}>{formatEvidenceTimestamp(segment.startAt)}</time><span>{C.periodSummary(segment.checked, segment.expected, C.states[segment.state])}</span></li>)}</ul></details>
        <section aria-labelledby="uptime-incidents-heading"><h3 id="uptime-incidents-heading" className={styles.sectionTitle}>{C.incidents}</h3>
          {validHistory.incidents.length ? <ul className={styles.incidents}>{validHistory.incidents.map(incident => <li key={incident.id}>
            <strong>{incident.recoveredAt ? C.recovered : incident.supersededAt ? C.targetChanged : C.incidentOpen}</strong>
            <span>{incident.targetUrl}</span><time dateTime={incident.confirmedAt}>{C.confirmed} {formatEvidenceTimestamp(incident.confirmedAt)}</time>
            {incident.recoveredAt ? <time dateTime={incident.recoveredAt}>{C.recovered} {formatEvidenceTimestamp(incident.recoveredAt)}</time> : null}
            <span>{C.reasons[incident.reason as keyof typeof C.reasons] ?? C.states.unknown}</span>
            {incident.recoveredAt ? <p>{C.observedDuration(Math.max(0, Math.round((Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt)) / 60_000)))}</p> : null}
          </li>)}</ul> : <p className="text-sm text-muted-foreground">{C.noIncidents}</p>}
        </section>
        <section aria-labelledby="uptime-history-heading"><h3 id="uptime-history-heading" className={styles.sectionTitle}>{C.history}</h3>
          <ul className={styles.probes}>{validHistory.probes.map(probe => <li key={probe.id}>
            <time dateTime={probe.observedAt}>{formatEvidenceTimestamp(probe.observedAt)}</time>
            <span>{C.results[probe.result]}{probe.result === 'FAILED' && !probe.confirmed ? ` · ${C.confirmationPending}` : ''}</span>
            <small>{C.reasons[probe.reason as keyof typeof C.reasons] ?? C.states.unknown}{probe.statusCode ? ` · HTTP ${probe.statusCode}` : ''} · {probe.durationMs} ms</small>
            <small>{probe.finalUrl ?? probe.targetUrl}</small><small>{C.scheduled} {formatEvidenceTimestamp(probe.scheduledAt)}</small>
          </li>)}</ul>
          {validHistory.nextCursor ? <Button variant="outline" size="sm" className="mt-3" disabled={loading} onClick={() => void loadMore()}>{C.loadMore}</Button> : null}
        </section>
      </> : null}
    </ResponsiveDepth>
  </>
}
