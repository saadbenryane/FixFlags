'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  WorkspaceViewTabs,
  type WorkspacePanelView,
} from '@/components/report/WorkspaceViewTabs'
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
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'

interface ReportWorkspaceSplitShellProps {
  /** Optional accessible name when the shell is embedded in another page. */
  ariaLabel?: string
  isActiveReview?: boolean
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
  /** Fixed Report-mode header. Score and Review history live here. */
  reportHeader?: ReactNode
  reportPanel: ReactNode
  /** Grounded Flags currently available while the live review progresses. */
  findingCount?: number
  steps: PlaybackStep[]
  /** Controlled view/device/playback are used by the curated homepage story. */
  controlledView?: WorkspacePanelView
  onViewChange?: (view: WorkspacePanelView) => void
  controlledDevice?: PreviewDevice
  onDeviceChange?: (device: PreviewDevice) => void
  activeStepIndex?: number | null
  onSelectStep?: (index: number) => void
  onScrub?: (index: number) => void
  onBackToLive?: () => void
  /** Live report routes persist view in the URL. Embedded previews opt out. */
  syncViewToUrl?: boolean
  initialMobileFocus?: MobileFocus
  previewOverlay?: ReactNode
  footer?: ReactNode
  /** Canonical workspace access decision. Child panes never re-derive it. */
  capabilities: ReportWorkspaceCapabilities
  /** Claim action for anonymous teaser owners. Share/non-owner gates omit it. */
  timelineGateActionHref?: string
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
  ariaLabel,
  scanning = false,
  leftPanel,
  browserUrl,
  browserScreenshots = [],
  browserCaptureStatus,
  reportHeader,
  reportPanel,
  findingCount = 0,
  steps,
  controlledView,
  onViewChange,
  controlledDevice,
  onDeviceChange,
  activeStepIndex: controlledActiveStepIndex,
  onSelectStep,
  onScrub,
  onBackToLive,
  syncViewToUrl = true,
  initialMobileFocus,
  previewOverlay,
  footer,
  capabilities,
  timelineGateActionHref,
  canvasPanel,
  className,
}: ReportWorkspaceSplitShellProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const resolvedPathname = pathname || '/'
  const shellId = useId().replace(/:/g, '')
  const agentPanelId = `${shellId}-agent-panel`
  const productPanelId = `${shellId}-product-panel`
  const mobileTabsId = `${shellId}-mobile-tab`
  const desktopTabsId = `${shellId}-view-tab`
  const showCanvas = capabilities.canUseCanvas
  const canReplayTimeline = capabilities.canReplayTimeline
  const browserViewAvailable = scanning || canReplayTimeline
  const hidePreviewPane = !browserViewAvailable
  const requestedView = searchParams?.get('view') ?? null
  const viewFromUrl = useCallback((): WorkspacePanelView | null => {
    if (requestedView === 'timeline' && browserViewAvailable) return 'browser'
    if (requestedView === 'report') return 'report'
    if (requestedView === 'canvas' && showCanvas && !scanning) return 'canvas'
    return null
  }, [browserViewAvailable, requestedView, scanning, showCanvas])
  const [internalView, setInternalView] = useState<WorkspacePanelView>(
    () => {
      const fromUrl = viewFromUrl()
      return fromUrl ?? (scanning ? 'browser' : 'report')
    }
  )
  const [hydrated, setHydrated] = useState(false)
  const rawView = controlledView ?? internalView
  const view = rawView === 'browser' && !browserViewAvailable ? 'report' : rawView
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>(
    initialMobileFocus ?? (scanning ? 'chat' : 'product')
  )
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(null)
  const activeIndex = controlledActiveStepIndex !== undefined
    ? controlledActiveStepIndex
    : internalActiveIndex
  const [internalDevice, setInternalDevice] = useState<PreviewDevice>('desktop')
  const device = controlledDevice ?? internalDevice
  const previewEvidence = usePreviewEvidence()
  const selectedHighlight =
    previewEvidence.highlights.find((highlight) => highlight.device === device) ??
    previewEvidence.highlights[0] ??
    null

  const stepParam = searchParams?.get('step') ?? null

  useEffect(() => {
    if (!scanning) return
    const saved = window.sessionStorage.getItem(`fixflags:workspace-panel:${resolvedPathname}`)
    if (saved === 'chat' || saved === 'product') setMobileFocus(saved)
    if (saved === 'preview') setMobileFocus('product')
  }, [resolvedPathname, scanning])

  const chooseMobileFocus = (next: MobileFocus) => {
    setMobileFocus(next)
    window.sessionStorage.setItem(`fixflags:workspace-panel:${resolvedPathname}`, next)
  }

  const chooseView = useCallback((
    next: WorkspacePanelView,
    historyMode: 'push' | 'replace' = 'push',
  ) => {
    if (controlledView === undefined) setInternalView(next)
    onViewChange?.(next)
    if (!syncViewToUrl) return
    const url = new URL(window.location.href)
    url.searchParams.set('view', next === 'browser' ? 'timeline' : next)
    window.history[historyMode === 'push' ? 'pushState' : 'replaceState'](
      { ...window.history.state, fixflagsWorkspaceView: next },
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }, [controlledView, onViewChange, syncViewToUrl])

  const chooseMobileView = (next: WorkspacePanelView) => {
    chooseView(next)
    chooseMobileFocus('product')
  }

  const hrefForView = useCallback((next: WorkspacePanelView) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('view', next === 'browser' ? 'timeline' : next)
    const query = params.toString()
    return `${resolvedPathname}${query ? `?${query}` : ''}`
  }, [resolvedPathname, searchParams])

  useEffect(() => {
    if (!syncViewToUrl || controlledView !== undefined) return
    const next = viewFromUrl()
    if (next) setInternalView(next)
  }, [controlledView, syncViewToUrl, viewFromUrl])

  useEffect(() => {
    // Chromium can briefly retain the streamed server tree while committing
    // the hydrated workspace. Readiness means the document has settled back
    // to the one canonical score header, not merely that an effect has run.
    let readinessFrame = 0
    const markReadyWhenCanonical = () => {
      const duplicateCanonicalNode =
        document.querySelectorAll('#report-status').length > 1 ||
        document.querySelectorAll('[id$="-agent-panel"]').length > 1 ||
        document.querySelectorAll('[id$="-product-panel"]').length > 1
      if (duplicateCanonicalNode) {
        readinessFrame = window.requestAnimationFrame(markReadyWhenCanonical)
        return
      }
      setHydrated(true)
    }
    readinessFrame = window.requestAnimationFrame(markReadyWhenCanonical)
    return () => {
      window.cancelAnimationFrame(readinessFrame)
    }
  }, [])

  useEffect(() => {
    if (!syncViewToUrl || controlledView !== undefined) return
    const restoreView = () => {
      const value = new URL(window.location.href).searchParams.get('view')
      const next: WorkspacePanelView = value === 'timeline'
        ? 'browser'
        : value === 'report'
          ? 'report'
          : value === 'canvas' && showCanvas && !scanning
            ? 'canvas'
            : scanning
              ? 'browser'
              : 'report'
      setInternalView(next === 'browser' && !browserViewAvailable ? 'report' : next)
    }
    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [browserViewAvailable, controlledView, scanning, showCanvas, syncViewToUrl])

  useEffect(() => {
    const measured = previewEvidence.highlights.find(
      (highlight) => highlight.scope === 'element' && highlight.measured
    )
    if (!measured) return
    if (controlledDevice === undefined) setInternalDevice(measured.device)
    onDeviceChange?.(measured.device)
  }, [controlledDevice, onDeviceChange, previewEvidence.selectedFlagId, previewEvidence.highlights])

  useEffect(() => {
    if (scanning || !canReplayTimeline || !stepParam || steps.length === 0) return
    const requested = Number(stepParam)
    if (!Number.isInteger(requested)) return
    const index = requested - 1
    if (index < 0 || index >= steps.length) return
    if (controlledActiveStepIndex === undefined) setInternalActiveIndex(index)
    chooseView('browser', 'replace')
    requestAnimationFrame(() => {
      document.getElementById('report-flags')?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [scanning, canReplayTimeline, stepParam, steps.length, chooseView, controlledActiveStepIndex])

  const activeStep = activeIndex != null ? (steps[activeIndex] ?? null) : null
  const selectStep = (index: number) => {
    if (onSelectStep) onSelectStep(index)
    else setInternalActiveIndex((current) => (current === index ? null : index))
    chooseView('browser')
  }

  const scrubStep = (index: number) => {
    if (onScrub) onScrub(index)
    else setInternalActiveIndex(index)
    chooseView('browser')
  }

  const chooseDevice = (next: PreviewDevice) => {
    if (controlledDevice === undefined) setInternalDevice(next)
    onDeviceChange?.(next)
  }

  const canReplay = !scanning && canReplayTimeline
  const productAddress = displaySiteAddress(browserUrl)
  const requestedWorkspaceView = viewFromUrl()
  const workspaceReady = hydrated && (
    controlledView !== undefined ||
    !syncViewToUrl ||
    requestedWorkspaceView === null ||
    requestedWorkspaceView === view
  )

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
      onBackToLive={() => {
        if (onBackToLive) onBackToLive()
        else setInternalActiveIndex(null)
      }}
      canReplay={canReplay}
      gateActionHref={canReplayTimeline ? undefined : timelineGateActionHref}
      scanning={scanning}
    />
  )

  const scrollContent =
    view === 'canvas' ? (
      capabilities.canUseCanvas ? (
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
    <WorkspaceViewTabs
      view={view}
      onChange={chooseView}
      hrefForView={hrefForView}
      capabilities={capabilities}
      panelId={productPanelId}
      idPrefix={desktopTabsId}
      scanning={scanning}
      hideBrowserView={hidePreviewPane}
    />
  )

  /**
   * One instance of each column. Rendering the Product column twice (desktop
   * grid plus mobile stack) duplicated every report section id, so anchors and
   * container queries could resolve against the hidden copy.
   */
  const leftColumn = (
    <div
      id={agentPanelId}
      role="tabpanel"
      aria-labelledby={`${mobileTabsId}-chat`}
      className={cn(
        'h-full min-h-0 min-w-0 max-w-full',
        mobileFocus === 'chat' ? 'block' : 'hidden',
        'lg:block'
      )}
    >
      {leftPanel}
    </div>
  )

  /**
   * One tab bar for the whole review. It carries the same surfaces as the
   * desktop toggle, so nothing about the mobile shell changes when a scan
   * finishes.
   */
  // Agent → Preview → Report → Canvas mirrors the desktop Preview-first order.
  const mobileTabs = [
    {
      id: `${mobileTabsId}-chat`,
      label: REPORT_COPY.workspace.panels.chatTab,
      selected: mobileFocus === 'chat',
      onSelect: () => chooseMobileFocus('chat'),
      controls: agentPanelId,
    },
    ...(hidePreviewPane
      ? []
      : [
          {
            id: `${mobileTabsId}-browser`,
            label: scanning
              ? REPORT_COPY.workspace.panels.previewView
              : REPORT_COPY.workspace.panels.browserView,
            selected: mobileFocus === 'product' && view === 'browser',
            onSelect: () => chooseMobileView('browser'),
            controls: productPanelId,
            href: hrefForView('browser'),
          },
        ]),
    {
      id: `${mobileTabsId}-report`,
      label: REPORT_COPY.workspace.panels.productTab,
      selected: mobileFocus === 'product' && view === 'report',
      onSelect: () => chooseMobileView('report'),
      controls: productPanelId,
      href: hrefForView('report'),
    },
    ...(showCanvas && !scanning
      ? [
          {
            id: `${mobileTabsId}-canvas`,
            label: REPORT_COPY.workspace.panels.canvasView,
            selected: mobileFocus === 'product' && view === 'canvas',
            onSelect: () => chooseMobileView('canvas'),
            controls: productPanelId,
            href: hrefForView('canvas'),
          },
        ]
      : []),
  ]

  const productHeader = (
    <div
      className={cn(
        WORKSPACE_PANEL_HEADER_CLASS,
        'min-w-0 max-w-full',
        view === 'report' && 'h-auto flex-wrap py-2',
      )}
    >
      <div className="min-w-0 flex-1">
        {view === 'report' && reportHeader ? (
          <div className="min-w-0 max-w-full">{reportHeader}</div>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {REPORT_COPY.workspace.panels.productReality}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {productAddress}
            </p>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Slot is reserved for the whole scan so the first Flag cannot shift the header. */}
        {scanning && view === 'browser' ? (
          <div className="hidden min-w-[10.5rem] justify-end sm:flex">
            {findingCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => chooseView('report')}
                className="tabular-nums"
              >
                {REPORT_COPY.workspace.panels.inspectFindings(findingCount)}
              </Button>
            ) : null}
          </div>
        ) : null}
        {view === 'browser' ? (
          <WorkspaceDeviceToggle device={device} onDeviceChange={chooseDevice} />
        ) : null}
        <div className="hidden lg:block">{renderToggle()}</div>
      </div>
    </div>
  )

  const productColumn = (
    <div
      id={productPanelId}
      role="tabpanel"
      aria-label={REPORT_COPY.workspace.panels.productReality}
      className={cn(
        'h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-muted/10',
        mobileFocus === 'product' ? 'flex' : 'hidden',
        'lg:flex'
      )}
    >
      {productHeader}
      {view === 'browser' ? (
        <>
          <div className={WORKSPACE_STAGE_CLASS}>
            {previewStage}
            {previewOverlay}
          </div>
          {previewTransport}
        </>
      ) : (
        <div className={cn(WORKSPACE_PANE_SCROLL_CLASS, 'max-w-full overflow-x-auto')}>
          {scrollContent}
        </div>
      )}
    </div>
  )

  return (
    <section
      aria-label={ariaLabel}
      data-workspace-ready={workspaceReady ? 'true' : undefined}
      className={cn(
        REPORT_PLAYBACK_SCROLL_MT,
        'flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-clip',
        className
      )}
    >
      <WorkspaceMobileTabs
        label={REPORT_COPY.workspace.panels.mobileTabsLabel}
        tabs={mobileTabs}
      />

      <div
        className={cn(
          'grid min-h-0 flex-1',
          WORKSPACE_SPLIT_GRID_CLASS
        )}
      >
        {leftColumn}
        {productColumn}
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end border-t border-border/45 px-3 py-3 sm:px-4">
          {footer}
        </div>
      ) : null}
    </section>
  )
}

