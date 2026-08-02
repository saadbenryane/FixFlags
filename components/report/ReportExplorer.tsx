'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import {
  FlagDetailPane,
  RubricTabs,
} from '@/components/report/ReportExplorerDetail'
import { FilterPill } from '@/components/ui/filter-pill'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  initialExplorerFlagIndex,
  pageFilterLabel,
  resolveRubricFilter,
  type RubricFilter,
} from '@/lib/report/explorer-filters'
import type { JourneyPage } from '@/components/audit/JourneyBar'
import { scrollToReportSection } from '@/lib/report/scroll-to-section'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import { trackEvent } from '@/lib/analytics/events'
import { IMPACT_TAG_ORDER, SEVERITY_ORDER } from '@/lib/audit/constants'
import { impactTagLabel, severityLabel, cn } from '@/lib/utils'

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
  auditId,
  demonstratedFlagId,
}: ReportExplorerProps) {
  const config = VARIANT_CONFIG[variant]
  const rootRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>('ALL')
  const [pageFilter, setPageFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<string | null>(null)
  const visibleDemonstratedFlagId =
    demonstratedFlagId ??
    (aiLocked ? model.flags.find((flag) => flag.hasFixPrompt)?.id : undefined)
  const initialIndex = initialExplorerFlagIndex(
    model.flags,
    initialFlagIndex,
    visibleDemonstratedFlagId
  )
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(
    model.flags[initialIndex]?.id ?? null
  )
  const demonstratedSelectionApplied = useRef(false)
  const urlStateLoaded = useRef(false)

  const writeExplorerUrl = useCallback((state: {
    flag: string | null
    rubric: RubricFilter
    severity: string | null
    impact: string | null
    page: string | null
  }) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const values = {
      flag: state.flag,
      rubric: state.rubric === 'ALL' ? null : state.rubric,
      severity: state.severity,
      impact: state.impact,
      page: state.page,
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  const applyExplorerUrlState = useCallback((search: string) => {
    const params = new URLSearchParams(search)
    const requestedRubric = params.get('rubric')
    const nextRubric: RubricFilter =
      requestedRubric === 'MESSAGE' ||
      requestedRubric === 'EXPERIENCE' ||
      requestedRubric === 'REACH'
        ? requestedRubric
        : 'ALL'
    const requestedSeverity = params.get('severity')
    const nextSeverity = SEVERITY_ORDER.includes(
      requestedSeverity as (typeof SEVERITY_ORDER)[number]
    ) ? requestedSeverity : null
    const requestedImpact = params.get('impact')
    const nextImpact = IMPACT_TAG_ORDER.includes(
      requestedImpact as (typeof IMPACT_TAG_ORDER)[number]
    ) ? requestedImpact : null
    const requestedPage = params.get('page')
    const nextPage = requestedPage && pages.some((page) => page.url === requestedPage)
      ? requestedPage
      : null
    const visible = filterExplorerFlags(model.flags, {
      rubricFilter: nextRubric,
      pageFilter: nextPage,
      severityFilter: nextSeverity,
      impactFilter: nextImpact,
    })
    const requestedFlag = params.get('flag')
    const requestedVisibleFlag = visible.find((flag) => flag.id === requestedFlag)
    const nextFlag =
      requestedVisibleFlag?.id ??
      (requestedFlag
        ? visible[0]?.id
        : visible.find((flag) => flag.id === visibleDemonstratedFlagId)?.id) ??
      visible[0]?.id ??
      null
    demonstratedSelectionApplied.current = Boolean(
      requestedFlag || visible.some((flag) => flag.id === visibleDemonstratedFlagId)
    )
    setRubricFilter(nextRubric)
    setSeverityFilter(nextSeverity)
    setImpactFilter(nextImpact)
    setPageFilter(nextPage)
    setSelectedFlagId(nextFlag)
    writeExplorerUrl({
      flag: nextFlag,
      rubric: nextRubric,
      severity: nextSeverity,
      impact: nextImpact,
      page: nextPage,
    })
  }, [model.flags, pages, visibleDemonstratedFlagId, writeExplorerUrl])

  useEffect(() => {
    if (urlStateLoaded.current || typeof window === 'undefined') return
    urlStateLoaded.current = true
    applyExplorerUrlState(window.location.search)
  }, [applyExplorerUrlState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      applyExplorerUrlState(window.location.search)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyExplorerUrlState])

  useOneShotEvent(
    'first_finding_viewed',
    auditId!,
    () => {
      if (variant !== 'live' || model.flags.length === 0) return null
      if (visibleDemonstratedFlagId && selectedFlagId !== visibleDemonstratedFlagId) return null
      const flag = model.flags.find((candidate) => candidate.id === selectedFlagId)
      if (!flag) return null
      return { check_id: flag.checkId ?? undefined, severity: flag.severity }
    },
    [variant, model.flags, auditId, selectedFlagId, visibleDemonstratedFlagId],
  )

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

  useEffect(() => {
    if (
      demonstratedSelectionApplied.current ||
      !visibleDemonstratedFlagId ||
      !model.flags.some((flag) => flag.id === visibleDemonstratedFlagId)
    ) return
    demonstratedSelectionApplied.current = true
    setSelectedFlagId(visibleDemonstratedFlagId)
    writeExplorerUrl({
      flag: visibleDemonstratedFlagId,
      rubric: effectiveRubricFilter,
      severity: severityFilter,
      impact: impactFilter,
      page: pageFilter,
    })
  }, [
    effectiveRubricFilter,
    impactFilter,
    model.flags,
    pageFilter,
    severityFilter,
    visibleDemonstratedFlagId,
    writeExplorerUrl,
  ])

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
  const selectedIndex = filteredFlags.findIndex((flag) => flag.id === selectedFlagId)
  const safeFlagIndex = clampFlagIndex(selectedIndex, flagCount)
  const currentFlag = filteredFlags[safeFlagIndex] ?? filteredFlags[0]

  useEffect(() => {
    if (variant !== 'live' || !auditId || !currentFlag) return
    const storageKey = `fixflags:event:flag_detail_viewed:${auditId}:${currentFlag.id}`
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(storageKey)) return
    if (typeof window !== 'undefined') window.sessionStorage.setItem(storageKey, '1')
    trackEvent('flag_detail_viewed', {
      audit_id: auditId,
      flag_id: currentFlag.id,
      check_id: currentFlag.checkId ?? undefined,
      severity: currentFlag.severity,
      surface: 'focused',
      item_position: model.flags.findIndex((flag) => flag.id === currentFlag.id) + 1 || undefined,
    })
  }, [variant, auditId, currentFlag, model.flags])

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
    const next = filteredFlags[(safeFlagIndex - 1 + flagCount) % flagCount]
    if (!next) return
    setSelectedFlagId(next.id)
    writeExplorerUrl({
      flag: next.id,
      rubric: effectiveRubricFilter,
      severity: severityFilter,
      impact: impactFilter,
      page: pageFilter,
    })
  }, [effectiveRubricFilter, filteredFlags, flagCount, impactFilter, pageFilter, safeFlagIndex, severityFilter, writeExplorerUrl])

  const showNext = useCallback(() => {
    if (flagCount <= 1) return
    const next = filteredFlags[(safeFlagIndex + 1) % flagCount]
    if (!next) return
    setSelectedFlagId(next.id)
    writeExplorerUrl({
      flag: next.id,
      rubric: effectiveRubricFilter,
      severity: severityFilter,
      impact: impactFilter,
      page: pageFilter,
    })
  }, [effectiveRubricFilter, filteredFlags, flagCount, impactFilter, pageFilter, safeFlagIndex, severityFilter, writeExplorerUrl])

  const goToFlag = useCallback(
    (flagId: string) => {
      if (!filteredFlags.some((flag) => flag.id === flagId)) return
      setSelectedFlagId(flagId)
      writeExplorerUrl({
        flag: flagId,
        rubric: effectiveRubricFilter,
        severity: severityFilter,
        impact: impactFilter,
        page: pageFilter,
      })
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => {
          scrollToReportSection('selected-flag-detail')
          detailHeadingRef.current?.focus({ preventScroll: true })
        })
      }
    },
    [effectiveRubricFilter, filteredFlags, impactFilter, pageFilter, severityFilter, writeExplorerUrl]
  )

  const applyFilters = useCallback((next: {
    rubric?: RubricFilter
    severity?: string | null
    impact?: string | null
    page?: string | null
  }) => {
    const rubric = next.rubric ?? effectiveRubricFilter
    const severity = next.severity === undefined ? severityFilter : next.severity
    const impact = next.impact === undefined ? impactFilter : next.impact
    const page = next.page === undefined ? pageFilter : next.page
    const visible = filterExplorerFlags(model.flags, {
      rubricFilter: rubric,
      pageFilter: page,
      severityFilter: severity,
      impactFilter: impact,
    })
    const flag = visible[0]?.id ?? null
    if (next.rubric !== undefined) setRubricFilter(next.rubric)
    if (next.severity !== undefined) setSeverityFilter(next.severity)
    if (next.impact !== undefined) setImpactFilter(next.impact)
    if (next.page !== undefined) setPageFilter(next.page)
    setSelectedFlagId(flag)
    writeExplorerUrl({ flag, rubric, severity, impact, page })
  }, [effectiveRubricFilter, impactFilter, model.flags, pageFilter, severityFilter, writeExplorerUrl])

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

  const fixLoopFlags: FixLoopFlagItem[] = useMemo(
    () =>
      filteredFlags.map((f) => ({
        id: f.id,
        title: f.title,
        rubric: f.rubric,
        impactTag: f.impactTag,
        severity: f.severity,
        hasFixPrompt: f.hasFixPrompt,
      })),
    [filteredFlags]
  )

  const scoreHeader = (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-3.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <RubricTabs
          rubricFilter={effectiveRubricFilter}
          onRubricChange={(rubric) => applyFilters({ rubric })}
          counts={rubricCounts}
          total={Object.values(rubricCounts).reduce((a, b) => a + b, 0)}
        />
      </div>
    </div>
  )

  const secondaryFilters = (
    <div className="space-y-2 lg:hidden">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="flag-severity-filter">Filter by severity</label>
        <select
          id="flag-severity-filter"
          value={severityFilter ?? ''}
          onChange={(event) => applyFilters({ severity: event.target.value || null })}
          className="min-h-[44px] rounded-full border border-border/60 bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          onChange={(event) => applyFilters({ impact: event.target.value || null })}
          className="min-h-[44px] rounded-full border border-border/60 bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
            onClick={() => applyFilters({ page: null })}
          >
            {REPORT_COPY.explorer.allPages} ({pageScopedFlags.length})
          </FilterPill>
          {pages.map((page) => {
            const count = pageScopedFlags.filter((f) => f.pageUrls.includes(page.url)).length
            if (count === 0) return null
            const label = pageFilterLabel(page.url, page.role)
            return (
              <FilterPill
                size="sm"
                key={page.url}
                active={pageFilter === page.url}
                onClick={() => applyFilters({ page: pageFilter === page.url ? null : page.url })}
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
    <div className="min-w-0 list-none space-y-3.5 lg:max-h-[calc(100vh-var(--header-offset)-5rem)] lg:overflow-y-auto lg:pr-2 scrollbar-thin [&_ul]:list-none [&_li]:list-none">
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
        demonstratedFlagId={visibleDemonstratedFlagId}
        variant={variant}
        headingRef={detailHeadingRef}
      />
    ) : (
      <p className="text-sm text-muted-foreground">
        {loading ? REPORT_COPY.explorer.flagsAppear : REPORT_COPY.explorer.selectFlag}
      </p>
    )

  const masterDetail = (
    <div className="space-y-5">
      {scoreHeader}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(19rem,40%)_minmax(0,1fr)]">
        {listPane}
        <div
          ref={detailRef}
          id="selected-flag-detail"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            'min-w-0 scroll-mt-[var(--report-chrome-offset)] border-t border-border/30 pt-6',
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
    variant === 'hero' && 'shadow-raised',
    className
  )

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={`Fix list with ${model.flags.length} flags`}
      className={cn(config.ownShell ? shellClass : className)}
    >
      <div className={cn(variant === 'hero' ? 'bg-muted/10 p-4 sm:p-5' : 'p-4 sm:p-6')}>
        <h2 className="sr-only">Flags</h2>
        {masterDetail}
      </div>
    </div>
  )
}
