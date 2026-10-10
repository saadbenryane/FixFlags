'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { MONITORING_COPY as C } from '@/lib/marketing/copy'
import type { SiteHomeView } from '@/lib/sites/application/queries'

type Cadence = 'weekly' | 'daily'
type Result = { ok: boolean; stage?: 'coverage' | 'schedule'; message?: string; interval?: Cadence; firstCheck?: 'requested' | 'unavailable'; reused?: boolean }

export function SiteMonitoringActivation({ siteId, view, owner, checking, onRefresh }: {
  siteId: string; view: SiteHomeView; owner: boolean; checking: boolean; onRefresh: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [intervals, setIntervals] = useState<Cadence[] | null>(null)
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [reload, setReload] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const resultFocus = useRef<HTMLParagraphElement>(null)
  const ready = view.outcomes.filter(item => item.confirmedAt && item.enabled && item.bindings.some(binding => binding.required))
  const page = ready.find(item => item.kind === 'AVAILABILITY' && item.slug === 'page-loads')
  const scheduled = Boolean(view.watch.interval && view.watch.nextRunAt && ready.length)
  const needsSetup = !scheduled || !page || result?.firstCheck === 'unavailable'
  const pageAnswer = page?.running ? C.checking : !page?.lastVerifiedAt ? C.firstPending : page.state === 'CLEAR' ? C.pageClear : page.state === 'FLAG' ? C.pageFlag : page.state === 'STALE' ? C.stale : C.couldNotCheck
  const status = result ? !result.ok ? result.message ?? C.readiness : result.firstCheck === 'unavailable' ? C.checkFailed : result.reused ? C.requestedBefore : C.queued : null

  useEffect(() => {
    if (!open || !owner) return
    let active = true
    setIntervals(null); setLoadError(false)
    void fetch(`/api/sites/${siteId}/watch`).then(async response => {
      if (!response.ok) throw new Error('Options unavailable')
      const body = await response.json() as { intervals: Cadence[] }
      const allowed = body.intervals.filter(value => value === 'weekly' || value === 'daily')
      if (!active) return
      setIntervals(allowed)
      setCadence(view.watch.interval && allowed.includes(view.watch.interval) ? view.watch.interval : allowed.includes('weekly') ? 'weekly' : allowed[0] ?? 'weekly')
    }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [open, owner, siteId, reload, view.watch.interval])

  async function activate() {
    if (busy || !intervals?.includes(cadence)) return
    setBusy(true); setResult(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/watch/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval: cadence }) })
      const body = await response.json().catch(() => null) as Result | null
      setResult(body && typeof body.ok === 'boolean' ? body : { ok: false, message: C.readiness })
      await onRefresh()
    } catch { setResult({ ok: false, message: C.readiness }) }
    finally { setBusy(false); requestAnimationFrame(() => resultFocus.current?.focus()) }
  }

  const signedInHref = `/sign-in?next=${encodeURIComponent(`/sites/${siteId}`)}` as Route
  const signUpHref = `/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}` as Route
  const title = scheduled ? view.watch.state === 'watching' ? C.heading(view.watch.interval!) : C.needsAttention : view.watch.interval ? C.scheduleOnly : C.off

  return <>
    <section className="rounded-card border border-border bg-background p-5" aria-label={C.title}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Radio size={17} aria-hidden />{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{scheduled ? page ? pageAnswer : C.scheduled(view.watch.interval!) : C.offBody}</p>
          {scheduled ? <p className="mt-2 text-xs text-muted-foreground">{ready.map(item => item.name).join(' · ')}</p> : null}
        </div>
        <Button ref={trigger} variant={needsSetup ? 'brand' : 'outline'} disabled={checking} onClick={() => { setOpen(true); setResult(null) }}>{needsSetup ? C.turnOn : C.review}</Button>
      </div>
      {scheduled ? <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">{C.last}</dt><dd className="mt-1">{page?.lastVerifiedAt ? formatEvidenceTimestamp(page.lastVerifiedAt) : C.notRun}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{C.next}</dt><dd className="mt-1">{formatEvidenceTimestamp(view.watch.nextRunAt!)}</dd></div>
      </dl> : null}
      {view.watch.lastError ? <p className="mt-3 text-sm text-muted-foreground">{C.needsAttention} <Link href={`/sites/${siteId}/settings#watch`}>{C.manage}</Link></p> : null}
    </section>
    <ResponsiveDepth open={open} onOpenChange={value => { if (!busy) setOpen(value) }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DialogTitle>{C.setupTitle}</DialogTitle><DialogDescription>{C.setupBody}</DialogDescription>
      {!owner ? <div className="space-y-4"><h3 className="font-semibold">{C.claimTitle}</h3><p className="text-sm text-muted-foreground">{C.claimBody}</p><div className="flex flex-wrap gap-2"><Button asChild variant="brand"><Link href={signUpHref}>{C.signUp}</Link></Button><Button asChild variant="outline"><Link href={signedInHref}>{C.signIn}</Link></Button></div></div> : <>
        <div className="border-y border-border py-4"><h3 className="text-sm font-semibold">{C.page}</h3><p className="mt-1 break-all text-sm">{view.site.url}</p><p className="mt-2 text-sm text-muted-foreground">{C.expectation}</p>
          {ready.filter(item => item.id !== page?.id).length ? <div className="mt-4"><h3 className="text-sm font-semibold">{C.existing}</h3><ul className="mt-2 space-y-1 text-sm">{ready.filter(item => item.id !== page?.id).map(item => <li key={item.id}>{item.name}</li>)}</ul></div> : null}
        </div>
        {loadError ? <div role="status"><p>{C.unavailable}</p><p className="mt-1 text-sm text-muted-foreground">{C.unavailableBody}</p><Button variant="outline" className="mt-3" onClick={() => setReload(value => value + 1)}>{C.retry}</Button></div> : intervals === null ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : intervals.length === 0 ? <p role="status">{C.readiness}</p> : <>
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium" htmlFor="monitoring-cadence">{C.cadence}<select id="monitoring-cadence" className="min-h-11 rounded-control border border-border bg-background px-3" value={cadence} disabled={busy} onChange={event => setCadence(event.target.value as Cadence)}>{intervals.map(item => <option value={item} key={item}>{item === 'daily' ? C.daily : C.weekly}</option>)}</select></label>
          <p className="text-sm leading-relaxed text-muted-foreground">{view.settings.notificationLevel === 'OFF' ? C.noEmails : view.settings.notificationLevel === 'CRITICAL_ONLY' ? C.criticalEmails : C.emails}{view.settings.notificationLevel !== 'OFF' && view.settings.notifyOnRecovery ? ` ${C.recoveryEmails}` : ''}</p>
          {status ? <p ref={resultFocus} tabIndex={-1} role="status" className="rounded-control bg-muted p-3 text-sm leading-relaxed focus-visible:outline focus-visible:outline-ring">{status}</p> : null}
          {result?.ok && result.interval ? <p className="text-sm">{C.scheduled(result.interval)}</p> : null}
          {(!scheduled || needsSetup || result?.ok === false) && !(result?.ok && result.firstCheck === 'requested') ? <Button variant="brand" disabled={busy} onClick={() => void activate()}>{busy ? C.activating : result ? C.retry : C.turnOn}</Button> : <Button variant="outline" onClick={() => setOpen(false)}>{C.return}</Button>}
        </>}
        <div className="border-t border-border pt-4"><p className="text-xs leading-relaxed text-muted-foreground">{C.scope}</p><Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" href={`/sites/${siteId}/settings#settings-outcomes-heading`} onClick={() => setOpen(false)}>{C.expand}</Link><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{C.protected}</p></div>
      </>}
    </ResponsiveDepth>
  </>
}
