'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import { RubricOverviewStrip } from '@/components/marketing/sample/RubricOverviewStrip'
import { ScoreRingGauge } from '@/components/marketing/sample/ScoreRingGauge'
import { ScreenshotWithHighlights } from '@/components/marketing/sample/ScreenshotWithHighlights'
import { Button } from '@/components/ui/button'
import type {
  PipelineStep,
  SampleFlagDisplay,
  SampleReportDisplay,
} from '@/lib/marketing/sample-report-display'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

type ExplorerVariant = 'page' | 'embedded' | 'hero'

interface SampleReportExplorerProps {
  report: SampleReportDisplay
  variant?: ExplorerVariant
  className?: string
  initialFlagIndex?: number
}

function StepDot({ state }: { state: PipelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15">
        <span className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" />
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    </span>
  )
}

function PipelineStepsList({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-3">
          <StepDot state={step.state} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-sm',
                  step.state === 'done' && 'text-muted-foreground line-through',
                  step.state === 'active' && 'font-semibold text-foreground',
                  step.state === 'pending' && 'text-muted-foreground/50'
                )}
              >
                {step.label}
              </span>
              {step.state === 'active' ? (
                <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                  {step.detail}
                </span>
              ) : (
                <span
                  className={cn(
                    'shrink-0 text-[11px]',
                    step.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/40'
                  )}
                >
                  {step.detail}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RubricPills({ scores }: { scores: SampleReportDisplay['rubricScores'] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {scores.map((rubric) => {
        const scoreLabel = rubric.score == null ? '—' : String(rubric.score)
        const barWidth = rubric.score == null ? 0 : Math.min(100, rubric.score)

        return (
          <div
            key={rubric.name}
            className="min-w-[4.5rem] rounded-card bg-muted/30 px-2.5 py-2 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-bold tabular-nums">{scoreLabel}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{rubric.name}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor:
                    rubric.score != null ? scoreToScanColor(rubric.score) : undefined,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FlagNavigation({
  index,
  total,
  onPrevious,
  onNext,
}: {
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {index + 1} / {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onPrevious}
          aria-label="Previous flag"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onNext}
          aria-label="Next flag"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FlagDetailPanel({
  flag,
  compact = false,
}: {
  flag: SampleFlagDisplay
  compact?: boolean
}) {
  return (
    <div key={flag.id} className="space-y-4 animate-soft-reveal" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <RubricPill rubric={flag.rubric} label={flag.rubricLabel} />
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
            flag.severity === 'CRITICAL'
              ? 'bg-destructive/10 text-destructive'
              : flag.severity === 'IMPORTANT'
                ? 'bg-brand/10 text-brand'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {flag.severityLabel}
        </span>
        {flag.impactTag && (
          <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            {flag.impactTag}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold leading-snug text-balance sm:text-lg">
          {flag.title}
        </h3>
        {flag.whyItMatters && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
            {flag.whyItMatters}
          </p>
        )}
      </div>

      {flag.verificationRule && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            How to verify
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.verificationRule}
          </p>
        </div>
      )}

      <FixPromptBlock
        prompt={flag.fixPrompt}
        rows={compact ? 3 : 4}
        clamp={compact}
        showCursorAction
        variant="compact"
        nested
      />
    </div>
  )
}

function ReportBody({
  report,
  flag,
  showProgress = true,
  showScore = true,
  showRubricPills = true,
  showFlagNav = true,
  scoreSize = 'md',
  flagIndex,
  flagCount,
  onPrevious,
  onNext,
  compact = false,
  flagDetailLabel = 'Flag detail',
}: {
  report: SampleReportDisplay
  flag: SampleFlagDisplay
  showProgress?: boolean
  showScore?: boolean
  showRubricPills?: boolean
  showFlagNav?: boolean
  scoreSize?: 'sm' | 'md' | 'lg'
  flagIndex: number
  flagCount: number
  onPrevious: () => void
  onNext: () => void
  compact?: boolean
  flagDetailLabel?: string
}) {
  return (
    <div className="space-y-6">
      {showScore && (
        <div className="flex items-center gap-4">
          <ScoreRingGauge score={report.score} size={scoreSize} />
          <div className="min-w-0 flex-1 space-y-2">
            {report.verdict && (
              <p className="text-sm font-medium leading-snug text-balance">{report.verdict}</p>
            )}
            {showRubricPills && <RubricPills scores={report.rubricScores} />}
          </div>
        </div>
      )}

      {!showScore && showRubricPills && (
        <div className="space-y-2">
          <RubricPills scores={report.rubricScores} />
        </div>
      )}

      {showProgress && (
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Review progress
          </p>
          <PipelineStepsList steps={report.pipelineSteps} />
        </div>
      )}

      <ScreenshotWithHighlights
        url={report.url}
        host={report.displayHost}
        desktopScreenshot={report.desktopScreenshot}
        mobileScreenshot={report.mobileScreenshot}
        preferredDevice={flag.preferredDevice}
        highlights={flag.evidenceHighlights}
        severity={flag.severity}
      />

      <div className="border-t border-border/30 pt-6">
        <div
          className={cn(
            'mb-4 flex items-center gap-3',
            showFlagNav ? 'justify-between' : undefined
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {flagDetailLabel}
          </p>
          {showFlagNav && (
            <div className="flex items-center gap-3">
              {!compact && (
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  ← → to navigate
                </span>
              )}
              <FlagNavigation
                index={flagIndex}
                total={flagCount}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            </div>
          )}
        </div>
        <FlagDetailPanel flag={flag} compact={compact} />
      </div>
    </div>
  )
}

export function SampleReportExplorer({
  report,
  variant = 'page',
  className,
  initialFlagIndex = 0,
}: SampleReportExplorerProps) {
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)
  const flagCount = report.flags.length
  const currentFlag = report.flags[flagIndex]

  const showPrevious = useCallback(() => {
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const goToRubric = useCallback(
    (rubric: string) => {
      const idx = report.flags.findIndex((f) => f.rubric === rubric)
      if (idx >= 0) setFlagIndex(idx)
    },
    [report.flags]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') showPrevious()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNext, showPrevious])

  if (!currentFlag) return null

  const shellClass = cn(
    'overflow-hidden rounded-card glass-surface shadow-card',
    variant === 'hero' && 'shadow-2xl',
    className
  )

  if (variant === 'hero') {
    return (
      <div className={shellClass}>
        <div className="bg-muted/10 p-4 sm:p-5">
          <ReportBody
            report={report}
            flag={currentFlag}
            scoreSize="md"
            flagIndex={flagIndex}
            flagCount={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
            compact
          />
        </div>
      </div>
    )
  }

  if (variant === 'embedded') {
    return (
      <div className={shellClass}>
        <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <ScoreRingGauge score={report.score} size="sm" />
            <div>
              <p className="text-sm font-semibold">{report.displayHost}</p>
              <p className="text-[11px] text-muted-foreground">
                {report.flagCount} flags · score {report.score ?? '—'}
              </p>
            </div>
          </div>
          <FlagNavigation
            index={flagIndex}
            total={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
          />
        </div>

        <div className="p-4 sm:p-5">
          <ReportBody
            report={report}
            flag={currentFlag}
            showProgress={false}
            showScore={false}
            flagIndex={flagIndex}
            flagCount={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
            compact
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <RubricOverviewStrip
        scores={report.rubricScores}
        summaries={report.rubricSummaries}
        onSelectRubric={goToRubric}
      />

      <div className={shellClass}>
        <div className="flex flex-col gap-4 border-b border-border/30 px-4 py-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <ScoreRingGauge score={report.score} size="lg" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium">
                  {report.pageType ?? 'Landing page'}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground truncate">
                  {report.displayHost}
                </span>
              </div>
              {report.verdict && (
                <p className="text-sm font-medium leading-snug text-balance">{report.verdict}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {report.flagCount} checks · score {report.score ?? '—'}
              </p>
            </div>
          </div>
          <FlagNavigation
            index={flagIndex}
            total={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
          />
        </div>

        <div className="p-4 sm:p-6">
          <ReportBody
            report={report}
            flag={currentFlag}
            showScore={false}
            showRubricPills={false}
            showFlagNav={false}
            flagIndex={flagIndex}
            flagCount={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
            flagDetailLabel={`Check ${flagIndex + 1} of ${flagCount}`}
          />
        </div>
      </div>
    </div>
  )
}
