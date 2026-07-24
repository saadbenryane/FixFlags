'use client'

import { useEffect, useMemo, useState } from 'react'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { Card } from '@/components/ui/card'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { RubricBar } from '@/components/audit/RubricBar'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricComputed } from '@/lib/audit/rubric'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  getActivityMessage,
  getProgressPercent,
  getScanningLabel,
} from '@/lib/audit/progress-ui'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { displayVerdict } from '@/lib/audit/verdict'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { ProductContract } from '@/lib/audit/product-contract'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'

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
  technologyProfile?: TechnologyProfile
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
  rubrics = [],
  partialFlags = [],
  screenshots = [],
  workerIdle = false,
  actionTimeline = [],
  productContract = null,
  technologyProfile,
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

  const rubricRowsForBar = RUBRIC_ORDER.map((name) => {
    const row = rubrics.find((r) => r.name === name)
    return { name, score: row?.score ?? null, grade: row?.grade ?? null }
  })

  const userVerdict = displayVerdict(verdict ?? null)
  const scanningLabel = isLoading ? getScanningLabel(status, tick) : null
  const activityMessage = isLoading ? getActivityMessage(status, tick) : null

  const explorerModel = useMemo(
    () =>
      buildPartialExplorerModel({
        url,
        pageType,
        score,
        verdict,
        flags: partialFlags,
        screenshots,
        rubrics,
      }),
    [url, pageType, score, verdict, partialFlags, screenshots, rubrics]
  )

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

      {isLoading && (!technologyProfile || technologyProfile.status === 'not_captured') ? (
        <Card className="space-y-3 p-5" aria-label="Reading technology signals">
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
        <MadeWithProfile profile={technologyProfile} />
      ) : null}

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

      <section id="report-flags" className="space-y-4" aria-busy={isLoading}>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {displayProgress}% complete. {activityMessage ?? REPORT_COPY.progressive.preparingFixList}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label mb-2">{REPORT_COPY.progressive.eyebrow}</p>
            <SectionTitle>{REPORT_COPY.sectionTitles.allFixes}</SectionTitle>
          </div>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {displayProgress}% · {activityMessage ?? REPORT_COPY.progressive.preparingFixList}
          </p>
        </div>
        {explorerModel ? (
          <LiveReportExplorer
            model={explorerModel}
            loading={isLoading}
            progress={displayProgress}
          />
        ) : (
          <Card className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              {REPORT_COPY.progressive.waitingForFlags}
            </p>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-4/5" />
          </Card>
        )}
      </section>

      {(showContract || showTimeline) ? (
        <details className="rounded-card bg-card/40 p-5 shadow-card glass-surface">
          <summary className="min-h-11 cursor-pointer font-medium">
            {REPORT_COPY.sectionTitles.timelineProgressive}
          </summary>
          <div className="mt-4 space-y-4">
            {productContract ? <ProductContractCard contract={productContract} canEdit={false} /> : null}
            {showTimeline ? <ActionTimeline events={actionTimeline} /> : null}
          </div>
        </details>
      ) : null}
    </Container>
  )
}

/** Static shell for route-level loading states. */
export function AuditReportProgressiveShell() {
  return <AuditReportProgressive />
}
