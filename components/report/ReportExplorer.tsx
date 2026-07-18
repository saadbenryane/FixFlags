'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import { FlagDetailPanel, FlagMetaPills, isShareableCheck } from '@/components/report/FlagDetailPanel'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { Button } from '@/components/ui/button'
import { FilterPill } from '@/components/ui/filter-pill'
import { reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  RUBRIC_ORDER,
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  pageFilterLabel,
  resolveRubricFilter,
  type RubricFilter,
  type SeverityFilter,
} from '@/lib/report/explorer-filters'
import type { JourneyPage } from '@/components/audit/JourneyBar'
import { cn, rubricLabel } from '@/lib/utils'

type ExplorerVariant = 'hero' | 'live'

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
  loading?: boolean
  progress?: number
}

const VARIANT_CONFIG = {
  hero: {
    compact: true,
    ownShell: true,
  },
  live: {
    compact: false,
    ownShell: true,
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
      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
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
          disabled={total <= 1}
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
          disabled={total <= 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
  counts: Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number>
  total: number
}) {
  const tabs: Array<{ id: RubricFilter; label: string; count: number }> = [
    { id: 'ALL', label: 'All', count: total },
    ...RUBRIC_ORDER.map((rubric) => ({
      id: rubric as RubricFilter,
      label: rubricLabel(rubric),
      count: counts[rubric],
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Filter by rubric">
      {tabs.map((tab) => (
        <FilterPill
          key={tab.id}
          size="sm"
          active={rubricFilter === tab.id}
          onClick={() => onRubricChange(tab.id)}
        >
          {tab.label}
          <span className="ml-1.5 font-mono text-2xs tabular-nums opacity-70">{tab.count}</span>
        </FilterPill>
      ))}
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
  const shareableFlag = isShareableCheck(flag.checkId)

  return (
    <div className="min-w-0">
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

      {!shareableFlag && (
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
      )}

      <FlagDetailPanel
        flag={flag}
        showFeedback={showFeedback}
        aiLocked={aiLocked}
        aiEnhancementPending={aiEnhancementPending}
        signUpHref={signUpHref}
        previewMeta={model.previewMeta}
      />
    </div>
  )
}

export function ReportExplorer({
  model,
  variant = 'live',
  className,
  initialFlagIndex = 0,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  hasFixPrompts = true,
  defaultSeverityFilter = 'ALL',
  pages = [],
  loading = false,
  progress,
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const rootRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(defaultSeverityFilter)
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>('ALL')
  const [pageFilter, setPageFilter] = useState<string | null>(null)
  const [flagIndex, setFlagIndex] = useState(() =>
    clampFlagIndex(initialFlagIndex, model.flags.length)
  )

  const rubricCounts = useMemo(
    () =>
      countFlagsByRubric(model.flags, {
        severityFilter,
        pageFilter,
      }),
    [model.flags, severityFilter, pageFilter]
  )

  const effectiveRubricFilter = resolveRubricFilter(rubricFilter, rubricCounts)

  useEffect(() => {
    if (effectiveRubricFilter !== rubricFilter) {
      setRubricFilter(effectiveRubricFilter)
    }
  }, [effectiveRubricFilter, rubricFilter])

  const filteredFlags = useMemo(
    () =>
      filterExplorerFlags(model.flags, {
        severityFilter,
        rubricFilter: effectiveRubricFilter,
        pageFilter,
      }),
    [model.flags, severityFilter, effectiveRubricFilter, pageFilter]
  )

  const flagCount = filteredFlags.length
  const safeFlagIndex = clampFlagIndex(flagIndex, flagCount)

  useEffect(() => {
    setFlagIndex(0)
  }, [severityFilter, effectiveRubricFilter, pageFilter])

  useEffect(() => {
    setFlagIndex((current) => clampFlagIndex(current, filteredFlags.length))
  }, [filteredFlags.length, model.flags])

  const currentFlag = filteredFlags[safeFlagIndex] ?? filteredFlags[0]
  const criticalCount = model.flags.filter((f) => f.severity === 'CRITICAL').length
  const hasPages = pages.length > 1

  const showPrevious = useCallback(() => {
    if (flagCount <= 1) return
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
  }, [flagCount])

  const showNext = useCallback(() => {
    if (flagCount <= 1) return
    setFlagIndex((i) => (i + 1) % flagCount)
  }, [flagCount])

  const goToFlag = useCallback(
    (flagId: string) => {
      const idx = filteredFlags.findIndex((f) => f.id === flagId)
      if (idx < 0) return
      setFlagIndex(idx)
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
      const root = rootRef.current
      if (!root) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.matches('input, textarea, select, [contenteditable]')) return
      if (!root.contains(target) && document.activeElement !== root) return
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
      <ScoreRingGauge
        score={model.score}
        size={config.compact ? 'sm' : 'md'}
        loading={loading && model.score == null}
        progress={progress}
      />
      <RubricTabs
        rubricFilter={effectiveRubricFilter}
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
          <FilterPill size="sm" active={pageFilter === null} onClick={() => setPageFilter(null)}>
            {REPORT_COPY.explorer.allPages} ({model.flags.length})
          </FilterPill>
          {pages.map((page) => {
            const count = model.flags.filter((f) => f.pageUrl === page.url).length
            if (count === 0) return null
            const label = pageFilterLabel(page.url, page.role)
            return (
              <FilterPill
                size="sm"
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
            size="sm"
            active={severityFilter === 'ALL'}
            onClick={() => setSeverityFilter('ALL')}
          >
            {REPORT_COPY.explorer.allSeverities}
          </FilterPill>
          <FilterPill
            size="sm"
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
        <p className="text-sm text-muted-foreground">
          {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noMatchFilter}
        </p>
      ) : (
        <ReportFixLoop
          scanDetail={
            loading ? REPORT_COPY.explorer.stillScanning : reportScanDetail(model.pageType)
          }
          flags={fixLoopFlags}
          selectedFlagId={currentFlag?.id}
          onSelectFlag={goToFlag}
          hasFixPrompts={hasFixPrompts}
          defaultExpanded
          compact={config.compact}
          variant="panel"
          loading={loading}
        />
      )}
    </div>
  )

  const detailPane =
    currentFlag && flagCount > 0 ? (
      <FlagDetailPane
        model={model}
        flag={currentFlag}
        flagIndex={safeFlagIndex}
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
      <p className="text-sm text-muted-foreground">
        {loading ? REPORT_COPY.explorer.flagsAppear : REPORT_COPY.explorer.selectFlag}
      </p>
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

  const shellClass = cn(
    'overflow-hidden rounded-card glass-surface shadow-card',
    variant === 'hero' && 'shadow-2xl',
    className
  )

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn(config.ownShell ? shellClass : className)}
    >
      <div className={cn(variant === 'hero' ? 'bg-muted/10 p-4 sm:p-5' : 'p-4 sm:p-6')}>
        <h2 className="sr-only">Flags</h2>
        {masterDetail}
      </div>
    </div>
  )
}
