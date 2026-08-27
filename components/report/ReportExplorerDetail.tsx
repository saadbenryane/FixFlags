'use client'

import type { RefObject } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { ScreenshotWithHighlights } from '@/components/audit/ScreenshotWithHighlights'
import {
  FlagDetailPanel,
  FlagMetaPills,
  FlagPromptRow,
  flagHasPromptChrome,
  isShareableCheck,
  type ReportOwnerActionContext,
} from '@/components/report/FlagDetailPanel'
import { FilterPill } from '@/components/ui/filter-pill'
import { Button } from '@/components/ui/button'
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

export function FlagDetailPane({
  model,
  flag,
  flagCount,
  flagPosition,
  onPrevious,
  onNext,
  showFeedback,
  aiLocked,
  aiEnhancementPending,
  signUpHref,
  onSelectFlag,
  demonstratedFlagId,
  ownerActionContext,
  headingRef,
}: {
  model: ReportExplorerModel
  flag: ReportExplorerModel['flags'][number]
  flagCount: number
  flagPosition: number
  onPrevious: () => void
  onNext: () => void
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  onSelectFlag: (flagId: string) => void
  demonstratedFlagId?: string
  ownerActionContext?: ReportOwnerActionContext
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const showDesktop = Boolean(model.desktopScreenshot)
  const showMobile = Boolean(model.mobileScreenshot)
  const shareableFlag = isShareableCheck(flag.checkId)
  const promptLocked = Boolean(aiLocked && flag.id !== demonstratedFlagId)
  const showPromptRow = flagHasPromptChrome(flag, {
    aiLocked: promptLocked,
    aiEnhancementPending,
  })

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div
        data-flag-detail-scroll
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin @[40rem]/pane:pr-1"
      >
        <header className="mb-5">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold leading-snug tracking-heading text-balance outline-none"
          >
            {flag.title}
          </h3>
          <div className="mt-2 flex items-center justify-between gap-3">
            <FlagMetaPills flag={flag} />
            {flagCount > 1 ? (
              <nav className="flex shrink-0 items-center gap-1" aria-label="Flag navigation">
                <span className="mr-1 font-mono text-2xs tabular-nums text-muted-foreground" aria-live="polite">
                  {flagPosition} of {flagCount}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  disabled={flagPosition <= 1}
                  aria-label="Previous flag"
                  className="border border-border/45 bg-background text-muted-foreground shadow-sm hover:text-foreground"
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  disabled={flagPosition >= flagCount}
                  aria-label="Next flag"
                  className="border border-border/45 bg-background text-muted-foreground shadow-sm hover:text-foreground"
                >
                  <ChevronRight aria-hidden />
                </Button>
              </nav>
            ) : null}
          </div>
        </header>

        <FlagDetailPanel
          flag={flag}
          showFeedback={showFeedback}
          aiLocked={promptLocked}
          aiEnhancementPending={aiEnhancementPending}
          signUpHref={signUpHref}
          previewMeta={model.previewMeta}
          ownerActionContext={ownerActionContext}
          hidePromptRow
          evidencePair={
            shareableFlag ? null : (
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
                flagVisual={
                  flag.visualUrl && flag.visualDevice && flag.visualType
                    ? {
                        url: flag.visualUrl,
                        device: flag.visualDevice,
                        type: flag.visualType,
                      }
                    : null
                }
              />
            )
          }
        />
      </div>
      {showPromptRow ? (
        <footer
          data-flag-prompt-footer
          className="shrink-0 border-t border-border/30 bg-background pt-3"
        >
          <FlagPromptRow
            flag={flag}
            aiLocked={promptLocked}
            aiEnhancementPending={aiEnhancementPending}
            signUpHref={signUpHref}
            ownerActionContext={ownerActionContext}
            polishPassPrompt={model.polishPassPrompt}
            aggregateLocked={Boolean(aiLocked)}
          />
        </footer>
      ) : null}
    </div>
  )
}
