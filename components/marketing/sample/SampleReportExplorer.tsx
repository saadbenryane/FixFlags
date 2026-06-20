'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import { ScreenshotWithHighlights } from '@/components/marketing/sample/ScreenshotWithHighlights'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import { Button } from '@/components/ui/button'
import {
  buildAllEvidenceHighlights,
  type SampleFlagDisplay,
  type SampleReportDisplay,
} from '@/lib/marketing/sample-report-display'
import { cn } from '@/lib/utils'

type ExplorerVariant = 'page' | 'hero'

interface SampleReportExplorerProps {
  report: SampleReportDisplay
  variant?: ExplorerVariant
  className?: string
  initialFlagIndex?: number
}

const VARIANT_CONFIG = {
  hero: {
    compact: true,
    showProgress: true,
    showScoreStack: true,
    showFlagNav: true,
    scoreSize: 'md' as const,
    showHeader: false,
  },
  page: {
    compact: false,
    showProgress: true,
    showScoreStack: true,
    showFlagNav: false,
    scoreSize: 'md' as const,
    showHeader: true,
  },
} as const

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

function FlagDetailPanel({ flag }: { flag: SampleFlagDisplay }) {
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
        rows={4}
        clamp={false}
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
  config,
  flagIndex,
  flagCount,
  onPrevious,
  onNext,
  onPinSelect,
  flagDetailRef,
  flagDetailLabel = 'Flag detail',
}: {
  report: SampleReportDisplay
  flag: SampleFlagDisplay
  config: (typeof VARIANT_CONFIG)[ExplorerVariant]
  flagIndex: number
  flagCount: number
  onPrevious: () => void
  onNext: () => void
  onPinSelect: (flagId: string) => void
  flagDetailRef: React.RefObject<HTMLDivElement | null>
  flagDetailLabel?: string
}) {
  const allHighlights = buildAllEvidenceHighlights(report.flags)
  const showDesktop = flag.evidenceDevices.includes('desktop')
  const showMobile = flag.evidenceDevices.includes('mobile')

  return (
    <div className="space-y-6">
      {config.showScoreStack && (
        <ReportScoreOverview
          score={report.score}
          rubricScores={report.rubricScores}
          pipelineSteps={report.pipelineSteps}
          scoreSize={config.scoreSize}
          compact={config.compact}
          showProgress={config.showProgress}
        />
      )}

      <div
        id="flag-detail"
        ref={flagDetailRef}
        className="border-t border-border/30 pt-6 scroll-mt-24"
      >
        <div
          className={cn(
            'mb-4 flex items-center gap-3',
            config.showFlagNav ? 'justify-between' : undefined
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {flagDetailLabel}
          </p>
          {config.showFlagNav && (
            <div className="flex items-center gap-3">
              {!config.compact && (
                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                  Left and right arrow keys to navigate
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

        <ScreenshotWithHighlights
          host={report.displayHost}
          desktopScreenshot={report.desktopScreenshot}
          mobileScreenshot={report.mobileScreenshot}
          highlights={allHighlights}
          selectedFlagId={flag.id}
          onPinSelect={onPinSelect}
          showDesktop={showDesktop}
          showMobile={showMobile}
          className="mb-5"
        />

        <FlagDetailPanel flag={flag} />
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
  const config = VARIANT_CONFIG[variant]
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)
  const flagDetailRef = useRef<HTMLDivElement>(null)
  const flagCount = report.flags.length
  const currentFlag = report.flags[flagIndex]

  const showPrevious = useCallback(() => {
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const goToFlag = useCallback(
    (flagId: string) => {
      const idx = report.flags.findIndex((f) => f.id === flagId)
      if (idx < 0) return
      setFlagIndex(idx)
      requestAnimationFrame(() => {
        flagDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
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

  const reportBodyProps = {
    report,
    flag: currentFlag,
    config,
    flagIndex,
    flagCount,
    onPrevious: showPrevious,
    onNext: showNext,
    onPinSelect: goToFlag,
    flagDetailRef,
    flagDetailLabel:
      variant === 'page' ? `Check ${flagIndex + 1} of ${flagCount}` : 'Flag detail',
  }

  if (variant === 'hero') {
    return (
      <div className={shellClass}>
        <div className="bg-muted/10 p-4 sm:p-5">
          <ReportBody {...reportBodyProps} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(className)}>
      <div className={shellClass}>
        {config.showHeader && (
          <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium">
                  {report.pageType ?? 'Landing page'}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground truncate">
                  {report.displayHost}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{report.flagCount} checks</p>
              {report.verdict && (
                <p className="text-sm font-medium leading-snug text-balance">{report.verdict}</p>
              )}
            </div>
            <FlagNavigation
              index={flagIndex}
              total={flagCount}
              onPrevious={showPrevious}
              onNext={showNext}
            />
          </div>
        )}

        <div className="p-4 sm:p-6">
          <ReportBody {...reportBodyProps} />
        </div>
      </div>
    </div>
  )
}
