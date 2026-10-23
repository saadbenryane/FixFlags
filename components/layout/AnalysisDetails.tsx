'use client'

import { Loader2 } from 'lucide-react'
import { useSharedSiteResource } from '@/components/sites/SiteResourceBoundary'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import styles from './AnalysisDetails.module.css'

export function LiveSiteAnalysisDetails({ siteId }: { siteId: string }) {
  const { view, disconnected } = useSharedSiteResource(siteId)
  return <SiteAnalysisDetails view={view} disconnected={disconnected} />
}

export function SiteAnalysisDetails({ view, disconnected }: { view: SiteHomeView; disconnected: boolean }) {
  const active = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  const offline = disconnected || Boolean(view.recoveryUnavailable)
  if (!active && !offline) return view.presentation.freshness.checkedAt
    ? <p className={styles.status}>{SITE_BOARD_COPY.lastChecked} {view.presentation.freshness.label}</p> : null
  const label = offline ? SITE_WORKSPACE_COPY.disconnected : view.presentation.run.state === 'queued' ? SITE_WORKSPACE_COPY.queued : SITE_WORKSPACE_COPY.analyzing
  return <AnalysisDetails statusLabel={label} active={active} disconnected={offline} />
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
