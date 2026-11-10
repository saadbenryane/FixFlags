'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { UPTIME_COPY as C } from '@/lib/marketing/copy/uptime'
import { useUptimeHistory } from '@/hooks/useUptimeHistory'
import { useMinuteClock } from '@/hooks/useMinuteClock'
import { currentUptimeState, type UptimeHistory, type UptimeSegment, type UptimeSummary } from '@/lib/uptime/domain'
import { boardCardFreshnessText } from '@/lib/sites/board-card'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import styles from './UptimeCard.module.css'

const segmentSummary = (segment: UptimeSegment) => segment.expected === 0 ? C.notMonitored
  : C.periodSummary(segment.checked, segment.expected, C.states[segment.state])

function PeriodStrip({ segments }: { segments: readonly UptimeSegment[] }) {
  return <div>
    <div className={styles.marks} role="img" aria-label={C.timeline}>
      {segments.map(segment => <span key={segment.startAt} data-state={segment.expected === 0 ? 'none' : segment.state} aria-hidden
        title={`${formatEvidenceTimestamp(segment.startAt)}: ${segmentSummary(segment)}`} />)}
    </div>
    <div className={styles.legend}>{(['online', 'offline', 'unknown'] as const).map(state => <span key={state}><i data-state={state} aria-hidden />{C.states[state]}</span>)}</div>
  </div>
}

function stateAt(summary: UptimeSummary | null, now: number | null) {
  if (!summary) return 'unknown'
  if (now === null) return summary.state
  return currentUptimeState({ enabled: summary.enabled, state: summary.state,
    lastCheckedAt: summary.lastCheckedAt ? new Date(summary.lastCheckedAt) : null, now: new Date(now) })
}

function statusRevision(summary: UptimeSummary | null) {
  return JSON.stringify([summary?.enabled, summary?.targetUrl, summary?.state, summary?.lastCheckedAt, summary?.openIncidentCount])
}

export function UptimeCard({ siteId, summary, summaryReadAt, verification, historySource, referenceTime }: {
  siteId: string; summary: UptimeSummary | null; summaryReadAt?: number; verification?: ReactNode;
  historySource?: (window: UptimeHistory['window']) => UptimeHistory;
  referenceTime?: number;
}) {
  const clock = useMinuteClock(referenceTime === undefined)
  const now = referenceTime ?? clock
  const [open, setOpen] = useState(false)
  const [window, setWindow] = useState<UptimeHistory['window']>('24h')
  const { history, latest, error, loading, refresh, retry, loadMore } = useUptimeHistory(siteId, window, open, historySource, summary?.targetUrl)
  const trigger = useRef<HTMLButtonElement>(null)

  const validHistory = history?.window === window ? history : null
  const historyReadAt = Date.parse(latest?.historyScope?.through ?? '')
  // Read receipts order current status. Check timestamps still describe the
  // evidence, and historical periods retain their own recorded observations.
  const ordered = !historySource && summaryReadAt !== undefined && Number.isFinite(historyReadAt)
  const current = ordered && historyReadAt > summaryReadAt! ? latest : summary
  // Explicit preview sources retain their authored states and reference clock.
  const state = historySource ? summary?.state ?? 'unknown' : stateAt(current, now)
  const data = validHistory ?? (window === '24h' ? summary : null)
  const detailStatus = ordered ? current : data ?? summary
  const detailState = historySource ? data?.state ?? state : stateAt(detailStatus, now)
  const summaryRevision = statusRevision(summary)
  const historyRevision = statusRevision(latest)
  const requestedStatus = useRef<string | null>(null)
  useEffect(() => {
    // A new status also needs a fresh incident receipt in an open inspector.
    // Unchanged reads and failed refreshes cannot repeatedly request history.
    if (!open || !ordered || summaryReadAt! <= historyReadAt || summaryRevision === historyRevision) { requestedStatus.current = null; return }
    if (loading) return
    const revision = JSON.stringify([siteId, summaryRevision, historyReadAt])
    if (requestedStatus.current === revision) return
    requestedStatus.current = revision
    void refresh()
  }, [siteId, open, ordered, loading, summaryReadAt, historyReadAt, summaryRevision, historyRevision, refresh])
  const probeList = useRef<HTMLUListElement>(null)
  const historyRetry = useRef<HTMLButtonElement>(null)
  const historyFocus = useRef<{ siteId: string; target: string | undefined; window: UptimeHistory['window']; after: string | null; button: HTMLButtonElement; dialog: Element | null } | null>(null)
  function readHistory(button: HTMLButtonElement, load: () => Promise<void>) {
    historyFocus.current = probeList.current?.closest('details')?.open
      ? { siteId, target: summary?.targetUrl, window, after: validHistory?.probes.at(-1)?.id ?? null, button, dialog: button.closest('[role="dialog"]') }
      : null
    void load()
  }
  useLayoutEffect(() => {
    const request = historyFocus.current
    if (!request || loading) return
    historyFocus.current = null
    if (!open || request.siteId !== siteId || request.target !== summary?.targetUrl || request.window !== window) return
    // A removed control can send focus to the document or dialog. Preserve an
    // intentional move elsewhere while the request was pending.
    const active = document.activeElement
    if (active !== request.button && active !== document.body && active !== request.dialog) return
    if (error) { (request.button.isConnected ? request.button : historyRetry.current)?.focus(); return }
    const index = validHistory?.probes.findIndex(probe => probe.id === request.after) ?? -1
    const row = probeList.current?.children.item(index + 1) ?? probeList.current?.children.item(index)
    if (row instanceof HTMLElement) row.focus()
    else if (request.button.isConnected) request.button.focus()
  }, [open, siteId, summary?.targetUrl, window, loading, error, validHistory])
  return <>
    <article className={styles.card} aria-label={C.title} data-state={state}>
      <InteractiveButton ref={trigger} type="button" className={styles.header} aria-label={C.details} onClick={() => setOpen(true)}>
        <span><Activity size={18} aria-hidden /><strong>{C.title}</strong></span>
        <span className={styles.state}>{state === 'checking' ? <Loader2 size={13} className="text-brand motion-safe:animate-spin" aria-hidden /> : <i data-state={state} aria-hidden />}{C.states[state]}{current?.lastCheckedAt ? <time className={styles.checkedAt} dateTime={current.lastCheckedAt} title={formatEvidenceTimestamp(current.lastCheckedAt) ?? undefined}>{C.checked} {now === null ? formatEvidenceTimestamp(current.lastCheckedAt) : boardCardFreshnessText(current.lastCheckedAt, now)?.toLowerCase()}</time> : null}<ArrowRight size={16} aria-hidden /></span>
      </InteractiveButton>
      {summary?.segments ? <PeriodStrip segments={summary.segments} /> : null}
      <div className={styles.meta}>{current && !current.enabled ? <span>{C.paused}</span> : null}{!current?.lastCheckedAt ? <span>{C.firstCheck}</span> : null}</div>
      {current && current.openIncidentCount > 0 ? <p className={styles.incidentCount}>{C.openIncidents(current.openIncidentCount)}</p> : null}
    </article>
    <ResponsiveDepth header={<DialogTitle>{C.details}</DialogTitle>} open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }} className="max-w-3xl">
      <DialogDescription className="sr-only">{C.description}</DialogDescription>
      <div className={styles.overviewStatus}><a href={data?.targetUrl ?? summary?.targetUrl} target="_blank" rel="noopener noreferrer">{data?.targetUrl ?? summary?.targetUrl}</a><span data-state={detailState}><i aria-hidden />{C.states[detailState]}</span></div>
      <div className={styles.windows}>{(['24h', '7d', '30d'] as const).map(value => <Button key={value} variant={window === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={window === value} onClick={() => setWindow(value)}>{C.periods[value]}</Button>)}</div>
      {data?.segments ? <PeriodStrip segments={data.segments} /> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : null}
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{C.failed}</p><Button ref={historyRetry} variant="outline" size="sm" loading={loading} onClick={event => readHistory(event.currentTarget, retry)}>{C.retry}</Button></div> : null}
      {validHistory ? <>
        <section aria-labelledby="uptime-incidents-heading"><h3 id="uptime-incidents-heading" className={styles.sectionTitle}>{C.incidents}</h3>
          {validHistory.incidents.length ? <ul className={styles.incidents}>{validHistory.incidents.map(incident => <li key={incident.id}>
            <strong>{incident.recoveredAt ? C.recovered : incident.supersededAt ? C.targetChanged : C.incidentOpen}</strong>
            {incident.recoveredAt ? <span className={styles.duration} title={C.observedDuration(Math.max(0, Math.round((Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt)) / 60_000)))}>{C.incidentDuration(Math.max(0, Math.round((Date.parse(incident.recoveredAt) - Date.parse(incident.startedAt)) / 60_000)))}</span> : null}
            <dl className={styles.incidentTimes}><div><dt>{C.confirmed}</dt><dd><time dateTime={incident.confirmedAt}>{formatEvidenceTimestamp(incident.confirmedAt)}</time></dd></div>
              {incident.recoveredAt ? <div><dt>{C.recovered}</dt><dd><time dateTime={incident.recoveredAt}>{formatEvidenceTimestamp(incident.recoveredAt)}</time></dd></div> : null}</dl>
            <details className={styles.probeDetails}><summary>{C.probeDetails}</summary><p>{incident.targetUrl}</p>
              <p>{C.reasons[incident.reason as keyof typeof C.reasons] ?? C.states.unknown}{incident.failureOrigin ? ` · ${incident.failureOrigin}` : ''}</p>
            </details>
          </li>)}</ul> : <p className="text-sm text-muted-foreground">{C.noIncidents}</p>}
        </section>
        <details className={styles.periods}><summary>{C.history}<ChevronDown size={15} aria-hidden /></summary>
          <ul ref={probeList} className={styles.probes}>{validHistory.probes.map(probe => {
            const pending = detailState === 'checking' && probe.result === 'FAILED' && probe.attempt === 1 && !probe.confirmed &&
              probe.targetUrl === detailStatus?.targetUrl && probe.observedAt === detailStatus.lastCheckedAt
            return <li key={probe.id} tabIndex={-1}>
              <time dateTime={probe.observedAt}>{formatEvidenceTimestamp(probe.observedAt)}</time>
              <span>{C.results[probe.result]}{pending ? ` · ${C.confirmationPending}` : ''}</span>
              <small>{C.reasons[probe.reason as keyof typeof C.reasons] ?? C.states.unknown}{probe.statusCode ? ` · HTTP ${probe.statusCode}` : ''} · {probe.durationMs} ms</small>
              <small>{probe.finalUrl ?? probe.targetUrl}</small><small>{C.scheduled} {formatEvidenceTimestamp(probe.scheduledAt)}</small>
            </li>
          })}</ul>
          {validHistory.nextCursor ? <Button variant="outline" size="sm" className="mt-3" loading={loading} onClick={event => readHistory(event.currentTarget, loadMore)}>{C.loadMore}</Button> : null}
        </details>
      </> : null}
        <details className={styles.periods}><summary>{C.checkDetails}<ChevronDown size={15} aria-hidden /></summary>
          <p className={styles.scope}>{C.scope} {C.limitation}</p>
          {verification ? <details className={styles.periods}><summary>{C.renderedVerification}</summary><p>{C.renderedLimitation}</p>{verification}</details> : null}
          {validHistory ? <details className={styles.periods}><summary>{C.recordedPeriods}</summary><ul>{validHistory.segments.map(segment => <li key={segment.startAt}><time dateTime={segment.startAt}>{formatEvidenceTimestamp(segment.startAt)}</time><span>{segmentSummary(segment)}</span></li>)}</ul></details> : null}
        </details>
    </ResponsiveDepth>
  </>
}
