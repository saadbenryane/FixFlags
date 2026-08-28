'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { ReportFixLoop, type FixLoopFlagItem } from '@/components/report/ReportFixLoop'
import {
  FlagDetailPane,
} from '@/components/report/ReportExplorerDetail'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { reviewPathLabel } from '@/lib/audit/url-identity'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  clampFlagIndex,
  countFlagsByRubric,
  filterExplorerFlags,
  initialExplorerFlagIndex,
  type RubricFilter,
} from '@/lib/report/explorer-filters'
import { focusFlagDetail } from '@/lib/report/scroll-to-section'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import { trackEvent } from '@/lib/analytics/events'
import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
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

export type ReportExplorerLayout = 'list-detail' | 'detail'

interface ReportExplorerProps {
  model: ReportExplorerModel
  className?: string
  initialFlagIndex?: number
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  loading?: boolean
  /** Optional audit id for funnel analytics on live reports. */
  auditId?: string
  demonstratedFlagId?: string
  ownerActionContext?: ReportOwnerActionContext
  /**
   * `list-detail` keeps the ranked Top Flags list (Product priorities).
   * `detail` is report-first: full-width Flag detail with prev/next only.
   */
  layout?: ReportExplorerLayout
  /** Hide the in-list Top Flags heading when a parent section owns the title. */
  hideListHeading?: boolean
  /** Resolve owner handoff context for the selected flag (Product page). */
  resolveOwnerActionContext?: (
    flagId: string
  ) => ReportOwnerActionContext | undefined
  /** Optional action beside the docked prompt row for the selected flag. */
  secondaryPromptAction?: (flagId: string) => ReactNode
}

export function ReportExplorer({
  model,
  className,
  initialFlagIndex = 0,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  loading = false,
  auditId,
  demonstratedFlagId,
  ownerActionContext,
  layout = 'list-detail',
  hideListHeading = false,
  resolveOwnerActionContext,
  secondaryPromptAction,
}: ReportExplorerProps) {
  const detailOnly = layout === 'detail'
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
  }) => {
    // Marketing emulations have no live audit id. Writing ?flag= onto `/`
    // hijacks the homepage URL while the curated story plays.
    if (typeof window === 'undefined' || !auditId) return
    const url = new URL(window.location.href)
    const values = {
      flag: state.flag,
      rubric: state.rubric === 'ALL' ? null : state.rubric,
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    url.searchParams.delete('severity')
    url.searchParams.delete('impact')
    url.searchParams.delete('page')
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
    const visible = filterExplorerFlags(model.flags, {
      rubricFilter: nextRubric,
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
    setSelectedFlagId(nextFlag)
    writeExplorerUrl({
      flag: nextFlag,
      rubric: nextRubric,
    })
  }, [defaultRubric, model.flags, visibleDemonstratedFlagId, writeExplorerUrl])

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
    () => countFlagsByRubric(model.flags),
    [model.flags]
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
    })
  }, [
    effectiveRubricFilter,
    model.flags,
    visibleDemonstratedFlagId,
    writeExplorerUrl,
  ])

  const filteredFlags = useMemo(
    () =>
      filterExplorerFlags(model.flags, {
        rubricFilter: effectiveRubricFilter,
      }),
    [model.flags, effectiveRubricFilter]
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
    if (safeFlagIndex <= 0) return
    const next = filteredFlags[safeFlagIndex - 1]
    if (!next) return
    setSelectedFlagId(next.id)
    writeExplorerUrl({
      flag: next.id,
      rubric: effectiveRubricFilter,
    })
  }, [effectiveRubricFilter, filteredFlags, safeFlagIndex, writeExplorerUrl])

  const showNext = useCallback(() => {
    if (safeFlagIndex >= flagCount - 1) return
    const next = filteredFlags[safeFlagIndex + 1]
    if (!next) return
    setSelectedFlagId(next.id)
    writeExplorerUrl({
      flag: next.id,
      rubric: effectiveRubricFilter,
    })
  }, [effectiveRubricFilter, filteredFlags, flagCount, safeFlagIndex, writeExplorerUrl])

  const goToFlag = useCallback(
    (flagId: string) => {
      if (!filteredFlags.some((flag) => flag.id === flagId)) return
      setSelectedFlagId(flagId)
      writeExplorerUrl({
        flag: flagId,
        rubric: effectiveRubricFilter,
      })
      requestAnimationFrame(() => {
        focusFlagDetail(detailRef.current, detailHeadingRef.current)
      })
    },
    [effectiveRubricFilter, filteredFlags, writeExplorerUrl]
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
        pathLabel: (() => {
          const raw = f.pageUrls[0] ?? f.pageUrl
          return raw ? REPORT_COPY.explorer.onPath(reviewPathLabel(raw)) : null
        })(),
        occurrenceCount: f.occurrenceCount,
      })),
    [filteredFlags]
  )

  const effectiveOwnerActionContext =
    (currentFlag && resolveOwnerActionContext?.(currentFlag.id)) ??
    ownerActionContext
  const promptSecondaryAction =
    currentFlag && secondaryPromptAction
      ? secondaryPromptAction(currentFlag.id)
      : null

  const listPane = (
    <div className="flex min-h-0 min-w-0 flex-col @[40rem]/pane:h-full">
      <div className="min-h-0 flex-1 list-none overflow-y-auto scrollbar-thin @[40rem]/pane:pr-2 [&_ul]:list-none [&_li]:list-none">
        {hideListHeading ? null : (
          <div className="mb-3 border-b border-border/30 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                {REPORT_COPY.explorer.topFlagsTitle}
              </h2>
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span>{model.coverageSentence ?? REPORT_COPY.explorer.prioritiesHint}</span>
                {model.coveragePartial ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          aria-label={REPORT_COPY.explorer.coveragePartialLabel}
                        >
                          <Info className="h-3 w-3" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-xs p-3">
                        <p className="text-xs text-muted-foreground">
                          {REPORT_COPY.explorer.coveragePartialTooltip}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </p>
            </div>
          </div>
        )}
        {flagCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noMatchFilter}
          </p>
        ) : (
          <ReportFixLoop
            flags={showAll ? fixLoopFlags : fixLoopFlags.slice(0, 5)}
            selectedFlagId={currentFlag?.id}
            onSelectFlag={goToFlag}
            loading={loading}
          />
        )}
      </div>
      {flagCount > 0 && fixLoopFlags.length > 5 ? (
        <footer
          data-flag-list-footer
          className="shrink-0 border-t border-border/30 pt-3"
        >
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="flex min-h-11 w-full items-center justify-center rounded-control px-3 text-sm font-medium text-muted-foreground hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {showAll ? 'Show fewer' : `Show more (${fixLoopFlags.length - 5})`}
          </button>
        </footer>
      ) : null}
    </div>
  )

  const detailPane =
    currentFlag && flagCount > 0 ? (
      <FlagDetailPane
        model={model}
        flag={currentFlag}
        flagCount={flagCount}
        flagPosition={safeFlagIndex + 1}
        onPrevious={showPrevious}
        onNext={showNext}
        showFeedback={showFeedback}
        aiLocked={aiLocked}
        aiEnhancementPending={aiEnhancementPending}
        signUpHref={signUpHref}
        onSelectFlag={goToFlag}
        demonstratedFlagId={visibleDemonstratedFlagId}
        ownerActionContext={effectiveOwnerActionContext}
        headingRef={detailHeadingRef}
        secondaryPromptAction={promptSecondaryAction}
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
      {detailOnly ? (
        <div
          ref={detailRef}
          id="selected-flag-detail"
          aria-live="polite"
          aria-atomic="true"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {detailPane}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 @[40rem]/pane:grid-cols-[minmax(13rem,32%)_minmax(0,1fr)]">
          {listPane}
          <div
            ref={detailRef}
            id="selected-flag-detail"
            aria-live="polite"
            aria-atomic="true"
            className="flex min-h-0 min-w-0 flex-col border-t border-border/30 pt-5 @[40rem]/pane:border-t-0 @[40rem]/pane:pt-0"
          >
            {detailPane}
          </div>
        </div>
      )}
    </div>
  )
}
