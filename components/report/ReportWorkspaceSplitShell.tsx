'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { WorkspaceViewToggle, type WorkspacePanelView } from '@/components/report/WorkspaceViewToggle'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import {
  WorkspaceBrowserPanel,
  type PreviewDevice,
} from '@/components/report/WorkspaceBrowserPanel'
import { WorkspaceDeviceToggle } from '@/components/report/WorkspaceDeviceToggle'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import { WorkspacePreviewTransport } from '@/components/report/WorkspacePreviewTransport'
import { displaySiteAddress } from '@/lib/utils/url-helpers'
import {
  WORKSPACE_PANEL_HEADER_CLASS,
  WORKSPACE_PANE_SCROLL_CLASS,
  WORKSPACE_SPLIT_GRID_CLASS,
  WORKSPACE_STAGE_CLASS,
} from '@/components/report/workspace-geometry'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PreviewEvidenceProvider, usePreviewEvidence } from '@/components/report/preview-evidence-context'

interface ReportWorkspaceSplitShellProps {
  isActiveReview?: boolean
  /** When false, hide the left chat/activity column (password-share viewers). */
  showChatColumn?: boolean
  /**
   * Active-review mode: the left panel reads as a working Agent, the desktop
   * right panel toggles Report | Preview, and mobile switches Agent | Report |
   * Preview with Agent as the default surface.
   */
  scanning?: boolean
  leftPanel: ReactNode
  browserUrl: string
  browserScreenshots?: AuditScreenshot[]
  browserCaptureStatus?: ScreenshotCaptureStatus | null
  reportPanel: ReactNode
  /** Grounded Flags currently available while the live review progresses. */
  findingCount?: number
  steps: PlaybackStep[]
  /** Timeline and playback require an authenticated report owner. */
  canUseTimeline?: boolean
  showCanvas?: boolean
  canUseCanvas?: boolean
  canvasPanel?: ReactNode
  className?: string
}

/**
 * Small screens show one column at a time. Which surface the Product column
 * shows is still `view`, so mobile and desktop never diverge.
 */
type MobileFocus = 'chat' | 'product'

export const REPORT_PLAYBACK_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'

export function ReportWorkspaceSplitShell(props: ReportWorkspaceSplitShellProps) {
  return (
    <PreviewEvidenceProvider>
      <ReportWorkspaceSplitShellInner {...props} />
    </PreviewEvidenceProvider>
  )
}

function ReportWorkspaceSplitShellInner({
  isActiveReview = false,
  showChatColumn = true,
  scanning = false,
  leftPanel,
  browserUrl,
  browserScreenshots = [],
  browserCaptureStatus,
  reportPanel,
  findingCount = 0,
  steps,
  canUseTimeline = true,
  showCanvas = false,
  canUseCanvas = false,
  canvasPanel,
  className,
}: ReportWorkspaceSplitShellProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [view, setView] = useState<WorkspacePanelView>(scanning ? 'browser' : 'report')
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>(
    scanning || isActiveReview ? 'chat' : 'product'
  )
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const previewEvidence = usePreviewEvidence()
  const selectedHighlight =
    previewEvidence.highlights.find((highlight) => highlight.device === device) ??
    previewEvidence.highlights[0] ??
    null

  const stepParam = searchParams.get('step')

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`fixflags:workspace-panel:${pathname}`)
    if (saved === 'chat' || saved === 'product') setMobileFocus(saved)
    if (saved === 'preview') setMobileFocus('product')
  }, [pathname])

  const chooseMobileFocus = (next: MobileFocus) => {
    setMobileFocus(next)
    window.sessionStorage.setItem(`fixflags:workspace-panel:${pathname}`, next)
  }

  const chooseMobileView = (next: WorkspacePanelView) => {
    setView(next)
    chooseMobileFocus('product')
  }

  useEffect(() => {
    const measured = previewEvidence.highlights.find(
      (highlight) => highlight.scope === 'element' && highlight.measured
    )
    if (measured) setDevice(measured.device)
  }, [previewEvidence.selectedFlagId, previewEvidence.highlights])

  useEffect(() => {
    if (scanning || !canUseTimeline || !stepParam || steps.length === 0) return
    const requested = Number(stepParam)
    if (!Number.isInteger(requested)) return
    const index = requested - 1
    if (index < 0 || index >= steps.length) return
    setActiveIndex(index)
    setView('browser')
    requestAnimationFrame(() => {
      document.getElementById('report-flags')?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [scanning, canUseTimeline, stepParam, steps.length])

  const activeStep = activeIndex != null ? (steps[activeIndex] ?? null) : null
  const selectStep = (index: number) => {
    setActiveIndex((current) => (current === index ? null : index))
    setView('browser')
  }

  const scrubStep = (index: number) => {
    setActiveIndex(index)
    setView('browser')
  }

  const canReplay = !scanning && canUseTimeline

  const previewStage = (
    <WorkspaceBrowserPanel
      url={browserUrl}
      screenshots={browserScreenshots}
      captureStatus={browserCaptureStatus}
      activeStep={canReplay ? activeStep : null}
      device={device}
      evidenceHighlight={activeStep ? null : selectedHighlight}
      className="h-full"
    />
  )

  const previewTransport = (
    <WorkspacePreviewTransport
      steps={steps}
      activeIndex={activeIndex}
      onSelectStep={selectStep}
      onScrub={scrubStep}
      onBackToLive={() => setActiveIndex(null)}
      canReplay={canReplay}
      signInNext={canUseTimeline ? undefined : pathname}
      scanning={scanning}
    />
  )

  const scrollContent =
    view === 'canvas' ? (
      canUseCanvas ? (
        canvasPanel ?? (
          <div className="flex min-h-[360px] items-center justify-center">
            <p className="text-sm text-muted-foreground">{REPORT_COPY.workspace.canvas.start}</p>
          </div>
        )
      ) : (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="max-w-sm space-y-4 text-center">
            <p className="text-xl font-semibold text-foreground">{REPORT_COPY.workspace.canvas.lockedTitle}</p>
            <p className="text-sm text-muted-foreground">{REPORT_COPY.workspace.canvas.lockedBody}</p>
            <Button asChild><Link href="/pricing">{REPORT_COPY.workspace.canvas.upgrade}</Link></Button>
          </div>
        </div>
      )
    ) : (
      reportPanel
    )

  const renderToggle = () => (
    <WorkspaceViewToggle
      view={view}
      onChange={setView}
      showCanvas={showCanvas}
      scanning={scanning}
    />
  )

  /**
   * One instance of each column. Rendering the Product column twice (desktop
   * grid plus mobile stack) duplicated every report section id, so anchors and
   * container queries could resolve against the hidden copy.
   */
  const leftColumn = showChatColumn ? (
    <div
      className={cn(
        'h-full min-h-0 min-w-0',
        mobileFocus === 'chat' ? 'block' : 'hidden',
        'lg:block'
      )}
    >
      {leftPanel}
    </div>
  ) : null

  /**
   * One tab bar for the whole review. It carries the same surfaces as the
   * desktop toggle, so nothing about the mobile shell changes when a scan
   * finishes.
   */
  // Agent → Preview → Report → Canvas mirrors the desktop Preview-first order.
  const mobileTabs = [
    {
      id: 'chat',
      label: REPORT_COPY.workspace.panels.chatTab,
      selected: mobileFocus === 'chat',
      onSelect: () => chooseMobileFocus('chat'),
    },
    {
      id: 'browser',
      label: scanning
        ? REPORT_COPY.workspace.panels.previewView
        : REPORT_COPY.workspace.panels.browserView,
      selected: mobileFocus === 'product' && view === 'browser',
      onSelect: () => chooseMobileView('browser'),
    },
    {
      id: 'report',
      label: REPORT_COPY.workspace.panels.productTab,
      selected: mobileFocus === 'product' && view === 'report',
      onSelect: () => chooseMobileView('report'),
    },
    ...(showCanvas && !scanning
      ? [
          {
            id: 'canvas',
            label: REPORT_COPY.workspace.panels.canvasView,
            selected: mobileFocus === 'product' && view === 'canvas',
            onSelect: () => chooseMobileView('canvas'),
          },
        ]
      : []),
  ]

  const productHeader = (
    <div className={WORKSPACE_PANEL_HEADER_CLASS}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {REPORT_COPY.workspace.panels.productReality}
        </p>
        <p className="truncate text-2xs text-muted-foreground">
          {displaySiteAddress(browserUrl)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Slot is reserved for the whole scan so the first Flag cannot shift the header. */}
        {scanning && view === 'browser' ? (
          <div className="hidden min-w-[10.5rem] justify-end sm:flex">
            {findingCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('report')}
                className="tabular-nums"
              >
                {REPORT_COPY.workspace.panels.inspectFindings(findingCount)}
              </Button>
            ) : null}
          </div>
        ) : null}
        {view === 'browser' ? (
          <WorkspaceDeviceToggle device={device} onDeviceChange={setDevice} />
        ) : null}
        {/* Without a chat column there is no mobile tab bar, so the pane keeps the toggle. */}
        <div className={showChatColumn ? 'hidden lg:block' : 'block'}>{renderToggle()}</div>
      </div>
    </div>
  )

  const productColumn = (
    <div
      className={cn(
        'h-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/10',
        !showChatColumn || mobileFocus === 'product' ? 'flex' : 'hidden',
        'lg:flex'
      )}
    >
      {productHeader}
      {view === 'browser' ? (
        <>
          <div className={WORKSPACE_STAGE_CLASS}>{previewStage}</div>
          {previewTransport}
        </>
      ) : (
        <div className={WORKSPACE_PANE_SCROLL_CLASS}>{scrollContent}</div>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        REPORT_PLAYBACK_SCROLL_MT,
        'flex h-full min-h-0 flex-col',
        className
      )}
    >
      {showChatColumn ? (
        <WorkspaceMobileTabs
          label={REPORT_COPY.workspace.panels.mobileTabsLabel}
          tabs={mobileTabs}
        />
      ) : null}

      <div
        className={cn(
          'grid min-h-0 flex-1',
          showChatColumn ? WORKSPACE_SPLIT_GRID_CLASS : 'lg:grid-cols-1'
        )}
      >
        {leftColumn}
        {productColumn}
      </div>
    </div>
  )
}
