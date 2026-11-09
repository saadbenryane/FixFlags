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
  const { run, freshness } = view.presentation
  const active = run.state === 'queued' || run.state === 'running'
  const retryNeeded = readUnavailable || Boolean(view.recoveryUnavailable)
  const offline = disconnected || retryNeeded
  const checkedAt = !active && !offline ? freshness.checkedAt : null
  const label = offline ? SITE_WORKSPACE_COPY.disconnected : run.state === 'queued' ? SITE_WORKSPACE_COPY.queued : SITE_WORKSPACE_COPY.analyzing
  const settledLabel = run.state === 'idle'
    ? view.audit.status === 'COMPLETED' ? SITE_WORKSPACE_COPY.analysisFinished : ''
    : run.label
  return <div key={siteId} className={active || offline || checkedAt ? 'flex flex-wrap items-center gap-x-3' : 'sr-only'}>
    <AnalysisDetails statusLabel={label} active={active} disconnected={offline} settledLabel={settledLabel} />
    {checkedAt ? <p className={styles.status}>{SITE_BOARD_COPY.lastChecked} <SiteEvidenceTime checkedAt={checkedAt} label={freshness.label} /></p> : null}
    {retryNeeded && onRetry ? <Button ref={button} type="button" variant="ghost" size="xs" loading={busy} aria-busy={busy || undefined} onClick={() => void retry()}>{SITE_WORKSPACE_COPY.retryUpdates}</Button> : null}
  </div>
}

/** Keep a Site's live region mounted through settlement so its next message can be announced. */
export function AnalysisDetails({ statusLabel, active, disconnected, settledLabel }: {
  statusLabel: string
  active: boolean
  disconnected: boolean
  settledLabel?: string
}) {
  const visible = active || disconnected
  if (!visible && settledLabel === undefined) return null
  return <p role="status" aria-atomic="true" className={visible ? styles.status : 'sr-only'}>
    {active && !disconnected ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden /> : null}
    {visible ? statusLabel : settledLabel}
  </p>
}
