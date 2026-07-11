'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { FlagCard } from '@/components/audit/FlagCard'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { rubricLabel, cn } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { JourneyPage } from '@/components/audit/JourneyBar'

interface RubricRow {
  id: string
  name: string
  grade: string | null
  score: number | null
  summary: string
  flags: RankableFlag[]
}

interface Props {
  rubric: RubricComputed
  rubricRow: RubricRow
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
  showFlagList?: boolean
  pages?: JourneyPage[]
  /** Controlled open state. Omit to let the card manage its own (uncontrolled). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RubricCard({
  rubric,
  rubricRow,
  showFeedback = true,
  aiLocked = false,
  signUpHref,
  showFlagList = true,
  pages,
  open: openProp,
  onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const label = rubricLabel(rubric.name)
  const flagCount = rubric.flagCount
  const hasSummary = rubricRow.summary.trim().length > 0

  if (flagCount === 0 && rubric.status === 'PASS') {
    return null
  }

  return (
    <Card
      id={`rubric-${rubric.name}`}
      className={cn(
        'scroll-mt-[var(--header-offset)] border-0 shadow-card',
        rubric.status === 'BLOCKED' && 'ring-1 ring-destructive/20',
        rubric.status === 'NEEDS_ATTENTION' && 'ring-1 ring-grade-C/20'
      )}
    >
      <CardHeader className="pb-3">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`rubric-panel-${rubric.name}`}
          className="flex min-h-11 w-full items-start justify-between gap-4 text-left"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <RubricStatusBadge status={rubric.status} size="md" className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{label}</span>
                {!open && flagCount > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {flagCount} Flag{flagCount !== 1 ? 's' : ''}
                    {rubric.criticalCount > 0 && (
                      <span className="text-destructive ml-1">
                        ({rubric.criticalCount} critical)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <ScoreDisplay
                  grade={rubricRow.grade}
                  score={rubricRow.score}
                  variant="compact"
                  size="sm"
                />
                {!open && hasSummary && !aiLocked && (
                  <p className="text-sm leading-snug text-muted-foreground text-pretty sm:line-clamp-2">
                    {rubricRow.summary}
                  </p>
                )}
              </div>
            </div>
          </div>
          {open ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent id={`rubric-panel-${rubric.name}`} className="pt-0 space-y-3">
          {aiLocked ? (
            <LockedContentTeaser
              label="Rubric analysis - create a free account to view"
              signUpHref={signUpHref}
            />
          ) : hasSummary ? (
            <p className="text-sm text-muted-foreground leading-snug text-pretty">{rubricRow.summary}</p>
          ) : null}

          {showFlagList ? (
            rubricRow.flags.length > 0 ? (
              <Surface variant="nested" className="overflow-hidden p-0">
                {pages && pages.length > 1 ? (
                  (() => {
                    const grouped = new Map<string, RankableFlag[]>()
                    for (const flag of rubricRow.flags) {
                      const key = flag.pageUrl ?? '__primary__'
                      const arr = grouped.get(key) ?? []
                      arr.push(flag)
                      grouped.set(key, arr)
                    }
                    const entries = Array.from(grouped.entries())
                    return entries.map(([pageUrl, flags], gi) => {
                      const page = pages.find((p) => p.url === pageUrl)
                      const label = page
                        ? (() => {
                            try {
                              const path = new URL(page.url).pathname
                              return path === '/' ? 'Homepage' : path.split('/').filter(Boolean)[0] ?? page.role
                            } catch { return page.role }
                          })()
                        : 'Primary'
                      return (
                        <div key={pageUrl} className={gi > 0 ? 'border-t border-border/30' : ''}>
                          <div className="px-3 py-1.5 bg-muted/30">
                            <span className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
                              {label}
                            </span>
                          </div>
                          {flags.map((flag) => (
                            <FlagCard
                              key={flag.id}
                              flag={flag}
                              showFeedback={showFeedback}
                              variant="row"
                            />
                          ))}
                        </div>
                      )
                    })
                  })()
                ) : (
                  rubricRow.flags.map((flag) => (
                    <FlagCard
                      key={flag.id}
                      flag={flag}
                      showFeedback={showFeedback}
                      variant="row"
                    />
                  ))
                )}
              </Surface>
            ) : rubricRow.grade === 'A' ? (
              <p className="text-sm text-grade-A font-medium">No Flags in this rubric</p>
            ) : rubricRow.grade === null ? (
              <p className="text-sm text-muted-foreground">
                This rubric could not be assessed from the available evidence.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No individual Flags listed, see the rubric summary above.
              </p>
            )
          ) : (
            flagCount > 0 && (
              <p className="text-sm text-muted-foreground">
                <Link href="#report-flags" className="text-link underline-offset-2 hover:underline">
                  See {flagCount} Flag{flagCount !== 1 ? 's' : ''} above
                </Link>
              </p>
            )
          )}
        </CardContent>
      )}
    </Card>
  )
}
