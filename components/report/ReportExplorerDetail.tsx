'use client'

import type { RefObject } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import {
  FlagDetailPanel,
  FlagMetaPills,
  isShareableCheck,
} from '@/components/report/FlagDetailPanel'
import { Button } from '@/components/ui/button'
import { FilterPill } from '@/components/ui/filter-pill'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import type { RubricFilter } from '@/lib/report/explorer-filters'
import { rubricLabel } from '@/lib/utils'
import { rubricIcon } from '@/lib/rubric-icons'

export function RubricTabs({
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
    { id: 'ALL', label: 'All Flags', count: total },
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
          className="min-h-11 rounded-[var(--radius-control)] px-3 text-xs"
        >
          {tab.label}
          <span className="ml-1.5 font-mono text-2xs tabular-nums opacity-70">{tab.count}</span>
        </FilterPill>
      ))}
    </div>
  )
}

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
        onClick={onNext}
        aria-label="Next flag"
        disabled={total <= 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function FlagDetailPane({
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
  demonstratedFlagId,
  headingRef,
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
  demonstratedFlagId?: string
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const showDesktop = Boolean(model.desktopScreenshot)
  const showMobile = Boolean(model.mobileScreenshot)
  const shareableFlag = isShareableCheck(flag.checkId)

  return (
    <div className="min-w-0">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 text-lg font-semibold leading-snug tracking-heading text-balance outline-none"
          >
            {flag.title}
          </h3>
          <FlagNavigation total={flagCount} onPrevious={onPrevious} onNext={onNext} />
        </div>
        <div className="mt-1.5">
          <FlagMetaPills flag={flag} />
        </div>
      </header>

      <div className="flex flex-col gap-5">
        {!shareableFlag ? (
          <ScreenshotWithHighlights
            host={model.displayHost}
            desktopScreenshot={model.desktopScreenshot}
            mobileScreenshot={model.mobileScreenshot}
            highlights={model.allHighlights}
            selectedFlagId={flag.id}
            onPinSelect={onSelectFlag}
            showDesktop={showDesktop}
            showMobile={showMobile}
            affectedDevices={flag.affectedDevices}
          />
        ) : null}

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
  )
}
