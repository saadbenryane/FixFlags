'use client'

import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { Card } from '@/components/ui/card'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { ReportProgressBand } from '@/components/report/ReportWorkspaceChrome'
import {
  ReportWorkspaceShell,
  REPORT_SECTION_SCROLL_MT,
} from '@/components/report/ReportWorkspaceShell'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { resolveScreenshotPresentation } from '@/lib/audit/screenshot-types'
import { getProgressPercent, getStagePresentation } from '@/lib/audit/progress-ui'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { displayVerdict } from '@/lib/audit/verdict'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { ProductContract } from '@/lib/audit/product-contract'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { buildReportWorkspaceModel } from '@/lib/report/workspace-model'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { buildPlaybackSteps } from '@/components/report/WorkspacePlaybackStrip'
import { WorkspaceBrowserPanel } from '@/components/report/WorkspaceBrowserPanel'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { displayHostname } from '@/lib/utils/url-helpers'
import { ReportPolishPass } from '@/components/report/ReportPolishPass'
import { cn } from '@/lib/utils'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'

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
}: AuditReportProgressiveProps) {
  const isFailed = status === 'FAILED'
  const isLoading = status !== 'COMPLETED' && status !== 'FAILED'
  const stage = useMemo(
    () => getStagePresentation(status, progress),
    [status, progress]
  )

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
          stageDetail={isLoading ? stage.detail : null}
        />
      }
      stickyNav={
        showSticky || userVerdict ? (
          <div className="space-y-4">
            {userVerdict ? (
              <blockquote className="border-l-2 border-brand pl-4 font-sans text-sm font-medium leading-relaxed text-foreground text-pretty sm:text-base">
                {userVerdict}
              </blockquote>
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
          <ReportWorkspaceSplitShell
            isActiveReview
            leftPanel={<WorkspaceChatPanel auditId={auditId} />}
            activityEvents={actionTimeline}
            browserPanel={
              <WorkspaceBrowserPanel url={url} screenshots={screenshots} />
            }
            reportPanel={
              <section
                id={sectionId}
                className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}
                aria-busy={isLoading}
              >
                <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  {isLoading ? `${stage.statusLine}. ${stage.detail}` : REPORT_COPY.sectionTitles.allFixes}
                </p>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionTitle>{REPORT_COPY.sectionTitles.allFixes}</SectionTitle>
                  {flagCount > 0 ? (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
                    </span>
                  ) : null}
                </div>
                <ExplorerErrorBoundary
                  fallback={
                    <div className="space-y-3 py-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  }
                >
                  <LiveReportExplorer model={explorerModel} loading={isLoading} />
                </ExplorerErrorBoundary>
              </section>
            }
            steps={buildPlaybackSteps(actionTimeline)}
          />
        ) : (
        <section
          id={sectionId}
          className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}
          aria-busy={isLoading}
        >
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {isLoading ? `${stage.statusLine}. ${stage.detail}` : REPORT_COPY.sectionTitles.allFixes}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>{REPORT_COPY.sectionTitles.allFixes}</SectionTitle>
            {flagCount > 0 ? (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
              </span>
            ) : null}
          </div>
          <ExplorerErrorBoundary
            fallback={
              <div className="space-y-3 py-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
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
          <ProgressiveCapturePair
            url={url}
            screenshots={screenshots}
            captureStatus={screenshotCapture}
            className="hidden lg:block"
          />

          {isLoading && (!technologyProfile || technologyProfile.status === 'not_captured') ? (
            <Card className="space-y-3 p-5" aria-label="Reading technology signals" id="report-stack">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </Card>
          ) : technologyProfile ? (
            <div id="report-stack" className={REPORT_SECTION_SCROLL_MT}>
              <MadeWithProfile profile={technologyProfile} compact />
            </div>
          ) : null}

          {(showContract || showTimeline) ? (
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
                {showTimeline ? (
                  <div id="report-journey">
                    <ActionTimeline events={actionTimeline} />
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

/** Neutral route shell used before the server has returned an actual audit state. */
export function AuditReportProgressiveShell({
  url = '',
}: {
  url?: string
} = {}) {
  const workspace = buildReportWorkspaceModel({
    kind: 'progressive',
    explorer: buildPartialExplorerModel({
      url,
      pageType: null,
      score: null,
      verdict: null,
      flags: [],
      screenshots: [],
      rubrics: [],
    }),
    url,
    pageType: null,
    status: 'checking',
    loading: true,
    checkedScope: 'the submitted page',
    promptAccess: 'none',
  })

  return (
    <ReportWorkspaceShell
      workspace={workspace}
      hero={
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="section-label">Finish Plan</p>
          <h1 className="text-2xl font-semibold text-foreground text-balance">
            {url ? displayHostname(url) : REPORT_COPY.reportFirst.loadingTitle}
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {REPORT_COPY.reportFirst.preparingReport}
          </p>
        </div>
      }
      progressBand={
        <ReportProgressBand model={workspace} scanProgress={5} stageDetail={REPORT_COPY.reportFirst.checkingLabel} />
      }
      polishPass={<ReportPolishPass flagCount={0} prompt={null} loading />}
      flagsSection={
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      }
      contextSections={
        <ProgressiveCapturePair url={url} screenshots={[]} className="hidden lg:block" />
      }
    />
  )
}

function ProgressiveCapturePair({
  url,
  screenshots,
  captureStatus,
  className,
}: {
  url: string
  screenshots: AuditScreenshot[]
  captureStatus?: ScreenshotCaptureStatus
  className?: string
}) {
  const hostname = url ? displayHostname(url) : undefined
  const desktop = screenshots.find((shot) => shot.device === 'DESKTOP')?.url ?? null
  const mobile = screenshots.find((shot) => shot.device === 'MOBILE')?.url ?? null
  const desktopState = desktop
    ? 'loaded'
    : captureStatus?.desktop === 'failed'
      ? 'failed'
      : 'loading'
  const mobileState = mobile
    ? 'loaded'
    : captureStatus?.mobile === 'failed'
      ? 'failed'
      : 'loading'

  return (
    <section
      className={cn(
        'rounded-card bg-card/55 p-3 shadow-card glass-surface sm:p-4',
        className
      )}
      aria-label={REPORT_COPY.reportFirst.capturesLabel}
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-medium text-foreground">
            {REPORT_COPY.reportFirst.capturesTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {REPORT_COPY.reportFirst.capturesBody}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(6.5rem,10rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,13rem)] sm:gap-4">
        <BrowserFrame
          device="desktop"
          url={hostname}
          imageUrl={desktop}
          state={desktopState}
          alt={`Desktop screenshot of ${hostname ?? 'site'}`}
        />
        <BrowserFrame
          device="mobile"
          url={hostname}
          imageUrl={mobile}
          state={mobileState}
          alt={`Mobile screenshot of ${hostname ?? 'site'}`}
        />
      </div>
    </section>
  )
}
