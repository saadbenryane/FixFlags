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

export const SITE_RESULTS_GATE_POLL_MS = 3000

/** A visitor sees the check run, then signs up to read what it found. */
export function SiteResultsGate({ initial }: { initial: SiteResultsGateView }) {
  const [view, setView] = useState(initial)
  const running = view.state === 'running'

  useEffect(() => {
    if (!running) return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/sites/${encodeURIComponent(view.siteId)}`, { cache: 'no-store' })
        if (!response.ok) return
        const next = await response.json() as Partial<SiteResultsGateView>
        // An owner response means the check was claimed in another tab.
        if (next.kind !== 'results_gate') { window.location.reload(); return }
        if (!cancelled) setView(next as SiteResultsGateView)
      } catch { /* Keep the last known stage; the next poll retries. */ }
    }, SITE_RESULTS_GATE_POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [running, view.siteId])

  const destination = `/sites/${encodeURIComponent(view.siteId)}`
  const next = encodeURIComponent(destination)
  const primaryHref = (view.continuation === 'claim' ? `/post-login?next=${next}` : `/sign-up?next=${next}`) as Route
  const title = view.state === 'ready' ? C.ready.title : view.state === 'failed' ? C.failed.title : C.running.title(view.host)
  const body = view.state === 'ready' ? C.ready.body(view.host) : view.state === 'failed' ? C.failed.body(view.host) : C.running.body

  return <main className={styles.gate} aria-labelledby="results-gate-title">
    <section className={styles.card}>
      <h1 id="results-gate-title">{title}</h1>
      <p className={styles.body}>{body}</p>
      <ol className={styles.stages} aria-label={C.running.title(view.host)}>
        {C.stages.map((label, index) => {
          const state = !running || index < view.stage ? 'done' : index === view.stage ? 'active' : 'pending'
          return <li key={label} data-state={state}>
            <span className={styles.mark} aria-hidden="true">
              {state === 'done' ? <Check size={14} /> : state === 'active' ? <Loader2 size={14} className={styles.spin} /> : null}
            </span>
            <span>{label}</span>
            <span className="sr-only">{state === 'done' ? C.stageDone : state === 'active' ? C.stageActive : C.stagePending}</span>
          </li>
        })}
      </ol>
      <div className={styles.actions}>
        <Button asChild size="lg">
          <Link href={primaryHref} onClick={() => trackEvent('report_signup_cta_clicked', { from: 'results_gate' })}>
            {view.continuation === 'claim' ? C.claim : C.signUp}
          </Link>
        </Button>
        <p className={styles.note}>{C.note}</p>
        {view.continuation === 'sign_in' ? <p className={styles.signIn}>{C.signInLead}{' '}
          <Link href={`/sign-in?next=${next}` as Route}>{C.signIn}</Link></p> : null}
      </div>
    </section>
  </main>
}
