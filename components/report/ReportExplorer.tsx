'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import { FlagDetailPanel, FlagMetaPills } from '@/components/report/FlagDetailPanel'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import type { FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { Button } from '@/components/ui/button'
import { reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

type ExplorerVariant = 'page' | 'hero' | 'live'

interface ReportExplorerProps {
  model: ReportExplorerModel
  variant?: ExplorerVariant
  className?: string
  initialFlagIndex?: number
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
  hasFixPrompts?: boolean
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
  live: {
    compact: false,
    showProgress: true,
    showScoreStack: true,
    scoreSize: 'md' as const,
    showHeader: false,
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
    <div className="flex shrink-0 items-center gap-2">
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

function ReportBody({
  model,
  flag,
  config,
  fixLoopFlags,
  selectedFlagId,
  onSelectFlag,
  flagIndex,
  flagCount,
  onPrevious,
  onNext,
  flagDetailRef,
  showFeedback,
  aiLocked,
  signUpHref,
  hasFixPrompts,
}: {
  model: ReportExplorerModel
  flag: ReportExplorerModel['flags'][number]
  config: (typeof VARIANT_CONFIG)[ExplorerVariant]
  fixLoopFlags: FixLoopFlagItem[]
  selectedFlagId: string
  onSelectFlag: (flagId: string) => void
  flagIndex: number
  flagCount: number
  onPrevious: () => void
  onNext: () => void
  flagDetailRef: React.RefObject<HTMLDivElement | null>
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
  hasFixPrompts?: boolean
}) {
  const showDesktop = flag.evidenceDevices.includes('desktop')
  const showMobile = flag.evidenceDevices.includes('mobile')

  return (
    <div className="space-y-6">
      {config.showScoreStack && (
        <ReportScoreOverview
          score={model.score}
          rubricScores={model.rubricScores}
          fixLoop={{
            scanDetail: reportScanDetail(model.pageType),
            flags: fixLoopFlags,
            selectedFlagId,
            onSelectFlag,
            hasFixPrompts: hasFixPrompts ?? true,
            defaultExpanded: true,
            compact: config.compact,
          }}
          scoreSize={config.scoreSize}
          compact={config.compact}
          showProgress={config.showProgress}
          layout="split"
        />
      )}

      <div
        id="flag-detail"
        ref={flagDetailRef}
        className={cn(
          'min-w-0 scroll-mt-24',
          config.showScoreStack && 'border-t border-border/30 pt-6'
        )}
      >
        <header className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-balance sm:text-lg">
              {flag.title}
            </h3>
            <FlagNavigation
              index={flagIndex}
              total={flagCount}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          </div>
          <div className="mt-1.5">
            <FlagMetaPills flag={flag} />
          </div>
        </header>

        <ScreenshotWithHighlights
          host={model.displayHost}
          desktopScreenshot={model.desktopScreenshot}
          mobileScreenshot={model.mobileScreenshot}
          highlights={model.allHighlights}
          selectedFlagId={flag.id}
          showDesktop={showDesktop}
          showMobile={showMobile}
          className="mb-5"
        />

        <FlagDetailPanel
          flag={flag}
          showFeedback={showFeedback}
          aiLocked={aiLocked}
          signUpHref={signUpHref}
        />
      </div>
    </div>
  )
}

export function ReportExplorer({
  model,
  variant = 'page',
  className,
  initialFlagIndex = 0,
  showFeedback = false,
  aiLocked = false,
  signUpHref,
  hasFixPrompts = true,
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)
  const flagDetailRef = useRef<HTMLDivElement>(null)
  const flagCount = model.flags.length
  const currentFlag = model.flags[flagIndex]

  const showPrevious = useCallback(() => {
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const goToFlag = useCallback(
    (flagId: string) => {
      const idx = model.flags.findIndex((f) => f.id === flagId)
      if (idx < 0) return
      setFlagIndex(idx)
      requestAnimationFrame(() => {
        flagDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    },
    [model.flags]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.matches('input, textarea, select, [contenteditable]')
      if (isInput) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); showPrevious() }
      if (e.key === 'ArrowRight') { e.preventDefault(); showNext() }
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

  const fixLoopFlags: FixLoopFlagItem[] = model.flags.map((f) => ({
    id: f.id,
    title: f.title,
    priorityLabel: f.priorityLabel,
    rubric: f.rubric,
    impactTag: f.impactTag,
    severity: f.severity,
    hasFixPrompt: f.hasFixPrompt,
  }))

  const reportBodyProps = {
    model,
    flag: currentFlag,
    config,
    fixLoopFlags,
    selectedFlagId: currentFlag.id,
    onSelectFlag: goToFlag,
    flagIndex,
    flagCount,
    onPrevious: showPrevious,
    onNext: showNext,
    flagDetailRef,
    showFeedback,
    aiLocked,
    signUpHref,
    hasFixPrompts,
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

  const inner = (
    <>
      {config.showHeader && (
        <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium">
                {model.pageType ?? 'Landing page'}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground truncate">
                {model.displayHost}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{model.flagCount} checks</p>
            {model.verdict && (
              <p className="text-sm font-medium leading-snug text-balance">{model.verdict}</p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6">
        <h2 className="sr-only">Flags</h2>
        <ReportBody {...reportBodyProps} />
      </div>
    </>
  )

  if (variant === 'live') {
    return <div className={cn(className)}>{inner}</div>
  }

  return (
    <div className={cn(className)}>
      <div className={shellClass}>{inner}</div>
    </div>
  )
}
