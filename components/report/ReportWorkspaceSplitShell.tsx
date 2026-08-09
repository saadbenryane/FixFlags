'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { WorkspaceViewToggle, type WorkspacePanelView } from '@/components/report/WorkspaceViewToggle'
import {
  WorkspacePlaybackStrip,
  type PlaybackStep,
} from '@/components/report/WorkspacePlaybackStrip'
import { WorkspaceBrowserPanel } from '@/components/report/WorkspaceBrowserPanel'
import { WorkspacePanel } from '@/components/report/WorkspacePanel'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ReportWorkspaceSplitShellProps {
  isActiveReview?: boolean
  /** When false, hide the left chat/activity column (password-share viewers). */
  showChatColumn?: boolean
  leftPanel: ReactNode
  browserUrl: string
  browserScreenshots?: AuditScreenshot[]
  browserCaptureStatus?: ScreenshotCaptureStatus | null
  reportPanel: ReactNode
  steps: PlaybackStep[]
  /** Timeline and playback require an authenticated report owner. */
  canUseTimeline?: boolean
  className?: string
}

type MobileFocus = 'chat' | 'product'

export const REPORT_PLAYBACK_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'

export function ReportWorkspaceSplitShell({
  isActiveReview = false,
  showChatColumn = true,
  leftPanel,
  browserUrl,
  browserScreenshots = [],
  browserCaptureStatus,
  reportPanel,
  steps,
  canUseTimeline = true,
  className,
}: ReportWorkspaceSplitShellProps) {
  const searchParams = useSearchParams()
  const [view, setView] = useState<WorkspacePanelView>('report')
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>(isActiveReview ? 'chat' : 'product')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const stepParam = searchParams.get('step')

  useEffect(() => {
    if (!canUseTimeline || !stepParam || steps.length === 0) return
    const requested = Number(stepParam)
    if (!Number.isInteger(requested)) return
    const index = requested - 1
    if (index < 0 || index >= steps.length) return
    setActiveIndex(index)
    setView('browser')
    requestAnimationFrame(() => {
      document.getElementById('report-flags')?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [canUseTimeline, stepParam, steps.length])

  const activeStep = activeIndex != null ? (steps[activeIndex] ?? null) : null
  const selectStep = (index: number) => {
    setActiveIndex((current) => (current === index ? null : index))
    setView('browser')
  }

  const scrubStep = (index: number) => {
    setActiveIndex(index)
    setView('browser')
  }

  const stepEvidence =
    activeStep && activeIndex != null && view === 'report' ? (
      activeStep.screenshot ? (
        <WorkspacePanel>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {REPORT_COPY.workspace.playback.evidenceTitle(activeIndex + 1)}
            </p>
            <button
              type="button"
              className="min-h-11 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-md"
              onClick={() => setActiveIndex(null)}
            >
              {REPORT_COPY.workspace.playback.closeEvidence}
            </button>
          </div>
          <BrowserFrame
            label={activeStep.label}
            url={activeStep.url ?? browserUrl}
            imageUrl={activeStep.screenshot}
            device="desktop"
            className="mt-2 max-h-[360px] overflow-hidden"
          />
        </WorkspacePanel>
      ) : null
    ) : null

  const productContent =
    view === 'browser' ? (
      canUseTimeline ? (
        <WorkspaceBrowserPanel
          url={browserUrl}
          screenshots={browserScreenshots}
          captureStatus={browserCaptureStatus}
          activeStep={activeStep}
          onCloseStep={activeStep ? () => setActiveIndex(null) : undefined}
        />
      ) : (
        <WorkspacePanel className="flex min-h-[360px] items-center justify-center">
          <div className="max-w-sm space-y-4 text-center">
            <p className="font-display text-xl font-semibold text-foreground">See how FixFlags checked the path</p>
            <p className="text-sm text-muted-foreground">
              Sign in to inspect the captured timeline and replay the evidence behind this report.
            </p>
            <Button asChild>
              <Link href="/sign-in">Sign in to view Timeline</Link>
            </Button>
          </div>
        </WorkspacePanel>
      )
    ) : (
      reportPanel
    )

  const toggle = <WorkspaceViewToggle view={view} onChange={setView} />

  const playback =
    canUseTimeline && steps.length > 0 ? (
      <WorkspacePlaybackStrip
        steps={steps}
        activeIndex={activeIndex}
        onSelectStep={selectStep}
        onScrub={scrubStep}
      />
    ) : null

  const leftColumn = showChatColumn ? (
    <div>{leftPanel}</div>
  ) : null

  const productColumn = (
    <div className="space-y-3">
      {stepEvidence}
      {productContent}
    </div>
  )

  return (
    <div className={cn(REPORT_PLAYBACK_SCROLL_MT, 'space-y-3', className)}>
      <div className="hidden items-center justify-between gap-3 lg:flex">{toggle}</div>

      {showChatColumn ? (
        <div className="flex gap-2 lg:hidden">
          <button
            type="button"
            aria-pressed={mobileFocus === 'chat'}
            className={cn(
              'min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
              mobileFocus === 'chat' ? 'border-brand bg-brand/10' : 'border-border'
            )}
            onClick={() => setMobileFocus('chat')}
          >
            {REPORT_COPY.workspace.panels.chatTab}
          </button>
          <button
            type="button"
            aria-pressed={mobileFocus === 'product'}
            className={cn(
              'min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
              mobileFocus === 'product' ? 'border-brand bg-brand/10' : 'border-border'
            )}
            onClick={() => setMobileFocus('product')}
          >
            {REPORT_COPY.workspace.panels.productTab}
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          'hidden gap-4 lg:grid',
          showChatColumn
            ? 'lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]'
            : 'lg:grid-cols-1'
        )}
      >
        {leftColumn}
        {productColumn}
      </div>

      {playback ? <div className="hidden lg:block">{playback}</div> : null}

      <div className="space-y-3 lg:hidden">
        {showChatColumn && mobileFocus === 'chat' ? (
          leftColumn
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">{toggle}</div>
            {productColumn}
          </div>
        )}
        {playback}
      </div>
    </div>
  )
}
