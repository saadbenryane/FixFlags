'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics/events'
import { SITE_RESULTS_GATE as C } from '@/lib/marketing/copy/site-results-gate'
import type { SiteResultsGateView } from '@/lib/sites/application/results-gate'
import styles from './SiteResultsGate.module.css'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { formatEvidenceTimestamp } from '@/lib/time/format'

export const SITE_RESULTS_GATE_POLL_MS = 3000

/** A visitor sees the check run, then signs up to read what it found. */
export function SiteResultsGate({ initial }: { initial: SiteResultsGateView }) {
  return <SiteResultsGateContent key={initial.siteId} initial={initial} />
}

function SiteResultsGateContent({ initial }: { initial: SiteResultsGateView }) {
  const [view, setView] = useState(initial)
  const [disconnected, setDisconnected] = useState(false)
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState<number | null>(null)
  const running = view.state === 'running'
  // A queued check has not started: no stage is active and nothing is described as running.
  const queued = running && view.queued === true

  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const { response, body } = await fetchJsonWithDeadline(`/api/sites/${encodeURIComponent(initial.siteId)}`, { cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        if (!response.ok || !body || typeof body !== 'object') throw new Error()
        const next = body as Partial<SiteResultsGateView> & { site?: { siteId?: string } }
        // An owner response means the check was claimed in another tab.
        if (next.kind !== 'results_gate' && next.site?.siteId) { window.location.reload(); return }
        if (next.kind !== 'results_gate' || next.siteId !== initial.siteId || !['running', 'ready', 'failed'].includes(next.state ?? '') ||
          ![0, 1, 2, 3].includes(next.stage ?? -1) || !['sign_in', 'claim'].includes(next.continuation ?? '')) throw new Error()
        setView({ ...initial, ...next } as SiteResultsGateView)
        setDisconnected(false)
      } catch { if (!controller.signal.aborted) setDisconnected(true) }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => void poll(), SITE_RESULTS_GATE_POLL_MS) }
    }
    timer = setTimeout(() => void poll(), retry ? 0 : SITE_RESULTS_GATE_POLL_MS)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [running, initial, retry])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [running])
  const elapsed = view.startedAt && now !== null ? Math.max(0, Math.floor((now - Date.parse(view.startedAt)) / 60_000)) : null

  const destination = `/sites/${encodeURIComponent(view.siteId)}`
  const next = encodeURIComponent(destination)
  const primaryHref = (view.continuation === 'claim' ? `/post-login?next=${next}` : `/sign-up?next=${next}`) as Route
  const title = view.state === 'ready' ? C.ready.title : view.state === 'failed' ? C.failed.title : queued ? C.queued.title(view.host) : C.running.title(view.host)
  const body = view.state === 'ready' ? C.ready.body(view.host) : view.state === 'failed' ? C.failed.body(view.host) : queued ? C.queued.body : C.running.body

  return <div className={styles.gate} aria-labelledby="results-gate-title">
    <section className={styles.card}>
      <h1 id="results-gate-title">{title}</h1>
      <p className={styles.body}>{body}</p>
      <ol className={styles.stages} aria-label={title}>
        {C.stages.map((label, index) => {
          const state = view.state === 'ready' || index < view.stage ? 'done' : running && !queued && index === view.stage ? 'active' : 'pending'
          return <li key={label} data-state={state}>
            <span className={styles.mark} aria-hidden="true">
              {state === 'done' ? <Check size={14} /> : state === 'active' ? <Loader2 size={14} className={styles.spin} /> : null}
            </span>
            <span>{label}</span>
            <span className="sr-only">{state === 'done' ? C.stageDone : state === 'active' ? C.stageActive : C.stagePending}</span>
          </li>
        })}
      </ol>
      {running ? <div className="space-y-2 text-sm text-muted-foreground">
        {elapsed !== null && Number.isFinite(elapsed) ? <p>{queued ? C.requested(elapsed) : C.elapsed(elapsed)}</p> : null}
        {!queued && view.lastActivityAt ? <p>{C.lastActivity} <time dateTime={view.lastActivityAt}>{formatEvidenceTimestamp(view.lastActivityAt)}</time></p> : null}
        {!queued && elapsed !== null && elapsed >= 3 ? <p>{C.slow}</p> : null}
        {disconnected ? <div role="status"><p>{C.disconnected}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>{C.retry}</Button></div> : null}
      </div> : null}
      <div className={styles.actions}>
        <Button asChild size="lg">
          <Link href={primaryHref} onClick={() => trackEvent('report_signup_cta_clicked', { from: 'results_gate' })}>
            {view.continuation === 'claim' ? C.claim : C.signUp}
          </Link>
        </Button>
        <p className={styles.note}>{C.note}</p>
        {running ? <Link href="/how-it-works#sample" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{C.sample}</Link> : null}
        {view.continuation === 'sign_in' ? <p className={styles.signIn}>{C.signInLead}{' '}
          <Link href={`/sign-in?next=${next}` as Route}>{C.signIn}</Link></p> : null}
      </div>
    </section>
  </div>
}
