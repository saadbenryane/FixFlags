'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import {
  FlagDetailPane,
} from '@/components/report/ReportExplorerDetail'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  initialExplorerFlagIndex,
  type RubricFilter,
} from '@/lib/report/explorer-filters'
import type { JourneyPage } from '@/components/audit/JourneyBar'
import { focusFlagDetail } from '@/lib/report/scroll-to-section'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import { trackEvent } from '@/lib/analytics/events'
import { IMPACT_TAG_ORDER, RUBRIC_ORDER, SEVERITY_ORDER, type RubricName } from '@/lib/audit/constants'
import { cn } from '@/lib/utils'
import { usePreviewEvidence } from '@/components/report/preview-evidence-context'
import type { ReportOwnerActionContext } from '@/components/report/FlagDetailPanel'

function firstCategory(counts: Record<RubricName, number>): RubricName {
  return RUBRIC_ORDER.find((rubric) => counts[rubric] > 0) ?? 'MESSAGE'
}

function resolveCategory(
  current: RubricFilter,
  counts: Record<RubricName, number>,
): RubricFilter {
  if (current === 'ALL') return 'ALL'
  if (counts[current] > 0) return current
  return firstCategory(counts)
}

interface ReportExplorerProps {
  model: ReportExplorerModel
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
  ownerActionContext?: ReportOwnerActionContext
}

export function ReportExplorer({
  model,
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
  ownerActionContext,
}: ReportExplorerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const visibleDemonstratedFlagId =
    demonstratedFlagId ??
    (aiLocked ? model.flags.find((flag) => flag.hasFixPrompt)?.id : undefined)
  const defaultRubric: RubricFilter = 'ALL'
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>(
    defaultRubric,
  )
  const [pageFilter, setPageFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const initialIndex = initialExplorerFlagIndex(
    model.flags,
    initialFlagIndex,
    visibleDemonstratedFlagId
  )
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(
    model.flags[initialIndex]?.id ?? null
  )
  const { setSelection } = usePreviewEvidence()
  const demonstratedSelectionApplied = useRef(false)
  const urlStateLoaded = useRef(false)

  const writeExplorerUrl = useCallback((state: {
    flag: string | null
    rubric: RubricFilter
    severity: string | null
    impact: string | null
    page: string | null
  }) => {
    // Marketing emulations have no live audit id. Writing ?flag= onto `/`
    // hijacks the homepage URL while the curated story plays.
    if (typeof window === 'undefined' || !auditId) return
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
  }, [auditId])

  const applyExplorerUrlState = useCallback((search: string) => {
    const params = new URLSearchParams(search)
    const requestedRubric = params.get('rubric')
    const nextRubric: RubricFilter =
      requestedRubric === 'MESSAGE' ||
      requestedRubric === 'EXPERIENCE' ||
      requestedRubric === 'REACH'
        ? requestedRubric
        : defaultRubric
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
  }, [defaultRubric, model.flags, pages, visibleDemonstratedFlagId, writeExplorerUrl])

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

  useEffect(() => {
    setSelection({
      flagId: selectedFlagId,
      highlights: selectedFlagId
        ? model.allHighlights.filter((highlight) => highlight.flagId === selectedFlagId)
        : [],
    })
  }, [model.allHighlights, selectedFlagId, setSelection])

  useOneShotEvent(
    'first_finding_viewed',
    auditId!,
    () => {
      if (model.flags.length === 0) return null
      if (visibleDemonstratedFlagId && selectedFlagId !== visibleDemonstratedFlagId) return null
      const flag = model.flags.find((candidate) => candidate.id === selectedFlagId)
      if (!flag) return null
      return { check_id: flag.checkId ?? undefined, severity: flag.severity }
    },
    [model.flags, auditId, selectedFlagId, visibleDemonstratedFlagId],
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

  const effectiveRubricFilter = resolveCategory(rubricFilter, rubricCounts)

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
    if (!auditId || !currentFlag) return
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
  }, [auditId, currentFlag, model.flags])

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
      requestAnimationFrame(() => {
        focusFlagDetail(detailRef.current, detailHeadingRef.current)
      })
    },
    [effectiveRubricFilter, filteredFlags, impactFilter, pageFilter, severityFilter, writeExplorerUrl]
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

  const listPane = (
    <div className="min-w-0 list-none @[40rem]/pane:min-h-0 @[40rem]/pane:overflow-y-auto @[40rem]/pane:pr-2 scrollbar-thin [&_ul]:list-none [&_li]:list-none">
      <div className="mb-3 border-b border-border/30 pb-3">
        <h2 className="text-sm font-semibold text-foreground">Your priorities</h2>
        <p className="text-xs text-muted-foreground">Ranked by customer impact</p>
      </div>
      {flagCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noMatchFilter}
        </p>
      ) : (
        <>
          <ReportFixLoop
            flags={showAll ? fixLoopFlags : fixLoopFlags.slice(0, 5)}
            selectedFlagId={currentFlag?.id}
            onSelectFlag={goToFlag}
            loading={loading}
          />
          {fixLoopFlags.length > 5 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 min-h-11 w-full rounded-control px-3 text-sm font-medium text-muted-foreground hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">{showAll ? 'Show fewer' : `Show more (${fixLoopFlags.length - 5})`}</button> : null}
        </>
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
        demonstratedFlagId={visibleDemonstratedFlagId}
        ownerActionContext={ownerActionContext}
        headingRef={detailHeadingRef}
      />
    ) : (
      <p className="text-sm text-muted-foreground">
        {loading ? REPORT_COPY.explorer.flagsAppear : REPORT_COPY.explorer.selectFlag}
      </p>
    )

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={`Fix list with ${model.flags.length} flags`}
      className={cn('flex h-full min-h-0 min-w-0 flex-col gap-3.5', className)}
    >
      <div className="grid min-h-0 flex-1 gap-5 @[40rem]/pane:grid-cols-[minmax(13rem,32%)_minmax(0,1fr)]">
        {listPane}
        <div
          ref={detailRef}
          id="selected-flag-detail"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 border-t border-border/30 pt-5 scrollbar-thin @[40rem]/pane:min-h-0 @[40rem]/pane:overflow-y-auto @[40rem]/pane:border-t-0 @[40rem]/pane:pr-1 @[40rem]/pane:pt-0"
        >
          {detailPane}
        </div>
      </div>
    </div>
  )
}
