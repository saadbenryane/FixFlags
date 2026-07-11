'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import { FlagDetailPanel, FlagMetaPills } from '@/components/report/FlagDetailPanel'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import type { FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { Button } from '@/components/ui/button'
import { reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { cn, rubricLabel } from '@/lib/utils'

type ExplorerVariant = 'page' | 'hero' | 'live'
type RubricFilter = 'ALL' | (typeof RUBRIC_ORDER)[number]
type SeverityFilter = 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'POLISH'

interface ReportExplorerProps {
  model: ReportExplorerModel
  variant?: ExplorerVariant
  className?: string
  initialFlagIndex?: number
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  hasFixPrompts?: boolean
  defaultSeverityFilter?: SeverityFilter
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
  aiEnhancementPending,
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
  aiEnhancementPending?: boolean
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
          aiEnhancementPending={aiEnhancementPending}
          signUpHref={signUpHref}
        />
      </div>
    </div>
  )
}

function ExplorerFilters({
  rubricFilter,
  severityFilter,
  onRubricChange,
  onSeverityChange,
  model,
}: {
  rubricFilter: RubricFilter
  severityFilter: SeverityFilter
  onRubricChange: (value: RubricFilter) => void
  onSeverityChange: (value: SeverityFilter) => void
  model: ReportExplorerModel
}) {
  const rubricCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const flag of model.flags) {
      counts.set(flag.rubric, (counts.get(flag.rubric) ?? 0) + 1)
    }
    return counts
  }, [model.flags])

  const criticalCount = model.flags.filter((f) => f.severity === 'CRITICAL').length

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={rubricFilter === 'ALL'} onClick={() => onRubricChange('ALL')}>
          All ({model.flags.length})
        </FilterPill>
        {RUBRIC_ORDER.map((rubric) => {
          const count = rubricCounts.get(rubric) ?? 0
          if (count === 0) return null
          return (
            <FilterPill
              key={rubric}
              active={rubricFilter === rubric}
              onClick={() => onRubricChange(rubric)}
            >
              {rubricLabel(rubric)} ({count})
            </FilterPill>
          )
        })}
      </div>
      {criticalCount > 0 && (
        <div className="flex flex-wrap gap-1.5 border-l border-border/40 pl-2">
          <FilterPill
            active={severityFilter === 'CRITICAL'}
            onClick={() =>
              onSeverityChange(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')
            }
          >
            Critical ({criticalCount})
          </FilterPill>
          {severityFilter === 'CRITICAL' && (
            <FilterPill active={false} onClick={() => onSeverityChange('ALL')}>
              Show all
            </FilterPill>
          )}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-brand/15 text-brand'
          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function ReportExplorer({
  model,
  variant = 'page',
  className,
  initialFlagIndex = 0,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  hasFixPrompts = true,
  defaultSeverityFilter = 'ALL',
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(defaultSeverityFilter)
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)
  const flagDetailRef = useRef<HTMLDivElement>(null)

  const filteredFlags = useMemo(() => {
    return model.flags.filter((flag) => {
      if (rubricFilter !== 'ALL' && flag.rubric !== rubricFilter) return false
      if (severityFilter !== 'ALL' && flag.severity !== severityFilter) return false
      return true
    })
  }, [model.flags, rubricFilter, severityFilter])

  useEffect(() => {
    setFlagIndex(0)
  }, [rubricFilter, severityFilter])

  const flagCount = filteredFlags.length
  const currentFlag = filteredFlags[flagIndex] ?? filteredFlags[0]

  const showPrevious = useCallback(() => {
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const goToFlag = useCallback(
    (flagId: string) => {
      const idx = filteredFlags.findIndex((f) => f.id === flagId)
      if (idx < 0) return
      setFlagIndex(idx)
      requestAnimationFrame(() => {
        flagDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    },
    [filteredFlags]
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

  const shellClass = cn(
    'overflow-hidden rounded-card glass-surface shadow-card',
    variant === 'hero' && 'shadow-2xl',
    className
  )

  if (!currentFlag || flagCount === 0) {
    const emptyInner = (
      <div className="p-4 sm:p-6">
        <ExplorerFilters
          rubricFilter={rubricFilter}
          severityFilter={severityFilter}
          onRubricChange={setRubricFilter}
          onSeverityChange={setSeverityFilter}
          model={model}
        />
        <p className="text-sm text-muted-foreground">No flags match this filter.</p>
      </div>
    )
    if (variant === 'live') return <div className={cn(className)}>{emptyInner}</div>
    return (
      <div className={cn(className)}>
        <div className={shellClass}>{emptyInner}</div>
      </div>
    )
  }

  const fixLoopFlags: FixLoopFlagItem[] = filteredFlags.map((f) => ({
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
    aiEnhancementPending,
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
        <ExplorerFilters
          rubricFilter={rubricFilter}
          severityFilter={severityFilter}
          onRubricChange={setRubricFilter}
          onSeverityChange={setSeverityFilter}
          model={model}
        />
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
