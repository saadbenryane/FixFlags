'use client'
import { Loader2 } from 'lucide-react'
import type { SiteActivity } from '@/lib/sites/activity'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { runBanner, type RunBanner, type SitePresentation } from '@/lib/sites/presentation'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { cn } from '@/lib/utils'

function runFromActivity(activity: SiteActivity): SitePresentation['run'] {
  const state = activity.state === 'queued' ? 'queued'
    : activity.state === 'running' ? 'running'
    : activity.state === 'partial' ? 'partial'
    : activity.state === 'failed' ? 'failed'
    : 'idle'
  return {
    state,
    label: activity.label,
    auditId: state === 'idle' ? null : 'current',
    recoveryAction: state === 'partial' || state === 'failed' ? 'retry' : state === 'queued' || state === 'running' ? 'view_details' : null,
  }
}

export function SiteActivityPanel({ activity, disconnected, children, onRetry, retryBusy = false, compact = false, banner }: { activity?: SiteActivity; disconnected: boolean; children?: ReactNode; onRetry?: () => Promise<void>; retryBusy?: boolean; compact?: boolean; banner?: RunBanner | null }) {
  const [showActivity, setShowActivity] = useState(false)
  const resolved = banner === undefined
    ? activity && activity.state !== 'unverified'
      ? runBanner({
          run: runFromActivity(activity),
          monitoring: { state: 'not_monitored', label: '' },
          disconnected,
        })
      : null
    : banner
  if (!resolved || resolved.kind === 'details') return null
  const active = resolved.kind === 'analyzing'
  const headline = resolved.headline
  const events = activity?.events ?? []
  return <section className={compact ? '' : cn('rounded-board-panel border bg-background p-4 sm:p-5', active ? 'border-brand/20 bg-brand/[0.025]' : 'border-border')} aria-label={headline}>
    {!compact ? <>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <div className="flex min-w-0 items-center gap-3">
      {active ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand"><Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /></span> : null}
    <div className="min-w-0">
    <p role="status" className="text-sm font-semibold">
      {headline}
    </p>
    {active ? <p className="mt-1 text-xs text-muted-foreground">{SITE_ACTION_COPY.execution.live}</p> : null}
    </div>
    </div>
    <div className="flex items-center gap-1">
      {resolved.recovery === 'retry' && onRetry ? <Button variant="outline" size="sm" disabled={retryBusy || disconnected} onClick={() => void onRetry()}>{retryBusy ? SITE_BOARD_COPY.starting : SITE_BOARD_COPY.checkAgain}</Button> : null}
      {events.length > 0 ? <Button variant="ghost" size="sm" onClick={() => setShowActivity(true)}>{SITE_BOARD_COPY.activityTitle}</Button> : null}
    </div>
    </div>
    {children}
    </> : events.length > 0 || children ? <Button variant="ghost" size="sm" onClick={() => setShowActivity(true)}>{SITE_BOARD_COPY.activityTitle}</Button> : null}
    <Dialog open={showActivity} onOpenChange={setShowActivity}>
      <DialogContent header={<DialogTitle>{SITE_BOARD_COPY.activityTitle}</DialogTitle>} className="max-h-[85dvh]">
        <DialogDescription>{SITE_BOARD_COPY.activityDescription}</DialogDescription>
        {compact ? children : null}
        <ol className="space-y-4">{events.map((event, index) => <li key={`${event.at}:${index}`}><p className="text-sm font-medium">{event.label}</p><p className="mt-1 text-xs text-muted-foreground">{formatEvidenceTimestamp(event.at)}</p></li>)}</ol>
      </DialogContent>
    </Dialog>
  </section>
}
