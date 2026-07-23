'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Globe, type LucideIcon } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import { FlagDetailPanel, FlagMetaPills, isShareableCheck } from '@/components/report/FlagDetailPanel'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { Button } from '@/components/ui/button'
import { FilterPill } from '@/components/ui/filter-pill'
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
} from '@/lib/report/explorer-filters'
import type { JourneyPage } from '@/components/audit/JourneyBar'
import { cn, rubricIcon, rubricLabel } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'
import { IMPACT_TAG_ORDER, SEVERITY_ORDER } from '@/lib/audit/constants'
import { impactTagLabel, severityLabel } from '@/lib/utils'

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
  pages?: JourneyPage[]
  loading?: boolean
  progress?: number
  /** Optional audit id for funnel analytics on live reports. */
  auditId?: string
  demonstratedFlagId?: string
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
  total,
  onPrevious,
  onNext,
}: {
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
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
          className="h-11 w-11"
          onClick={onNext}
          aria-label="Next flag"
          disabled={total <= 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
  const tabs: Array<{ id: RubricFilter; label: string; count: number; icon?: LucideIcon }> = [
    { id: 'ALL', label: 'All', count: total },
    ...RUBRIC_ORDER.map((rubric) => ({
      id: rubric as RubricFilter,
      label: rubricLabel(rubric),
      count: counts[rubric],
      icon: rubricIcon(rubric),
    })).filter((tab) => tab.count > 0),
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Filter by rubric">
      {tabs.map((tab) => (
        <FilterPill
          key={tab.id}
          size="sm"
          icon={tab.icon}
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
  flagCount,
  onPrevious,
  onNext,
  showFeedback,
  aiLocked,
  aiEnhancementPending,
  signUpHref,
  onSelectFlag,
  compact = false,
  demonstratedFlagId,
  variant = 'live',
}: {
  model: ReportExplorerModel
  flag: ReportExplorerModel['flags'][number]
  flagCount: number
  onPrevious: () => void
  onNext: () => void
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  onSelectFlag: (flagId: string) => void
  compact?: boolean
  demonstratedFlagId?: string
  variant?: 'hero' | 'live'
}) {
  const showDesktop = flag.evidenceDevices.includes('desktop')
  const showMobile = flag.evidenceDevices.includes('mobile')
  const shareableFlag = isShareableCheck(flag.checkId)
  const isHero = variant === 'hero'

  return (
    <div className="min-w-0">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-balance sm:text-lg">
            {flag.title}
          </h3>
          <FlagNavigation
            total={flagCount}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        </div>
        <div className="mt-1.5">
          <FlagMetaPills flag={flag} />
        </div>
      </header>

      <div className={cn(isHero && 'space-y-6')}>
        {!shareableFlag && !isHero && (
          <ScreenshotWithHighlights
            host={model.displayHost}
            desktopScreenshot={model.desktopScreenshot}
            mobileScreenshot={model.mobileScreenshot}
            highlights={model.allHighlights}
            selectedFlagId={flag.id}
            onPinSelect={onSelectFlag}
            showDesktop={showDesktop}
            showMobile={showMobile}
            className={cn('mb-5', compact && 'lg:mb-0')}
          />
        )}
        {isHero && !shareableFlag && (
          <ScreenshotWithHighlights
            host={model.displayHost}
            desktopScreenshot={model.desktopScreenshot}
            mobileScreenshot={model.mobileScreenshot}
            highlights={model.allHighlights}
            selectedFlagId={flag.id}
            onPinSelect={onSelectFlag}
            showDesktop={showDesktop}
            showMobile={showMobile}
          />
        )}

        <div className={cn(isHero && 'pt-2')}>
          <FlagDetailPanel
            flag={flag}
            showFeedback={showFeedback}
            aiLocked={aiLocked && flag.id !== demonstratedFlagId}
            aiEnhancementPending={aiEnhancementPending}
            signUpHref={signUpHref}
            previewMeta={model.previewMeta}
          />
        </div>
      </div>
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
  pages = [],
  loading = false,
  progress,
  auditId,
  demonstratedFlagId,
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const rootRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>('ALL')
  const [pageFilter, setPageFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<string | null>(null)
  const [flagIndex, setFlagIndex] = useState(() =>
    clampFlagIndex(initialFlagIndex, model.flags.length)
  )
  const firstFindingTracked = useRef(false)

  useEffect(() => {
    if (firstFindingTracked.current || variant !== 'live' || model.flags.length === 0) return
    const flag = model.flags[flagIndex]
    if (!flag) return
    firstFindingTracked.current = true
    trackEvent('first_finding_viewed', {
      audit_id: auditId,
      check_id: flag.checkId ?? undefined,
      severity: flag.severity,
    })
  }, [variant, model.flags, auditId, flagIndex])

  const rubricCounts = useMemo(
    () =>
      countFlagsByRubric(model.flags, {
        pageFilter,
        severityFilter,
        impactFilter,
      }),
    [model.flags, pageFilter, severityFilter, impactFilter]
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
        rubricFilter: effectiveRubricFilter,
        pageFilter,
        severityFilter,
        impactFilter,
      }),
    [model.flags, effectiveRubricFilter, pageFilter, severityFilter, impactFilter]
  )

  const flagCount = filteredFlags.length
  const safeFlagIndex = clampFlagIndex(flagIndex, flagCount)

  useEffect(() => {
    setFlagIndex(0)
  }, [effectiveRubricFilter, pageFilter, severityFilter, impactFilter])

  useEffect(() => {
    setFlagIndex((current) => clampFlagIndex(current, filteredFlags.length))
  }, [filteredFlags.length, model.flags])

  const currentFlag = filteredFlags[safeFlagIndex] ?? filteredFlags[0]
  const pageScopedFlags = filterExplorerFlags(model.flags, {
    rubricFilter: effectiveRubricFilter,
    pageFilter: null,
    severityFilter,
    impactFilter,
  })
  const hasPages = pages.length > 1
  const availableSeverities = SEVERITY_ORDER.filter((severity) =>
    model.flags.some((flag) => flag.severity === severity)
  )
  const availableImpacts = IMPACT_TAG_ORDER.filter((impact) =>
    model.flags.some((flag) => flag.impactTag === impact)
  )

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
    rubric: f.rubric,
    impactTag: f.impactTag,
    severity: f.severity,
    hasFixPrompt: f.hasFixPrompt,
  }))

  const scoreHeader = (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-3">
      <ScoreRingGauge
        score={model.score}
        size="sm"
        loading={loading && model.score == null}
        progress={progress}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <RubricTabs
          rubricFilter={effectiveRubricFilter}
          onRubricChange={setRubricFilter}
          counts={rubricCounts}
          total={Object.values(rubricCounts).reduce((a, b) => a + b, 0)}
        />
      </div>
    </div>
  )

  const secondaryFilters = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="flag-severity-filter">Filter by severity</label>
        <select
          id="flag-severity-filter"
          value={severityFilter ?? ''}
          onChange={(event) => setSeverityFilter(event.target.value || null)}
          className="min-h-9 rounded-full border border-border/60 bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <option value="">All severities</option>
          {availableSeverities.map((severity) => (
            <option key={severity} value={severity}>{severityLabel(severity)}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="flag-impact-filter">Filter by impact</label>
        <select
          id="flag-impact-filter"
          value={impactFilter ?? ''}
          onChange={(event) => setImpactFilter(event.target.value || null)}
          className="min-h-9 rounded-full border border-border/60 bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <option value="">All impacts</option>
          {availableImpacts.map((impact) => (
            <option key={impact} value={impact}>{impactTagLabel(impact)}</option>
          ))}
        </select>
      </div>
      {hasPages ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill
            size="sm"
            icon={Globe}
            active={pageFilter === null}
            onClick={() => setPageFilter(null)}
          >
            {REPORT_COPY.explorer.allPages} ({pageScopedFlags.length})
          </FilterPill>
          {pages.map((page) => {
            const count = pageScopedFlags.filter((f) => f.pageUrl === page.url).length
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
      ) : null}
    </div>
  )

  const listPane = (
    <div className="min-w-0 space-y-3 lg:max-h-[calc(100vh-var(--header-offset)-5rem)] lg:overflow-y-auto lg:pr-2 scrollbar-thin">
      {secondaryFilters}
      {flagCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noMatchFilter}
        </p>
      ) : (
        <ReportFixLoop
          flags={fixLoopFlags}
          selectedFlagId={currentFlag?.id}
          onSelectFlag={goToFlag}
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
        flagCount={flagCount}
        onPrevious={showPrevious}
        onNext={showNext}
        showFeedback={showFeedback}
        aiLocked={aiLocked}
        aiEnhancementPending={aiEnhancementPending}
        signUpHref={signUpHref}
        onSelectFlag={goToFlag}
        compact={config.compact}
        demonstratedFlagId={demonstratedFlagId}
        variant={variant}
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
            'lg:sticky lg:top-[calc(var(--header-offset)+1rem)] lg:max-h-[calc(100vh-var(--header-offset)-2rem)] lg:overflow-y-auto lg:border-t-0 lg:pr-2 lg:pt-0 lg:self-start scrollbar-thin'
          )}
        >
          {detailPane}
        </div>
      </div>
    </div>
  )

  const shellClass = cn(
    'overflow-clip rounded-card glass-surface shadow-card',
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
