'use client'

import { useState, type ReactNode } from 'react'
import { Flag } from 'lucide-react'
import { WorkspaceBrowserPanel } from '@/components/report/WorkspaceBrowserPanel'
import { WorkspaceDeviceToggle } from '@/components/report/WorkspaceDeviceToggle'
import { WorkspaceViewToggle } from '@/components/report/WorkspaceViewToggle'
import { WorkspacePreviewTransport } from '@/components/report/WorkspacePreviewTransport'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import { ScanWorkingMark } from '@/components/report/ScanWorkingStatus'
import {
  WORKSPACE_AGENT_HEADER_CLASS,
  WORKSPACE_PANE_SCROLL_CLASS,
  WORKSPACE_PANEL_HEADER_CLASS,
  WORKSPACE_SPLIT_GRID_CLASS,
  WORKSPACE_STAGE_CLASS,
  WORKSPACE_TRANSCRIPT_CLASS,
} from '@/components/report/workspace-geometry'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type LivingReviewView = 'browser' | 'report'
export type LivingReviewDevice = 'desktop' | 'mobile'

interface LivingReviewEmulationProps {
  /** Accessible name for the emulated editor. */
  label: string
  productName: string
  productHost: string
  browserUrl: string
  screenshots: AuditScreenshot[]
  device: LivingReviewDevice
  onDeviceChange: (device: LivingReviewDevice) => void
  view: LivingReviewView
  onViewChange: (view: LivingReviewView) => void
  /** The curated story is still capturing, so the transport says so honestly. */
  capturing?: boolean
  /** Curated path steps for the docked Preview transport. */
  steps?: PlaybackStep[]
  activeStepIndex?: number | null
  onSelectStep?: (index: number) => void
  onScrub?: (index: number) => void
  onBackToLive?: () => void
  transcript: ReactNode
  reportPanel: ReactNode
  /** Composer / gate row under the Agent transcript. */
  composer?: ReactNode
  /** Evidence card layered over the captured product view. */
  previewOverlay?: ReactNode
  /** Flush action bar below both panes. */
  footer?: ReactNode
  className?: string
}

/**
 * Curated emulation of the living review editor for marketing surfaces.
 * It reuses the live column geometry, pane chrome, view toggle, and browser
 * panel, and it renders only curated snapshots: no scan is ever started here.
 */
export function LivingReviewEmulation({
  label,
  productName,
  productHost,
  browserUrl,
  screenshots,
  device,
  onDeviceChange,
  view,
  onViewChange,
  capturing = false,
  steps = [],
  activeStepIndex = null,
  onSelectStep,
  onScrub,
  onBackToLive,
  transcript,
  reportPanel,
  composer,
  previewOverlay,
  footer,
  className,
}: LivingReviewEmulationProps) {
  const activeStep =
    activeStepIndex != null && activeStepIndex >= 0 && activeStepIndex < steps.length
      ? steps[activeStepIndex]
      : null

  // Match the live editor: one surface at a time below lg, so the stacked
  // transcript cannot bury the captured Product.
  const [mobileFocus, setMobileFocus] = useState<'chat' | 'product'>('product')

  return (
    <section
      aria-label={label}
      className={cn('relative flex flex-col overflow-hidden bg-background', className)}
    >
      <WorkspaceMobileTabs
        label={REPORT_COPY.workspace.panels.mobileTabsLabel}
        tabs={[
          {
            id: 'chat',
            label: REPORT_COPY.workspace.panels.chatTab,
            selected: mobileFocus === 'chat',
            onSelect: () => setMobileFocus('chat'),
          },
          {
            id: 'browser',
            label: REPORT_COPY.workspace.panels.previewView,
            selected: mobileFocus === 'product' && view === 'browser',
            onSelect: () => {
              setMobileFocus('product')
              onViewChange('browser')
            },
          },
          {
            id: 'report',
            label: REPORT_COPY.workspace.panels.productTab,
            selected: mobileFocus === 'product' && view === 'report',
            onSelect: () => {
              setMobileFocus('product')
              onViewChange('report')
            },
          },
        ]}
      />
      <div
        className={cn(
          'flex min-h-[34rem] flex-1 flex-col lg:grid lg:min-h-0',
          WORKSPACE_SPLIT_GRID_CLASS
        )}
      >
        <div
          aria-label={REPORT_COPY.workspace.panels.chatTab}
          role="group"
          className={cn(
            'min-h-0 min-w-0 flex-col border-b border-border/45 lg:border-b-0 lg:border-r',
            mobileFocus === 'chat' ? 'flex' : 'hidden',
            'lg:flex'
          )}
        >
          <header className={WORKSPACE_AGENT_HEADER_CLASS}>
            {capturing ? (
              <ScanWorkingMark className="h-9 w-9" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 ring-1 ring-brand/20">
                <Flag className="h-4 w-4 text-brand" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{productName}</p>
              <p className="truncate text-2xs text-muted-foreground">{productHost}</p>
            </div>
          </header>
          <div className={WORKSPACE_TRANSCRIPT_CLASS} role="log" aria-live="polite">
            {transcript}
          </div>
          {composer}
        </div>

        <div
          className={cn(
            'min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/10',
            mobileFocus === 'product' ? 'flex' : 'hidden',
            'lg:flex'
          )}
        >
          <header className={WORKSPACE_PANEL_HEADER_CLASS}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {REPORT_COPY.workspace.panels.productReality}
              </p>
              <p className="truncate text-2xs text-muted-foreground">{productHost}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {view === 'browser' ? (
                <WorkspaceDeviceToggle device={device} onDeviceChange={onDeviceChange} />
              ) : null}
              <div className="hidden lg:block">
                <WorkspaceViewToggle
                  view={view}
                  onChange={(next) => onViewChange(next === 'report' ? 'report' : 'browser')}
                  scanning
                />
              </div>
            </div>
          </header>

          {view === 'browser' ? (
            <>
              <div className={WORKSPACE_STAGE_CLASS}>
                <WorkspaceBrowserPanel
                  url={browserUrl}
                  screenshots={screenshots}
                  device={device}
                  activeStep={activeStep}
                  className="h-full"
                />
                {previewOverlay}
              </div>
              <WorkspacePreviewTransport
                steps={steps}
                activeIndex={activeStepIndex}
                onSelectStep={onSelectStep}
                onScrub={onScrub}
                onBackToLive={onBackToLive}
                canReplay={steps.length > 0 && !capturing}
                scanning={capturing}
                statusLabel={
                  capturing
                    ? REPORT_COPY.workspace.playback.capturing
                    : REPORT_COPY.workspace.playback.liveCapture
                }
              />
            </>
          ) : (
            <div className={WORKSPACE_PANE_SCROLL_CLASS}>{reportPanel}</div>
          )}
        </div>
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end border-t border-border/45 px-3 py-3 sm:px-4">
          {footer}
        </div>
      ) : null}
    </section>
  )
}
