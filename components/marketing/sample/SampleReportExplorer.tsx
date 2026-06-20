'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import { ScreenshotWithHighlights } from '@/components/marketing/sample/ScreenshotWithHighlights'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import type { FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { reportScanDetail } from '@/lib/audit/report-pipeline-steps'
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
    scoreSize: 'md' as const,
    showHeader: false,
  },
  page: {
    compact: false,
    showProgress: true,
    showScoreStack: true,
    scoreSize: 'md' as const,
    showHeader: true,
  },
} as const

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
          <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
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
        {flag.evidence && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.evidence}
          </p>
        )}
      </div>

      {flag.verificationRule && (
        <div className="rounded-[var(--radius-inner)] bg-muted/30 px-4 py-3">
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
  fixLoopFlags,
  selectedFlagId,
  onSelectFlag,
  flagDetailRef,
  flagDetailLabel = 'Flag detail',
}: {
  report: SampleReportDisplay
  flag: SampleFlagDisplay
  config: (typeof VARIANT_CONFIG)[ExplorerVariant]
  fixLoopFlags: FixLoopFlagItem[]
  selectedFlagId: string
  onSelectFlag: (flagId: string) => void
  flagDetailRef: React.RefObject<HTMLDivElement | null>
  flagDetailLabel?: string
}) {
  const allHighlights = buildAllEvidenceHighlights(report.flags)
  const showDesktop = flag.evidenceDevices.includes('desktop')
  const showMobile = flag.evidenceDevices.includes('mobile')

  return (
    <div
      className={cn(
        'flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)] lg:items-start lg:gap-8'
      )}
    >
      {config.showScoreStack && (
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-offset)+1rem)]">
          <ReportScoreOverview
            score={report.score}
            rubricScores={report.rubricScores}
            fixLoop={{
              scanDetail: reportScanDetail(report.pageType),
              flags: fixLoopFlags,
              selectedFlagId,
              onSelectFlag,
              hasFixPrompts: true,
              defaultExpanded: true,
              compact: config.compact,
            }}
            scoreSize={config.scoreSize}
            compact={config.compact}
            showProgress={config.showProgress}
            layout="stacked"
          />
        </aside>
      )}

      <div
        id="flag-detail"
        ref={flagDetailRef}
        className="min-w-0 border-t border-border/30 pt-6 scroll-mt-24 lg:border-t-0 lg:pt-0"
      >
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {flagDetailLabel}
          </p>
        </div>

        <ScreenshotWithHighlights
          host={report.displayHost}
          desktopScreenshot={report.desktopScreenshot}
          mobileScreenshot={report.mobileScreenshot}
          highlights={allHighlights}
          selectedFlagId={flag.id}
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

  const fixLoopFlags: FixLoopFlagItem[] = report.flags.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    hasFixPrompt: Boolean(f.fixPrompt),
  }))

  const reportBodyProps = {
    report,
    flag: currentFlag,
    config,
    fixLoopFlags,
    selectedFlagId: currentFlag.id,
    onSelectFlag: goToFlag,
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
          </div>
        )}

        <div className="p-4 sm:p-6">
          <ReportBody {...reportBodyProps} />
        </div>
      </div>
    </div>
  )
}
