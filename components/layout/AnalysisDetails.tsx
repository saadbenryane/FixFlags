'use client'

import { Loader2 } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSharedSiteResource } from '@/components/sites/SiteResourceBoundary'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SiteEvidenceTime } from '@/components/sites/SiteEvidenceTime'
import styles from './AnalysisDetails.module.css'

export function LiveSiteAnalysisDetails({ siteId }: { siteId: string }) {
  const { view, disconnected, readUnavailable, refresh } = useSharedSiteResource(siteId)
  return <SiteAnalysisDetails view={view} disconnected={disconnected} readUnavailable={readUnavailable} onRetry={refresh} />
}

export function SiteAnalysisDetails({ view, disconnected, readUnavailable = false, onRetry }: { view: SiteHomeView; disconnected: boolean; readUnavailable?: boolean; onRetry?: () => Promise<unknown> }) {
  const siteId = view.site.siteId
  const owner = useMemo(() => ({ siteId, active: false, pending: false }), [siteId])
  const [waiting, setWaiting] = useState<typeof owner | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const busy = waiting === owner
  useLayoutEffect(() => {
    owner.active = true
    return () => { owner.active = false }
  }, [owner])
  async function retry() {
    if (!onRetry || !owner.active || owner.pending) return
    const restoreFocus = document.activeElement === button.current
    const heading = button.current?.closest('[data-site-content]')?.querySelector<HTMLElement>('h1[tabindex]')
    owner.pending = true; setWaiting(owner)
    try { await onRetry() }
    catch { /* The shared Site read retains its disconnected status and evidence. */ }
    finally {
      owner.pending = false
      if (owner.active) {
        setWaiting(current => current === owner ? null : current)
        if (restoreFocus && heading?.isConnected && document.activeElement === document.body) heading.focus({ preventScroll: true })
      }
    }
  }
  const active = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  const retryNeeded = readUnavailable || Boolean(view.recoveryUnavailable)
  const offline = disconnected || retryNeeded
  if (!active && !offline) return view.presentation.freshness.checkedAt
    ? <p className={styles.status}>{SITE_BOARD_COPY.lastChecked} <SiteEvidenceTime checkedAt={view.presentation.freshness.checkedAt} label={view.presentation.freshness.label} /></p> : null
  const label = offline ? SITE_WORKSPACE_COPY.disconnected : view.presentation.run.state === 'queued' ? SITE_WORKSPACE_COPY.queued : SITE_WORKSPACE_COPY.analyzing
  const status = <AnalysisDetails statusLabel={label} active={active} disconnected={offline} />
  return retryNeeded && onRetry ? <div className="flex flex-wrap items-center gap-x-3">{status}<Button key={siteId} ref={button} type="button" variant="ghost" size="xs" loading={busy} aria-busy={busy || undefined} onClick={() => void retry()}>{SITE_WORKSPACE_COPY.retryUpdates}</Button></div> : status
}

/** A live or disconnected run keeps one short status. A finished run does not narrate the pipeline. */
export function AnalysisDetails({ statusLabel, active, disconnected }: {
  statusLabel: string
  active: boolean
  disconnected: boolean
}) {
  if (!active && !disconnected) return null
  return <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
    {active && !disconnected ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden /> : null}
    {statusLabel}
  </p>
}
