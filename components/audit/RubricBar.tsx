'use client'

import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel, cn } from '@/lib/utils'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import type { RubricComputed } from '@/lib/audit/rubric'
import { Globe2, MessageSquare, Zap } from 'lucide-react'

const RUBRIC_ICONS: Record<string, typeof MessageSquare> = {
  MESSAGE: MessageSquare,
  EXPERIENCE: Zap,
  REACH: Globe2,
}

interface RubricRow {
  name: string
  score: number | null
  grade: string | null
}

interface Props {
  rubrics: RubricComputed[]
  rubricRows: RubricRow[]
  /** Audit still running: pending rubrics show Scanning, not failing. */
  loading?: boolean
}

export function RubricBar({ rubrics, rubricRows, loading = false }: Props) {
  const scoreByName = new Map(rubricRows.map((row) => [row.name, row.score] as const))

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      {RUBRIC_ORDER.map((name) => {
        const r = rubrics.find((x) => x.name === name)
        const score = scoreByName.get(name) ?? null
        const Icon = RUBRIC_ICONS[name]
        const label = rubricLabel(name)
        const scoreLabel = score == null ? 'N/A' : String(score)
        const pending = loading && (r?.flagCount ?? 0) === 0 && score == null
        const status = pending ? 'SCANNING' : r?.status

        return (
          <a
            key={name}
            href="#report-flags"
            className={cn(
              'group flex items-center gap-2 rounded-full border border-border/40 bg-card px-3 py-1.5',
              'transition-colors hover:border-border/70 hover:bg-accent/50'
            )}
          >
            {Icon && (
              <Icon
                className={cn('h-3.5 w-3.5 shrink-0', score != null ? '' : 'text-muted-foreground')}
                style={score != null ? { color: scoreToScanColor(score) } : undefined}
                aria-hidden
              />
            )}
            <span className="text-xs font-medium text-foreground">{label}</span>
            {score != null && (
              <span
                className="font-mono text-xs font-bold tabular-nums"
                style={{ color: scoreToScanColor(score) }}
              >
                {scoreLabel}
              </span>
            )}
            {status ? (
              <RubricStatusBadge
                status={status}
                size="sm"
                label={pending ? 'Scanning' : undefined}
                className="hidden sm:inline-flex"
              />
            ) : null}
          </a>
        )
      })}
    </div>
  )
}
