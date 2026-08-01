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
import { cn, rubricLabel } from '@/lib/utils'
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
          className="rounded-[var(--radius-control)] px-3 text-xs"
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
  compact = false,
  demonstratedFlagId,
  variant = 'live',
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
  compact?: boolean
  demonstratedFlagId?: string
  variant?: 'hero' | 'live'
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const showDesktop = Boolean(model.desktopScreenshot)
  const showMobile = Boolean(model.mobileScreenshot)
  const shareableFlag = isShareableCheck(flag.checkId)
  const isHero = variant === 'hero'

  return (
    <div className="min-w-0">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 text-base font-semibold leading-snug text-balance outline-none sm:text-lg"
          >
            {flag.title}
          </h3>
          <FlagNavigation total={flagCount} onPrevious={onPrevious} onNext={onNext} />
        </div>
        <div className="mt-1.5">
          <FlagMetaPills flag={flag} />
        </div>
      </header>

      <div className={cn(isHero && 'space-y-6', 'flex flex-col')}>
        {!shareableFlag && !isHero ? (
          <div className="order-2 mb-5 lg:order-1 lg:mb-5">
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
              className={cn(compact && 'lg:mb-0')}
            />
          </div>
        ) : null}
        {isHero && !shareableFlag ? (
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

        <div className={cn('order-1 lg:order-2', isHero && 'pt-2')}>
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
