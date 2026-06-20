'use client'

import { Globe2, MessageSquare, Zap } from 'lucide-react'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

const CARD_META = [
  { rubric: 'MESSAGE', icon: MessageSquare, tint: 'text-brand', wash: 'from-brand/10 via-brand/5 to-transparent' },
  { rubric: 'EXPERIENCE', icon: Zap, tint: 'text-success', wash: 'from-success/10 via-success/5 to-transparent' },
  { rubric: 'REACH', icon: Globe2, tint: 'text-info', wash: 'from-info/10 via-info/5 to-transparent' },
] as const

interface RubricOverviewStripProps {
  scores: SampleReportDisplay['rubricScores']
  summaries?: Record<string, string>
  onSelectRubric?: (rubric: string) => void
  layout?: 'horizontal' | 'vertical'
  className?: string
}

export function RubricOverviewStrip({
  scores,
  summaries,
  onSelectRubric,
  layout = 'horizontal',
  className,
}: RubricOverviewStripProps) {
  const isVertical = layout === 'vertical'
  const cardClass = cn(
    'relative overflow-hidden rounded-card bg-card p-3 sm:p-4',
    'border-0 shadow-card',
    isVertical && 'p-2.5 sm:p-3'
  )

  return (
    <div
      className={cn(
        isVertical ? 'flex flex-col gap-2' : 'grid gap-3 sm:grid-cols-3',
        className
      )}
    >
      {CARD_META.map(({ rubric, icon: Icon, tint, wash }) => {
        const copy = LANDING_PAGE.checkDimensions.cards.find(
          (c) => c.id === rubric.toLowerCase()
        )
        const row = scores.find((s) => s.name === copy?.title)
        const score = row?.score ?? null
        const scoreLabel = score == null ? '—' : String(score)
        const barWidth = score == null ? 0 : Math.min(100, score)

        const inner = (
          <>
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                wash
              )}
            />
            <div
              className={cn(
                'relative flex items-start justify-between gap-2',
                isVertical && 'items-center gap-3'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', tint)} aria-hidden />
                  <p className={cn('text-xs font-bold sm:text-sm', tint)}>{copy?.title}</p>
                </div>
                {!isVertical ? (
                  <p className="mt-1 text-xs leading-snug text-muted-foreground text-pretty">
                    {summaries?.[rubric] ?? copy?.question}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  'font-mono font-bold tabular-nums leading-none',
                  isVertical ? 'text-lg sm:text-xl' : 'text-2xl'
                )}
              >
                {scoreLabel}
              </span>
            </div>
            <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: score != null ? scoreToScanColor(score) : undefined,
                }}
              />
            </div>
          </>
        )

        if (onSelectRubric) {
          return (
            <button
              key={rubric}
              type="button"
              onClick={() => onSelectRubric(rubric)}
              className={cn(
                cardClass,
                'text-left transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
              )}
            >
              {inner}
            </button>
          )
        }

        return (
          <div key={rubric} className={cardClass}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
