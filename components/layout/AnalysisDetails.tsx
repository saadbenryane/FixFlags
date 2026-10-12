'use client'

import { useRef, useState } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { useSiteResource } from '@/hooks/useSiteResource'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'
import type { SiteActivity } from '@/lib/sites/activity'
import { CARD_CATALOG, type SiteCardArea } from '@/lib/sites/card-areas'
import { CHECK_MODULES } from '@/lib/audit/check-registry'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import styles from './AnalysisDetails.module.css'

export function LiveSiteAnalysisDetails({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  const { view, disconnected } = useSiteResource(siteId, initial)
  return <SiteAnalysisDetails view={view} disconnected={disconnected} />
}

export function SiteAnalysisDetails({ view, disconnected }: { view: SiteHomeView; disconnected: boolean }) {
  const active = view.presentation.run.state === 'queued' || view.presentation.run.state === 'running'
  const offline = disconnected || Boolean(view.recoveryUnavailable)
  const label = offline ? SITE_WORKSPACE_COPY.disconnected : active ? view.presentation.run.state === 'queued' ? SITE_WORKSPACE_COPY.queued : SITE_WORKSPACE_COPY.analyzing : view.presentation.run.label
  return <AnalysisDetails host={view.presentation.identity.host} statusLabel={label} active={active} disconnected={offline} activity={view.activity} progress={view.executionProgress} />
}

function areaFor(task: ExecutionProgress['tasks'][number]): SiteCardArea | null {
  if (task.module && CHECK_MODULES[task.module]) return CHECK_MODULES[task.module].area
  if (['http', 'browser', 'captures', 'discovery', 'cross-page'].includes(task.kind)) return 'site'
  if (['flow', 'journeys'].includes(task.kind)) return 'conversion'
  if (['pagespeed', 'slow-replay'].includes(task.kind)) return 'performance'
  if (['search', 'search-resources', 'google'].includes(task.kind)) return 'search'
  if (task.kind === 'keyboard') return 'accessibility'
  if (task.kind === 'bindings' && task.module === 'HTTP_AVAILABILITY') return 'uptime'
  return null
}

export function AnalysisDetails({ host, statusLabel, active, disconnected, activity, progress }: {
  host: string; statusLabel: string; active: boolean; disconnected: boolean;
  activity?: SiteActivity; progress?: ExecutionProgress | null;
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const copy = SITE_ACTION_COPY.execution
  const taskLabel = (task: ExecutionProgress['tasks'][number]) => task.module
    ? copy.modules[task.module as keyof typeof copy.modules] ?? copy.kinds[task.kind as keyof typeof copy.kinds] ?? copy.title
    : copy.kinds[task.kind as keyof typeof copy.kinds] ?? copy.title
  const stateLabel = (value: string) => copy.states[value as keyof typeof copy.states] ?? value
  const task = progress?.tasks.find(item => item.state === 'RUNNING') ?? progress?.tasks.find(item => item.state === 'RETRY_WAIT')
  const groups = new Map<SiteCardArea, ExecutionProgress['tasks']>()
  for (const item of progress?.tasks ?? []) {
    const area = areaFor(item)
    if (area) groups.set(area, [...(groups.get(area) ?? []), item])
  }
  return <>
    <div className={styles.statusLine}>
      <span role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
        {active && !disconnected ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden /> : null}
        {statusLabel}
      </span>
      <Button ref={trigger} variant="ghost" size="icon" className="shrink-0" aria-label={SITE_BOARD_COPY.activityTitle} onClick={() => setOpen(true)}>
        <Info className="h-4 w-4" aria-hidden />
      </Button>
    </div>
    <ResponsiveDepth open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}>
      <DialogTitle className="break-all pr-8">{host}</DialogTitle>
      <DialogDescription>{statusLabel}</DialogDescription>
      <p className={styles.currentActivity}>{disconnected ? SITE_ACTION_COPY.updatesDisconnected : task ? taskLabel(task) : active ? copy.live ?? SITE_BOARD_COPY.activityDescription : activity?.label ?? SITE_BOARD_COPY.activityDescription}</p>
      {progress ? <p className="text-sm text-muted-foreground">{copy.completed(progress.completed, progress.total)} · {SITE_WORKSPACE_COPY.remaining(progress.pending + progress.running + progress.recovering)}</p> : null}
      {!progress && activity?.milestones.length ? <ul className={styles.categories}>{activity.milestones.map(item => <li key={item.label}><span>{item.label}</span><span className={styles.categoryState}>{SITE_WORKSPACE_COPY.milestones[item.state]}</span></li>)}</ul> : null}
      {groups.size > 0 ? <ul className={styles.categories} aria-label={copy.title}>
        {[...groups].map(([area, tasks]) => {
          const state = tasks.some(item => item.state === 'RUNNING') ? 'RUNNING'
            : tasks.some(item => item.state === 'RETRY_WAIT') ? 'RETRY_WAIT'
            : tasks.some(item => ['BLOCKED', 'EXHAUSTED'].includes(item.state)) ? 'EXHAUSTED'
            : tasks.some(item => ['WAITING', 'READY'].includes(item.state)) ? 'WAITING' : 'COMPLETED'
          return <li key={area}><span>{CARD_CATALOG[area].name}</span><span className={styles.categoryState}>{state === 'RUNNING' && !disconnected ? <Loader2 size={13} className="text-brand motion-safe:animate-spin" aria-hidden /> : null}{disconnected && state === 'RUNNING' ? statusLabel : stateLabel(state)}</span></li>
        })}
      </ul> : null}
      <details className={styles.technical}>
        <summary>{SITE_WORKSPACE_COPY.technicalDetails}</summary>
        <p>{copy.limitation}</p>
        {progress ? <p>{copy.completed(progress.completed, progress.total)}</p> : null}
        <ul>{progress?.tasks.map(item => <li key={item.id}><strong>{taskLabel(item)}{item.device ? ` · ${copy.devices[item.device]}` : ''}</strong><span>{stateLabel(item.state)}</span><p>{item.pageUrl}</p><span>{SITE_WORKSPACE_COPY.attempts(item.attempts)}{item.reason ? ` · ${item.reason}` : ''}</span>{item.retryAt ? <time dateTime={item.retryAt}>{formatEvidenceTimestamp(item.retryAt)}</time> : null}</li>)}</ul>
        {progress && progress.total > progress.tasks.length ? <p>{copy.bounded}</p> : null}
        {activity?.events.length ? <ol>{activity.events.map((event, index) => <li key={`${event.at}-${index}`}><strong>{event.label}</strong><time dateTime={event.at}>{formatEvidenceTimestamp(event.at)}</time></li>)}</ol> : null}
      </details>
    </ResponsiveDepth>
  </>
}
