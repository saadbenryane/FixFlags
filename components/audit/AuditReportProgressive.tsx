'use client'

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { ReportProgressBand } from '@/components/report/ReportWorkspaceChrome'
import {
  ReportWorkspaceShell,
  REPORT_SECTION_SCROLL_MT,
} from '@/components/report/ReportWorkspaceShell'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { resolveScreenshotPresentation } from '@/lib/audit/screenshot-types'
import { getProgressPercent, getStagePresentation } from '@/lib/audit/progress-ui'
import {
  PIPELINE_PROGRESS_SUBSTEP,
  streamingFlagsVisible,
} from '@/lib/audit/progress'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { displayVerdict } from '@/lib/audit/verdict'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { ProductContract } from '@/lib/audit/product-contract'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { buildReportWorkspaceModel } from '@/lib/report/workspace-model'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { ReportPolishPass } from '@/components/report/ReportPolishPass'
import { ReportFixListHeader } from '@/components/report/ReportFixListHeader'
import { ReportVerdictBlockquote } from '@/components/report/ReportVerdictBlockquote'
import { cn } from '@/lib/utils'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import type { AgentMessage } from '@/lib/audit/agent-message'

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
  verdict?: string | null
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
  /** The signed-in user owns the in-flight scan. Owner-only chat and actions. */
  isOwner?: boolean
  /** Anonymous teaser scan: reduced pipeline (no journey walk). */
  isTeaser?: boolean
  agentMessages?: AgentMessage[]
}

export function AuditReportProgressive({
  status = 'QUEUED',
  url = '',
  pageType = null,
  verdict = null,
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
  isOwner = false,
  isTeaser = false,
  agentMessages = [],
}: AuditReportProgressiveProps) {
  const isFailed = status === 'FAILED'
  const isLoading = status !== 'COMPLETED' && status !== 'FAILED'
  const stage = useMemo(
    () => getStagePresentation(status, progress),
    [status, progress]
  )

  // The reduced teaser pipeline never walks a user journey, so the full
  // pipeline's "Preparing journey review" substep would be a lie. Keep the
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

  const userVerdict = displayVerdict(verdict ?? null)
  const capturePresentation = resolveScreenshotPresentation(
    status,
    screenshots,
    screenshotCapture ?? null
  )

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
      verdict,
      flags: partialFlags,
      screenshots,
      rubrics,
    })
    prevModelRef.current = model
    return model
  }, [url, pageType, score, verdict, partialFlags, screenshots, rubrics])

  const showContract = Boolean(productContract)
  const showTimeline = actionTimeline.length > 0
  const showSticky = !isFailed
  const flagCount = explorerModel.flagCount

  // Live findings stream: deterministic flags become visible as their check
  // modules finish (persisted at CHECKS_DONE), so the progressive report shows
  // real results instead of a blank list while checks are still running.
  const showFindingsStream =
    isLoading && streamingFlagsVisible(status, progress) && partialFlags.length > 0
  const liveFindingsStrip = showFindingsStream ? (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground"
    >
      <span className="font-medium text-foreground">
        Found {partialFlags.length} {partialFlags.length === 1 ? 'issue' : 'issues'} so far
      </span>
      <span aria-hidden="true">·</span>
      <span>Checks are still running. New issues appear as they are confirmed.</span>
    </div>
  ) : null
  const workspace = buildReportWorkspaceModel({
    kind: 'progressive',
    explorer: explorerModel,
    url,
    pageType,
    status: isFailed ? 'failed' : 'checking',
    loading: isLoading,
    checkedScope: 'the submitted page',
    promptAccess: 'none',
  })
  const polishPassPrompt =
    explorerModel.polishPassPrompt ??
    explorerModel.flags.find((flag) => flag.hasFixPrompt)?.copyFixPrompt ??
    null

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

  return (
    <ReportWorkspaceShell
      workspace={workspace}
      hero={
        <AuditReportHero
          url={url}
          pageType={pageType}
          screenshots={screenshots}
          scanning={isLoading}
          scanningLabel={isLoading ? stage.scanningLabel : null}
          capturePresentation={capturePresentation}
        />
      }
      beforeProgress={
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
      }
      progressBand={
        <ReportProgressBand
          model={workspace}
          scanProgress={isLoading ? displayProgress : undefined}
          stageDetail={isLoading ? stageDetail : null}
        />
      }
      stickyNav={
        showSticky || userVerdict ? (
          <div className="space-y-4">
            {userVerdict ? (
              <ReportVerdictBlockquote verdict={userVerdict} />
            ) : null}
            {showSticky ? (
              <ReportStickyToolbar
                showPolish={flagCount > 0}
                showContract={showContract}
                showTimeline={showTimeline}
                showStack
                showRecheckSection={false}
                siteUrl={url || undefined}
                auditId={auditId}
              />
            ) : null}
          </div>
        ) : null
      }
      polishPass={
        <ReportPolishPass
          flagCount={flagCount}
          prompt={polishPassPrompt}
          loading={isLoading && flagCount === 0}
          className={REPORT_SECTION_SCROLL_MT}
        />
      }
      flagsSection={
        auditId ? (
          <Suspense fallback={null}>
            <ReportWorkspaceSplitShell
              isActiveReview
              showChatColumn
              canUseTimeline={isOwner}
              leftPanel={
                <WorkspaceChatPanel
                  auditId={auditId}
                  canChat={isOwner}
                  agentMessages={agentMessages}
                  reportUrl={url}
                />
              }
              browserUrl={url}
              browserScreenshots={screenshots}
              browserCaptureStatus={screenshotCapture}
              reportPanel={
                <section
                  id={sectionId}
                  className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}
                  aria-busy={isLoading}
                >
                  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {isLoading ? `${stage.statusLine}. ${stageDetail}` : REPORT_COPY.sectionTitles.allFixes}
                  </p>
                  {liveFindingsStrip}
                  <ReportFixListHeader count={flagCount} />
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
              steps={buildPlaybackSteps(actionTimeline)}
            />
          </Suspense>
        ) : (
        <section
          id={sectionId}
          className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}
          aria-busy={isLoading}
        >
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {isLoading ? `${stage.statusLine}. ${stageDetail}` : REPORT_COPY.sectionTitles.allFixes}
          </p>
          {liveFindingsStrip}
          <ReportFixListHeader count={flagCount} />
          <ExplorerErrorBoundary
            fallback={
              <div className="space-y-3 py-4">
                <Skeleton shimmer className="h-4 w-3/4" />
                <Skeleton shimmer className="h-4 w-1/2" />
                <Skeleton shimmer className="h-4 w-2/3" />
              </div>
            }
          >
            <LiveReportExplorer
              model={explorerModel}
              loading={isLoading}
            />
          </ExplorerErrorBoundary>
        </section>
        )
      }
      contextSections={
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

          {showContract ? (
            <details
              className={cn(REPORT_SECTION_SCROLL_MT, 'rounded-card bg-card/40 p-5 shadow-card glass-surface')}
              open={!isLoading}
            >
              <summary className="min-h-11 cursor-pointer font-medium">
                {REPORT_COPY.sectionTitles.timelineProgressive}
              </summary>
              <div className="mt-4 space-y-4">
                {productContract ? (
                  <div id="report-contract">
                    <ProductContractCard contract={productContract} canEdit={false} />
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </>
      }
    />
  )
}
