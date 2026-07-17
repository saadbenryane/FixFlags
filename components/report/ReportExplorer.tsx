'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import { FlagDetailPanel, FlagMetaPills } from '@/components/report/FlagDetailPanel'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { Button } from '@/components/ui/button'
import { reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import type { JourneyPage } from '@/components/audit/JourneyBar'
import { cn, rubricLabel } from '@/lib/utils'

type ExplorerVariant = 'page' | 'hero' | 'live'
type SeverityFilter = 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'POLISH'
type RubricFilter = 'ALL' | RubricName

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
  pages?: JourneyPage[]
}

const VARIANT_CONFIG = {
  hero: {
    compact: true,
    showHeader: false,
  },
  page: {
    compact: false,
    showHeader: true,
  },
  live: {
    compact: false,
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

function RubricTabs({
  rubricFilter,
  onRubricChange,
  counts,
  total,
}: {
  rubricFilter: RubricFilter
  onRubricChange: (value: RubricFilter) => void
  counts: Record<RubricName, number>
  total: number
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Filter by rubric"
    >
      <button
        type="button"
        role="tab"
        aria-selected={rubricFilter === 'ALL'}
        onClick={() => onRubricChange('ALL')}
        className={cn(
          'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
          rubricFilter === 'ALL'
            ? 'bg-foreground text-background'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
        )}
      >
        All
        <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-70">{total}</span>
      </button>
      {RUBRIC_ORDER.map((rubric) => {
        const count = counts[rubric]
        if (count === 0) return null
        return (
          <button
            key={rubric}
            type="button"
            role="tab"
            aria-selected={rubricFilter === rubric}
            onClick={() => onRubricChange(rubric)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
              rubricFilter === rubric
                ? 'bg-foreground text-background'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {rubricLabel(rubric)}
            <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-70">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function FlagDetailPane({
  model,
  flag,
  flagIndex,
  flagCount,
  onPrevious,
  onNext,
  showFeedback,
  aiLocked,
  aiEnhancementPending,
  signUpHref,
  onSelectFlag,
}: {
  model: ReportExplorerModel
  flag: ReportExplorerModel['flags'][number]
  flagIndex: number
  flagCount: number
  onPrevious: () => void
  onNext: () => void
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  onSelectFlag: (flagId: string) => void
}) {
  const showDesktop = flag.evidenceDevices.includes('desktop')
  const showMobile = flag.evidenceDevices.includes('mobile')

  return (
    <div className="min-w-0" aria-live="polite">
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
        onPinSelect={onSelectFlag}
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
  pages = [],
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(defaultSeverityFilter)
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>('ALL')
  const [pageFilter, setPageFilter] = useState<string | null>(null)
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)

  const rubricCounts = useMemo(() => {
    const counts = { MESSAGE: 0, EXPERIENCE: 0, REACH: 0 } as Record<RubricName, number>
    for (const flag of model.flags) {
      if (severityFilter !== 'ALL' && flag.severity !== severityFilter) continue
      if (pageFilter && flag.pageUrl !== pageFilter) continue
      if (flag.rubric in counts) {
        counts[flag.rubric as RubricName] += 1
      }
    }
    return counts
  }, [model.flags, severityFilter, pageFilter])

  const filteredFlags = useMemo(() => {
    return model.flags.filter((flag) => {
      if (severityFilter !== 'ALL' && flag.severity !== severityFilter) return false
      if (rubricFilter !== 'ALL' && flag.rubric !== rubricFilter) return false
      if (pageFilter && flag.pageUrl !== pageFilter) return false
      return true
    })
  }, [model.flags, severityFilter, rubricFilter, pageFilter])

  useEffect(() => {
    setFlagIndex(0)
  }, [severityFilter, rubricFilter, pageFilter])

  useEffect(() => {
    if (rubricFilter === 'ALL') return
    if (rubricCounts[rubricFilter] === 0) {
      setRubricFilter('ALL')
    }
  }, [rubricFilter, rubricCounts])

  const flagCount = filteredFlags.length
  const currentFlag = filteredFlags[flagIndex] ?? filteredFlags[0]
  const criticalCount = model.flags.filter((f) => f.severity === 'CRITICAL').length
  const hasPages = pages.length > 1

  const showPrevious = useCallback(() => {
    if (flagCount <= 0) return
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    if (flagCount <= 0) return
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const detailRef = useRef<HTMLDivElement>(null)

  const goToFlag = useCallback(
    (flagId: string) => {
      const idx = filteredFlags.findIndex((f) => f.id === flagId)
      if (idx < 0) return
      setFlagIndex(idx)
      // Mobile stacks detail below the list -- bring it into view on select.
      // Desktop keeps sticky master-detail without scrolling.
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => {
          detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    },
    [filteredFlags]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.matches('input, textarea, select, [contenteditable]')
      if (isInput) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        showPrevious()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        showNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNext, showPrevious])

  const shellClass = cn(
    'overflow-hidden rounded-card glass-surface shadow-card',
    variant === 'hero' && 'shadow-2xl',
    className
  )

  const fixLoopFlags: FixLoopFlagItem[] = filteredFlags.map((f) => ({
    id: f.id,
    title: f.title,
    priorityLabel: f.priorityLabel,
    rubric: f.rubric,
    impactTag: f.impactTag,
    severity: f.severity,
    hasFixPrompt: f.hasFixPrompt,
  }))

  const scoreHeader = (
    <div className="flex flex-wrap items-center gap-4 border-b border-border/30 pb-4">
      <ScoreRingGauge score={model.score} size={config.compact ? 'sm' : 'md'} />
      <RubricTabs
        rubricFilter={rubricFilter}
        onRubricChange={setRubricFilter}
        counts={rubricCounts}
        total={Object.values(rubricCounts).reduce((a, b) => a + b, 0)}
      />
    </div>
  )

  const secondaryFilters = (hasPages || criticalCount > 0) && (
    <div className="space-y-2">
      {hasPages && (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={pageFilter === null} onClick={() => setPageFilter(null)}>
            All Pages ({model.flags.length})
          </FilterPill>
          {pages.map((page) => {
            const count = model.flags.filter((f) => f.pageUrl === page.url).length
            if (count === 0) return null
            const hostname = (() => {
              try {
                return new URL(page.url).pathname === '/'
                  ? ''
                  : (new URL(page.url).pathname.split('/').filter(Boolean)[0] ?? '')
              } catch {
                return ''
              }
            })()
            const label = hostname || page.role
            return (
              <FilterPill
                key={page.url}
                active={pageFilter === page.url}
                onClick={() => setPageFilter(pageFilter === page.url ? null : page.url)}
              >
                {label} ({count})
              </FilterPill>
            )
          })}
        </div>
      )}
      {criticalCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill
            active={severityFilter === 'ALL'}
            onClick={() => setSeverityFilter('ALL')}
          >
            All severities
          </FilterPill>
          <FilterPill
            active={severityFilter === 'CRITICAL'}
            onClick={() =>
              setSeverityFilter(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')
            }
          >
            Critical ({criticalCount})
          </FilterPill>
        </div>
      )}
    </div>
  )

  const listPane = (
    <div className="min-w-0 space-y-3">
      {secondaryFilters}
      {flagCount === 0 ? (
        <p className="text-sm text-muted-foreground">No flags match this filter.</p>
      ) : (
        <ReportFixLoop
          scanDetail={reportScanDetail(model.pageType)}
          flags={fixLoopFlags}
          selectedFlagId={currentFlag?.id}
          onSelectFlag={goToFlag}
          hasFixPrompts={hasFixPrompts}
          defaultExpanded
          compact={config.compact}
          variant="panel"
        />
      )}
    </div>
  )

  const detailPane =
    currentFlag && flagCount > 0 ? (
      <FlagDetailPane
        model={model}
        flag={currentFlag}
        flagIndex={flagIndex}
        flagCount={flagCount}
        onPrevious={showPrevious}
        onNext={showNext}
        showFeedback={showFeedback}
        aiLocked={aiLocked}
        aiEnhancementPending={aiEnhancementPending}
        signUpHref={signUpHref}
        onSelectFlag={goToFlag}
      />
    ) : (
      <p className="text-sm text-muted-foreground">Select a flag to see evidence and the fix prompt.</p>
    )

  const masterDetail = (
    <div className="space-y-5">
      {scoreHeader}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,38%)_minmax(0,1fr)]">
        {listPane}
        <div
          ref={detailRef}
          className={cn(
            'min-w-0 scroll-mt-24 border-t border-border/30 pt-6',
            'lg:sticky lg:top-[calc(var(--header-offset)+1rem)] lg:border-t-0 lg:pt-0 lg:self-start'
          )}
        >
          {detailPane}
        </div>
      </div>
    </div>
  )

  if (variant === 'hero') {
    return (
      <div className={shellClass}>
        <div className="bg-muted/10 p-4 sm:p-5">{masterDetail}</div>
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
              <span className="truncate font-mono text-[11px] text-muted-foreground">
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
        {masterDetail}
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
