'use client'

import { useState, type ReactNode } from 'react'
import { WorkspaceViewToggle, type WorkspacePanelView } from '@/components/report/WorkspaceViewToggle'
import { WorkspaceActivityPanel } from '@/components/report/WorkspaceActivityPanel'
import {
  WorkspacePlaybackStrip,
  type PlaybackStep,
} from '@/components/report/WorkspacePlaybackStrip'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface ReportWorkspaceSplitShellProps {
  isActiveReview?: boolean
  leftPanel: ReactNode
  activityEvents?: ActionTimelineEvent[]
  browserPanel: ReactNode
  reportPanel: ReactNode
  steps: PlaybackStep[]
  className?: string
}

type MobileFocus = 'chat' | 'product'

export function ReportWorkspaceSplitShell({
  isActiveReview = false,
  leftPanel,
  activityEvents = [],
  browserPanel,
  reportPanel,
  steps,
  className,
}: ReportWorkspaceSplitShellProps) {
  const [view, setView] = useState<WorkspacePanelView>(isActiveReview ? 'browser' : 'report')
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>('product')
  const [activeStepId, setActiveStepId] = useState<string | null>(null)

  const productContent = view === 'browser' ? browserPanel : reportPanel

  const activeStep = activeStepId ? (steps.find((s) => s.id === activeStepId) ?? null) : null
  const activeIndex = activeStep ? steps.indexOf(activeStep) + 1 : null
  const activeEventIndex = activeStep ? activeStep.eventIndex : null

  const handleSelectStep = (id: string) => {
    setActiveStepId((current) => (current === id ? null : id))
  }

  const stepEvidence = activeStep?.screenshot ? (
    <div className="space-y-2 rounded-card border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {REPORT_COPY.workspace.playback.evidenceTitle(activeIndex ?? 0)}
        </p>
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setActiveStepId(null)}
        >
          {REPORT_COPY.workspace.playback.closeEvidence}
        </button>
      </div>
      <BrowserFrame
        label={activeStep.label}
        url={activeStep.url}
        imageUrl={activeStep.screenshot}
        device="desktop"
        className="max-h-[360px] overflow-hidden"
      />
    </div>
  ) : null

  const toggle = <WorkspaceViewToggle view={view} onChange={setView} />

  const activity = (
    <WorkspaceActivityPanel events={activityEvents} highlightIndex={activeEventIndex} />
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="hidden items-center justify-between gap-3 lg:flex">{toggle}</div>

      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
            mobileFocus === 'chat' ? 'border-brand bg-brand/10' : 'border-border'
          )}
          onClick={() => setMobileFocus('chat')}
        >
          {REPORT_COPY.workspace.panels.chatTab}
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
            mobileFocus === 'product' ? 'border-brand bg-brand/10' : 'border-border'
          )}
          onClick={() => setMobileFocus('product')}
        >
          {REPORT_COPY.workspace.panels.productTab}
        </button>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-3">
          {activity}
          {leftPanel}
        </div>
        <div className="space-y-3">
          {stepEvidence}
          {productContent}
          <WorkspacePlaybackStrip
            steps={steps}
            activeStepId={activeStepId}
            onSelectStep={handleSelectStep}
          />
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {mobileFocus === 'chat' ? (
          <div className="space-y-3">
            {activity}
            {leftPanel}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">{toggle}</div>
            {stepEvidence}
            {productContent}
          </div>
        )}
        <WorkspacePlaybackStrip
          steps={steps}
          activeStepId={activeStepId}
          onSelectStep={handleSelectStep}
        />
      </div>
    </div>
  )
}
