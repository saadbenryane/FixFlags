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
  className?: string
}

export function RubricOverviewStrip({
  scores,
  summaries,
  onSelectRubric,
  className,
}: RubricOverviewStripProps) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {CARD_META.map(({ rubric, icon: Icon, tint, wash }) => {
        const copy = LANDING_PAGE.checkDimensions.cards.find(
          (c) => c.id === rubric.toLowerCase()
        )
        const row = scores.find((s) => s.name === copy?.title)
        const score = row?.score ?? 0

        const inner = (
          <>
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                wash
              )}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4 shrink-0', tint)} aria-hidden />
                  <p className={cn('text-sm font-bold', tint)}>{copy?.title}</p>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground text-pretty">
                  {summaries?.[rubric] ?? copy?.question}
                </p>
              </div>
              <span className="font-mono text-2xl font-bold tabular-nums leading-none">{score}</span>
            </div>
            <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, score)}%`, backgroundColor: scoreToScanColor(score) }}
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
              className="relative overflow-hidden rounded-card border border-border/50 bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {inner}
            </button>
          )
        }

        return (
          <div
            key={rubric}
            className="relative overflow-hidden rounded-card border border-border/50 bg-card p-4 shadow-sm"
          >
            {inner}
          </div>
        )
      })}
    </div>
  )
}
