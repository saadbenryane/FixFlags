'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'
import type { WorkspacePanelView } from '@/components/report/WorkspaceViewTabs'
import type { PreviewDevice } from '@/components/report/WorkspaceBrowserPanel'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import { WorkspaceViewTabs } from '@/components/report/WorkspaceViewTabs'
import { WorkspaceBrowserPanel, type PreviewDevice as BrowserPreviewDevice } from '@/components/report/WorkspaceBrowserPanel'
import { WorkspaceDeviceToggle } from '@/components/report/WorkspaceDeviceToggle'
import { WorkspacePreviewTransport } from '@/components/report/WorkspacePreviewTransport'
import { PreviewEvidenceProvider } from '@/components/report/preview-evidence-context'
import { WORKSPACE_PANE_SCROLL_CLASS, WORKSPACE_SPLIT_GRID_CLASS } from '@/components/report/workspace-geometry'
import { cn } from '@/lib/utils'

type MobileFocus = 'chat' | 'product'

interface ReportWorkspaceSplitShellProps {
  ariaLabel?: string
  isActiveReview?: boolean
  scanning?: boolean
  leftPanel: ReactNode
  browserUrl: string
  browserScreenshots?: AuditScreenshot[]
  browserCaptureStatus?: ScreenshotCaptureStatus | null
  reportHeader?: ReactNode
  reportPanel: ReactNode
  findingCount?: number
  steps?: PlaybackStep[]
  controlledView?: WorkspacePanelView
  onViewChange?: (view: WorkspacePanelView) => void
  controlledDevice?: PreviewDevice
  onDeviceChange?: (device: PreviewDevice) => void
  activeStepIndex?: number | null
  onSelectStep?: (index: number) => void
  onScrub?: (index: number) => void
  onBackToLive?: () => void
  syncViewToUrl?: boolean
  initialMobileFocus?: MobileFocus
  previewOverlay?: ReactNode
  footer?: ReactNode
  capabilities: ReportWorkspaceCapabilities
  timelineGateActionHref?: string
  canvasPanel?: ReactNode
  className?: string
}

export const REPORT_PLAYBACK_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'

/** Agent plus the report's Report, Timeline, and Canvas evidence surfaces. */
export function ReportWorkspaceSplitShell(props: ReportWorkspaceSplitShellProps) {
  return <PreviewEvidenceProvider><ReportWorkspaceSplitShellInner {...props} /></PreviewEvidenceProvider>
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
  steps = [],
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
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const shellId = useId().replace(/:/g, '')
  const agentPanelId = `${shellId}-agent-panel`
  const reportPanelId = `${shellId}-product-panel`
  const tabsId = `${shellId}-tab`
  const requestedView = searchParams?.get('view')
  const canPreview = scanning || capabilities.canReplayTimeline
  const canCanvas = !scanning && capabilities.canUseCanvas
  const viewFromRequest = requestedView === 'timeline' && canPreview
    ? 'browser'
    : requestedView === 'canvas' && canCanvas
      ? 'canvas'
      : 'report'
  const [internalView, setInternalView] = useState<WorkspacePanelView>(viewFromRequest)
  const view = controlledView ?? internalView
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>(initialMobileFocus ?? (scanning ? 'chat' : 'product'))
  const [internalDevice, setInternalDevice] = useState<BrowserPreviewDevice>('desktop')
  const device = controlledDevice ?? internalDevice
  const [internalActiveStep, setInternalActiveStep] = useState<number | null>(null)
  const activeStepIndex = controlledActiveStepIndex ?? internalActiveStep
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`fixflags:workspace-panel:${pathname}`)
    if (saved === 'chat' || saved === 'product') setMobileFocus(saved)
  }, [pathname])

  useEffect(() => {
    if (controlledView === undefined) setInternalView(viewFromRequest)
  }, [controlledView, viewFromRequest])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  function chooseMobileFocus(next: MobileFocus) {
    setMobileFocus(next)
    window.sessionStorage.setItem(`fixflags:workspace-panel:${pathname}`, next)
  }

  const hrefForView = useCallback((next: WorkspacePanelView) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('view', next === 'browser' ? 'timeline' : next)
    const query = params.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  function chooseView(next: WorkspacePanelView) {
    if (controlledView === undefined) setInternalView(next)
    onViewChange?.(next)
    chooseMobileFocus('product')
    if (!syncViewToUrl) return
    window.history.pushState(window.history.state, '', hrefForView(next))
  }

  function chooseDevice(next: BrowserPreviewDevice) {
    if (controlledDevice === undefined) setInternalDevice(next)
    onDeviceChange?.(next)
  }

  const tabs = [
    { id: `${tabsId}-agent`, label: 'Agent', selected: mobileFocus === 'chat', onSelect: () => chooseMobileFocus('chat'), controls: agentPanelId },
    ...(canPreview ? [{ id: `${tabsId}-preview`, label: scanning ? 'Preview' : 'Timeline', selected: mobileFocus === 'product' && view === 'browser', onSelect: () => chooseView('browser'), controls: reportPanelId, href: hrefForView('browser') }] : []),
    { id: `${tabsId}-report`, label: 'Report', selected: mobileFocus === 'product' && view === 'report', onSelect: () => chooseView('report'), controls: reportPanelId, href: hrefForView('report') },
    ...(canCanvas ? [{ id: `${tabsId}-canvas`, label: 'Canvas', selected: mobileFocus === 'product' && view === 'canvas', onSelect: () => chooseView('canvas'), controls: reportPanelId, href: hrefForView('canvas') }] : []),
  ]

  const activeStep = activeStepIndex == null ? null : (steps[activeStepIndex] ?? null)
  const selectStep = (index: number) => {
    if (onSelectStep) onSelectStep(index)
    else setInternalActiveStep((current) => current === index ? null : index)
  }
  const scrubStep = (index: number) => {
    if (onScrub) onScrub(index)
    else setInternalActiveStep(index)
  }

  return (
    <section aria-label={ariaLabel} data-workspace-ready={ready ? 'true' : undefined} className={cn(REPORT_PLAYBACK_SCROLL_MT, 'flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-clip', className)}>
      <WorkspaceMobileTabs label="Review workspace" tabs={tabs} />
      <div className={cn('grid min-h-0 flex-1', WORKSPACE_SPLIT_GRID_CLASS)}>
        <div id={agentPanelId} role="tabpanel" aria-labelledby={`${tabsId}-agent`} className={cn('h-full min-h-0 min-w-0', mobileFocus === 'chat' ? 'block' : 'hidden', 'lg:block')}>
          {leftPanel}
        </div>
        <div id={reportPanelId} role="tabpanel" aria-label="Product review evidence" className={cn('h-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/10', mobileFocus === 'product' ? 'flex' : 'hidden', 'lg:flex')}>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/45 px-4 py-2 sm:px-5">
            <div className="min-w-0 flex-1">{view === 'report' ? reportHeader : <p className="truncate text-sm font-semibold">{browserUrl}</p>}</div>
            {view === 'browser' ? <WorkspaceDeviceToggle device={device} onDeviceChange={chooseDevice} /> : null}
            <div className="hidden lg:block">
              <WorkspaceViewTabs view={view} onChange={chooseView} hrefForView={hrefForView} capabilities={capabilities} panelId={reportPanelId} idPrefix={`${tabsId}-view`} scanning={scanning} hideBrowserView={!canPreview} />
            </div>
          </div>
          {view === 'browser' ? (
            <>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <WorkspaceBrowserPanel url={browserUrl} screenshots={browserScreenshots} captureStatus={browserCaptureStatus} activeStep={!scanning ? activeStep : null} device={device} className="h-full" />
                {previewOverlay}
              </div>
              <WorkspacePreviewTransport steps={steps} activeIndex={activeStepIndex} onSelectStep={selectStep} onScrub={scrubStep} onBackToLive={() => { if (onBackToLive) onBackToLive(); else setInternalActiveStep(null) }} canReplay={!scanning && capabilities.canReplayTimeline} gateActionHref={capabilities.canReplayTimeline ? undefined : timelineGateActionHref} scanning={scanning} />
            </>
          ) : (
            <div className={cn(WORKSPACE_PANE_SCROLL_CLASS, 'max-w-full overflow-x-auto')}>
              {view === 'canvas' ? canvasPanel : reportPanel}
            </div>
          )}
        </div>
      </div>
      {footer ? <div className="flex shrink-0 items-center justify-end border-t border-border/45 px-3 py-3 sm:px-4">{footer}</div> : null}
    </section>
  )
}
