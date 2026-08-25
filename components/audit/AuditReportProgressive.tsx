'use client'

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { ReportContextDisclosure } from '@/components/report/ReportContextDisclosure'
import {
  REPORT_SECTION_SCROLL_MT,
} from '@/components/report/workspace-geometry'
import { ReportPane } from '@/components/report/ReportPane'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { getProgressPercent, getStagePresentation } from '@/lib/audit/progress-ui'
import {
  PIPELINE_PROGRESS_SUBSTEP,
  streamingFlagsVisible,
} from '@/lib/audit/progress'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import type { ProductContract } from '@/lib/audit/product-contract'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { buildReportWorkspaceModel } from '@/lib/report/workspace-model'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { ReportCanvasPanel } from '@/components/report/ReportCanvasPanel'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { cn } from '@/lib/utils'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { AuditAccessContext } from '@/lib/audit/access'

/** Catches crashes in the explorer subtree so the scanning UI stays visible. */
class ExplorerErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(JSON.stringify({ level: 'error', event: 'ui.explorer.error', digest: (error as Error & { digest?: string }).digest, component: info.componentStack?.split('\n')[1]?.trim() }))
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

interface AuditReportProgressiveProps {
  status?: string
  url?: string
  pageType?: string | null
  score?: number | null
  progress?: number
  rubrics?: Array<{ name: string; grade: string | null; score: number | null; status?: string | null }>
  partialFlags?: Array<{
    id: string
    severity: string
    problem: string
    rubric: string
    checkId?: string | null
    source?: string | null
  }>
  screenshots?: AuditScreenshot[]
  screenshotCapture?: ScreenshotCaptureStatus
  workerIdle?: boolean
  actionTimeline?: ActionTimelineEvent[]
  productContract?: ProductContract | null
  technologyProfile?: TechnologyProfile
  sectionId?: string
  auditId?: string
  /** Exact server access decision. Missing envelopes fail closed. */
  accessContext?: Exclude<AuditAccessContext, 'denied'> | null
  /** Anonymous teaser scan: reduced pipeline (no journey walk). */
  isTeaser?: boolean
  agentMessages?: AgentMessage[]
}

export function AuditReportProgressive({
  status = 'QUEUED',
  url = '',
  pageType = null,
  score = null,
  progress = 0,
  rubrics = [],
  partialFlags = [],
  screenshots = [],
  screenshotCapture,
  workerIdle = false,
  actionTimeline = [],
  productContract = null,
  technologyProfile,
  sectionId = 'report-flags',
  auditId,
  accessContext = null,
  isTeaser = false,
  agentMessages = [],
}: AuditReportProgressiveProps) {
  const isOwnerAccess = accessContext === 'owner'
  const canClaimAccess = accessContext === 'anonymous_teaser'
  const chatGateReason = canClaimAccess ? 'sign-in' : 'owner'
  const isFailed = status === 'FAILED'
  const isLoading = status !== 'COMPLETED' && status !== 'FAILED'
  const stage = useMemo(
    () => getStagePresentation(status, progress),
    [status, progress]
  )

  // The reduced teaser pipeline never walks a Funnel path, so the full
  // pipeline's "Preparing Funnel review" substep would be a lie. Keep the
  // stage narrative honest when checks finish on a teaser scan.
  const stageDetail =
    isTeaser &&
    status === 'CHECKING' &&
    progress >= PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE &&
    progress < PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START
      ? 'Checks finished. Starting AI review…'
      : stage.detail

  const targetProgress = getProgressPercent(progress, status)
  const [displayProgress, setDisplayProgress] = useState(targetProgress)
  const [easeTick, setEaseTick] = useState(0)

  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && status === 'QUEUED' && easeTick >= 12

  const [queueWaitSeconds, setQueueWaitSeconds] = useState<number | undefined>()

  useEffect(() => {
    if (status !== 'QUEUED') {
      setQueueWaitSeconds(undefined)
      return
    }
    setQueueWaitSeconds(getActiveAudit()?.queue?.estimatedWaitSeconds ?? undefined)
  }, [status])

  const showQueueWait =
    status === 'QUEUED' &&
    typeof queueWaitSeconds === 'number' &&
    queueWaitSeconds > 5 &&
    !workerIdle &&
    !showWorkerWarning

  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => setEaseTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [isLoading])

  useEffect(() => {
    setDisplayProgress((prev) => {
      if (targetProgress <= prev) return targetProgress >= 100 ? 100 : prev
      const next = prev + Math.max(1, (targetProgress - prev) * 0.4)
      return Math.min(targetProgress, Math.round(next))
    })
  }, [easeTick, targetProgress])

  useEffect(() => {
    if (status === 'COMPLETED') setDisplayProgress(100)
  }, [status])

  const prevFlagsRef = useRef(partialFlags)
  const prevScreenshotsRef = useRef(screenshots)
  const prevRubricsRef = useRef(rubrics)
  const prevModelRef = useRef<ReturnType<typeof buildPartialExplorerModel> | null>(null)

  const explorerModel = useMemo(() => {
    if (
      prevModelRef.current &&
      partialFlags === prevFlagsRef.current &&
      screenshots === prevScreenshotsRef.current &&
      rubrics === prevRubricsRef.current
    ) {
      return prevModelRef.current
    }
    prevFlagsRef.current = partialFlags
    prevScreenshotsRef.current = screenshots
    prevRubricsRef.current = rubrics
    const model = buildPartialExplorerModel({
      url,
      pageType,
      score,
      flags: partialFlags,
      screenshots,
      rubrics,
    })
    prevModelRef.current = model
    return model
  }, [url, pageType, score, partialFlags, screenshots, rubrics])

  const showContract = Boolean(productContract)
  const flagCount = explorerModel.flagCount

  // Live findings stream: deterministic flags become visible as their check
  // modules finish (persisted at CHECKS_DONE), so the progressive report shows
  // real results instead of a blank list while checks are still running.
  // Held from the moment findings can stream, so the first Flag never shifts the fix list.
  const showFindingsStream = isLoading && streamingFlagsVisible(status, progress)
  const liveFindingsStrip = showFindingsStream ? (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border/50 bg-muted/15 px-4 py-3 text-sm text-muted-foreground"
    >
      <span className="font-medium tabular-nums text-foreground">
        {partialFlags.length > 0
          ? `Found ${partialFlags.length} ${partialFlags.length === 1 ? 'Flag' : 'Flags'} so far`
          : 'No Flags confirmed yet'}
      </span>
      <span aria-hidden="true">·</span>
      <span>Checks are still running. New Flags appear as they are confirmed.</span>
    </div>
  ) : null
  const workspace = buildReportWorkspaceModel({
    kind: 'progressive',
    explorer: explorerModel,
    auditId,
    url,
    pageType,
    status: isFailed ? 'failed' : isLoading ? 'checking' : 'completed',
    loading: isLoading,
    capabilities: {
      promptAccess: 'none',
      canReplayTimeline: isOwnerAccess,
      canChat: isOwnerAccess && Boolean(auditId),
      canUseCanvas: isOwnerAccess && Boolean(auditId) && !isLoading,
      canShare: false,
      canExport: false,
      canRecheck: false,
      canGiveFeedback: false,
      demonstratedFlagId: null,
    },
  })
  const playbackSteps = buildPlaybackSteps(actionTimeline)
  const queuedWarnings =
    (workerIdle || showWorkerWarning || showQueueWait) ? (
      <div className="space-y-3">
        {(workerIdle || showWorkerWarning) && (
          <Callout variant="warning" title="Still preparing">
            {getWorkerQueuedWarning(workerIdle || showWorkerWarning)}
          </Callout>
        )}
        {showQueueWait && queueWaitSeconds != null ? (
          <Callout variant="info" title="Queued">
            {formatQueueWaitHint(queueWaitSeconds)}
          </Callout>
        ) : null}
      </div>
    ) : null

  const progressStatusLine = `${stage.statusLine}. ${stageDetail}`

  /**
   * A running Review has no final score yet. The compact header stays mounted
   * with honest progress while the pane gives its height to streaming Flags.
   */
  const scanReportPanel = (
    <ReportPane
        beforeExplorer={
          <>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {isLoading ? progressStatusLine : REPORT_COPY.sectionTitles.allFixes}
            </p>
            {liveFindingsStrip}
          </>
        }
        explorer={
          <section
            id={sectionId}
            className={cn(REPORT_SECTION_SCROLL_MT, 'flex min-h-0 flex-1 flex-col')}
            aria-busy={isLoading}
          >
            <ExplorerErrorBoundary
              fallback={
                <div className="space-y-3 py-4">
                  <Skeleton shimmer className="h-4 w-3/4" />
                  <Skeleton shimmer className="h-4 w-1/2" />
                  <Skeleton shimmer className="h-4 w-2/3" />
                </div>
              }
            >
              <LiveReportExplorer model={explorerModel} loading={isLoading} />
            </ExplorerErrorBoundary>
          </section>
        }
      />
  )

  const scanWorkspace = auditId ? (
    <Suspense fallback={null}>
      <ReportWorkspaceSplitShell
        isActiveReview
        scanning
        capabilities={workspace.capabilities}
        reportHeader={
          <ReportOutcomeBar
            model={workspace}
            scanProgress={displayProgress}
            stageDetail={stageDetail}
          />
        }
        leftPanel={
          <WorkspaceChatPanel
            auditId={auditId}
            capabilities={workspace.capabilities}
            gateReason={chatGateReason}
            agentMessages={agentMessages}
            reportUrl={url}
            scanning
            className="h-full"
          />
        }
        browserUrl={url}
        browserScreenshots={screenshots}
        browserCaptureStatus={screenshotCapture}
        reportPanel={scanReportPanel}
        findingCount={flagCount}
        steps={playbackSteps}
        className="h-full"
      />
    </Suspense>
  ) : (
    scanReportPanel
  )

  const contextSections = (
    <>
      {isLoading && (!technologyProfile || technologyProfile.status === 'not_captured') ? (
        <Card className="space-y-3 p-5" aria-label="Reading technology signals" id="report-stack">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton shimmer className="h-3 w-28" />
              <Skeleton shimmer className="h-5 w-24" />
            </div>
            <Skeleton shimmer className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton shimmer className="h-8 w-24 rounded-full" />
            <Skeleton shimmer className="h-8 w-20 rounded-full" />
            <Skeleton shimmer className="h-8 w-28 rounded-full" />
          </div>
        </Card>
      ) : technologyProfile ? (
        <div id="report-stack" className={REPORT_SECTION_SCROLL_MT}>
          <MadeWithProfile profile={technologyProfile} compact />
        </div>
      ) : null}

      {showContract && productContract ? (
        <div id="report-contract" className={REPORT_SECTION_SCROLL_MT}>
          <ProductContractCard contract={productContract} canEdit={false} />
        </div>
      ) : null}
    </>
  )

  const progressAuditId = auditId ?? getActiveAudit()?.auditId ?? 'progressive'
  useOneShotEvent(
    'report_progress_viewed',
    progressAuditId,
    () => {
      if (!isLoading) return null
      return {
        progress_percent: displayProgress,
        status,
        surface: 'focused' as const,
      }
    },
    [isLoading, displayProgress, status],
  )

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col motion-safe:animate-soft-reveal">
        {queuedWarnings ? (
          <div className="shrink-0 space-y-3 border-b border-border/40 px-4 py-3">
            {queuedWarnings}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">{scanWorkspace}</div>
      </div>
    )
  }

  if (auditId) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col motion-safe:animate-soft-reveal">
        {queuedWarnings ? (
          <div className="shrink-0 space-y-3 border-b border-border/40 px-4 py-3">
            {queuedWarnings}
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <Suspense fallback={null}>
            <ReportWorkspaceSplitShell
              isActiveReview
              capabilities={workspace.capabilities}
              reportHeader={<ReportOutcomeBar model={workspace} />}
              leftPanel={
                <WorkspaceChatPanel
                  auditId={auditId}
                  capabilities={workspace.capabilities}
                  gateReason={chatGateReason}
                  agentMessages={agentMessages}
                  reportUrl={url}
                />
              }
              browserUrl={url}
              browserScreenshots={screenshots}
              browserCaptureStatus={screenshotCapture}
              timelineGateActionHref={canClaimAccess ? `/sign-in?next=${encodeURIComponent(`/report/${auditId}`)}` : undefined}
              canvasPanel={workspace.capabilities.canUseCanvas ? <ReportCanvasPanel auditId={auditId} /> : undefined}
              reportPanel={
                <>
                  <ReportPane
                    explorer={
                      <section
                        id={sectionId}
                        className={cn(REPORT_SECTION_SCROLL_MT, 'flex min-h-0 flex-1 flex-col')}
                      >
                        <ExplorerErrorBoundary
                          fallback={
                            <div className="space-y-3 py-4">
                              <Skeleton shimmer className="h-4 w-3/4" />
                              <Skeleton shimmer className="h-4 w-1/2" />
                            </div>
                          }
                        >
                          <LiveReportExplorer model={explorerModel} loading={false} />
                        </ExplorerErrorBoundary>
                      </section>
                    }
                    afterFrame={
                      <>
                        <ReportContextDisclosure
                          sectionIds={['report-stack', 'report-contract']}
                          className="mt-3"
                        >
                          {contextSections}
                        </ReportContextDisclosure>
                      </>
                    }
                  />
                </>
              }
              steps={playbackSteps}
              className="h-full"
            />
          </Suspense>
        </div>
      </div>
    )
  }

  // A completed (or failed) hold frame only exists inside the immersive split
  // shell, which needs an auditId for owner chat, timeline, and canvas. The
  // audit page always renders progressive with an auditId, so a missing one is
  // a programming error rather than a document-layout fallback to silently
  // degrade into.
  throw new Error(
    'AuditReportProgressive requires an auditId to render a completed report',
  )
}
