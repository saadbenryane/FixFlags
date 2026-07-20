'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { RubricBar } from '@/components/audit/RubricBar'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricComputed } from '@/lib/audit/rubric'
import { displayHostname } from '@/lib/utils/url-helpers'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  getActivityMessage,
  getProgressPercent,
  getScanningLabel,
} from '@/lib/audit/progress-ui'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { displayVerdict } from '@/lib/audit/verdict'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { ProductContract } from '@/lib/audit/product-contract'

const LiveReportExplorer = dynamic(() =>
  import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer)
)

interface AuditReportProgressiveProps {
  status?: string
  url?: string
  pageType?: string | null
  verdict?: string | null
  score?: number | null
  progress?: number
  flagCount?: number
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
}

function buildPartialRubricsComputed(
  rubrics: AuditReportProgressiveProps['rubrics'],
  partialFlags: NonNullable<AuditReportProgressiveProps['partialFlags']>
): RubricComputed[] {
  return RUBRIC_ORDER.map((name) => {
    const row = rubrics?.find((r) => r.name === name)
    const flagsForRubric = partialFlags.filter((f) => f.rubric === name)
    const criticalCount = flagsForRubric.filter((f) => f.severity === 'CRITICAL').length
    const importantCount = flagsForRubric.filter((f) => f.severity === 'IMPORTANT').length
    return {
      name,
      status: computeRubricStatus({
        name,
        grade: row?.grade ?? null,
        score: row?.score ?? null,
        flags: flagsForRubric.map((f) => ({ severity: f.severity })),
      }),
      flagCount: flagsForRubric.length,
      criticalCount,
      importantCount,
    }
  })
}

export function AuditReportProgressive({
  status = 'QUEUED',
  url = '',
  pageType = null,
  verdict = null,
  score = null,
  progress = 0,
  flagCount = 0,
  rubrics = [],
  partialFlags = [],
  screenshots = [],
  screenshotCapture,
  workerIdle = false,
  actionTimeline = [],
  productContract = null,
}: AuditReportProgressiveProps) {
  const [tick, setTick] = useState(0)
  const isLoading = status !== 'COMPLETED' && status !== 'FAILED'

  const targetProgress = getProgressPercent(progress, status)
  const [displayProgress, setDisplayProgress] = useState(targetProgress)

  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && status === 'QUEUED' && tick >= 12

  const [queueWaitSeconds, setQueueWaitSeconds] = useState<number | undefined>()

  useEffect(() => {
    if (status !== 'QUEUED') {
      setQueueWaitSeconds(undefined)
      return
    }
    setQueueWaitSeconds(getActiveAudit()?.estimatedWaitSeconds)
  }, [status])

  const showQueueWait =
    status === 'QUEUED' &&
    typeof queueWaitSeconds === 'number' &&
    queueWaitSeconds > 5 &&
    !workerIdle &&
    !showWorkerWarning

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setDisplayProgress((prev) => {
      if (targetProgress <= prev) return prev
      const next = prev + Math.max(1, (targetProgress - prev) * 0.4)
      return Math.min(targetProgress, Math.round(next))
    })
  }, [tick, targetProgress])

  const rubricsComputed = useMemo(
    () => buildPartialRubricsComputed(rubrics, partialFlags),
    [rubrics, partialFlags]
  )

  const explorerModel = useMemo(() => {
    if (!url || partialFlags.length === 0) return null
    return buildPartialExplorerModel({
      url,
      pageType,
      score,
      verdict,
      flags: partialFlags,
      screenshots,
      rubrics,
    })
  }, [url, pageType, score, verdict, partialFlags, screenshots, rubrics])

  const rubricRowsForBar = RUBRIC_ORDER.map((name) => {
    const row = rubrics.find((r) => r.name === name)
    return { name, score: row?.score ?? null, grade: row?.grade ?? null }
  })

  const hostname = url ? displayHostname(url) : undefined
  const userVerdict = displayVerdict(verdict ?? null)
  const scanningLabel = isLoading ? getScanningLabel(status, tick) : null
  const activityMessage = isLoading ? getActivityMessage(status, tick) : null

  const desktopScreenshotUrl = screenshots.find((s) => s.device === 'DESKTOP')?.url ?? null
  const mobileScreenshotUrl = screenshots.find((s) => s.device === 'MOBILE')?.url ?? null
  const mobilePending = screenshotCapture?.mobile === 'pending' && !mobileScreenshotUrl
  const showMobileFrame = Boolean(mobileScreenshotUrl || mobilePending)

  const showContract = Boolean(productContract)
  const showTimeline = actionTimeline.length > 0

  return (
    <Container variant="report" className="space-y-6 py-6 sm:space-y-8 sm:py-8">
      <AuditReportHero
        url={url}
        pageType={pageType}
        score={score}
        screenshots={screenshots}
        scanning={isLoading}
        scanningLabel={scanningLabel}
      />

      <RubricBar rubrics={rubricsComputed} rubricRows={rubricRowsForBar} loading={isLoading} />

      <ReportStickyToolbar
        showContract={showContract}
        showTimeline={showTimeline}
        showRecheckSection={false}
        siteUrl={url || undefined}
        score={score}
      />

      {userVerdict ? (
        <blockquote className="border-l-2 border-brand pl-4 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:text-lg">
          {userVerdict}
        </blockquote>
      ) : null}

      {(workerIdle || showWorkerWarning) && (
        <Callout variant="warning" title="Still preparing">
          {getWorkerQueuedWarning(workerIdle || showWorkerWarning)}
        </Callout>
      )}

      {showQueueWait && queueWaitSeconds != null && (
        <Callout variant="info" title="Queued">
          {formatQueueWaitHint(queueWaitSeconds)}
        </Callout>
      )}

      {productContract ? (
        <div id="report-contract" className="scroll-mt-[var(--header-offset)]">
          <ProductContractCard contract={productContract} canEdit={false} />
        </div>
      ) : null}

      {showTimeline ? (
        <section
          id="report-timeline"
          className="scroll-mt-[var(--header-offset)] rounded-card bg-card/40 px-5 py-4 shadow-card glass-surface"
        >
          <SectionTitle className="text-base">{REPORT_COPY.sectionTitles.timelineProgressive}</SectionTitle>
          <ActionTimeline events={actionTimeline} className="mt-3" />
        </section>
      ) : null}

      <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
        {explorerModel ? (
          <LiveReportExplorer
            model={explorerModel}
            loading={isLoading}
            progress={displayProgress}
          />
        ) : (
          <div className="overflow-hidden rounded-card glass-surface shadow-card">
            <div className="space-y-6 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-3">
                <ScoreRingGauge
                  score={score}
                  size="sm"
                  loading={isLoading && score == null}
                  progress={displayProgress}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {activityMessage ?? 'Scanning your site…'}
                  </p>
                  {flagCount > 0 ? (
                    <p className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {flagCount} flag{flagCount === 1 ? '' : 's'} so far
                    </p>
                  ) : (
                    <p className="text-2xs text-muted-foreground">
                      Captures and Flags appear here as the review runs
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-4 space-y-1">
                  <Skeleton className="h-5 w-3/4 max-w-sm" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-row items-start gap-4 sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <BrowserFrame
                      device="desktop"
                      url={hostname}
                      imageUrl={desktopScreenshotUrl}
                      state={desktopScreenshotUrl ? 'loaded' : 'loading'}
                    />
                  </div>
                  {showMobileFrame && (
                    <div className="hidden w-[200px] max-w-full shrink-0 lg:block">
                      <BrowserFrame
                        device="mobile"
                        url={hostname}
                        imageUrl={mobileScreenshotUrl}
                        state={mobileScreenshotUrl ? 'loaded' : 'loading'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </Container>
  )
}

/** Static shell for route-level loading states. */
export function AuditReportProgressiveShell() {
  return <AuditReportProgressive />
}
