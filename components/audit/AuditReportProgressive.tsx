'use client'

import { useEffect, useMemo, useState } from 'react'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { Card } from '@/components/ui/card'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { RubricBar } from '@/components/audit/RubricBar'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricComputed } from '@/lib/audit/rubric'
import { displayHostname } from '@/lib/utils/url-helpers'
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

      <section id="report-finish-plan" className="space-y-4" aria-live="polite" aria-busy={isLoading}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label mb-2">{REPORT_COPY.focused.eyebrow}</p>
            <SectionTitle>{REPORT_COPY.sectionTitles.topPriorities}</SectionTitle>
          </div>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {displayProgress}% · {activityMessage ?? 'Preparing your Finish Plan…'}
          </p>
        </div>
        <div className="grid gap-3">
          {[0, 1, 2].map((index) => {
            const flag = partialFlags[index]
            return (
              <Card key={flag?.id ?? index} className="flex min-h-28 gap-4 p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-xs font-bold text-background">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  {flag ? (
                    <>
                      <p className="meta-label text-muted-foreground">{flag.rubric}</p>
                      <p className="text-sm font-medium leading-snug text-pretty">{flag.problem}</p>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_13rem]">
        <BrowserFrame
          device="desktop"
          url={hostname}
          imageUrl={desktopScreenshotUrl}
          state={desktopScreenshotUrl ? 'loaded' : 'loading'}
        />
        {showMobileFrame ? (
          <div className="hidden lg:block">
            <BrowserFrame
              device="mobile"
              url={hostname}
              imageUrl={mobileScreenshotUrl}
              state={mobileScreenshotUrl ? 'loaded' : 'loading'}
            />
          </div>
        ) : null}
      </div>

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
