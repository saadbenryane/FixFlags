'use client'

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RubricScoreRow } from '@/lib/audit/report-pipeline-steps'
import { SCORE_HELP } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function ScoreStack({
  score,
  rubricScores,
  scoreSize = 'md',
  compact = false,
  loading = false,
  progress,
}: {
  score: number | null
  rubricScores: RubricScoreRow[]
  scoreSize?: 'sm' | 'md'
  compact?: boolean
  loading?: boolean
  progress?: number
}) {
  const ringSize = compact ? 'md' : scoreSize

  return (
    <div className={cn(compact ? 'space-y-2' : 'space-y-3')}>
      <div className="relative flex w-full justify-center">
        <ScoreRingGauge score={score} size={ringSize} loading={loading} progress={progress} />
        {!loading && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="absolute right-0 top-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="How scores work"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs space-y-1.5 p-3 text-xs leading-relaxed">
                <p>{SCORE_HELP.short}</p>
                <Link
                  href={SCORE_HELP.faqHref}
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  Full scoring details
                </Link>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={cn(compact ? 'space-y-1' : 'space-y-2')}>
        {rubricScores.map((rubric) => (
          <RubricScoreBar
            key={rubric.name}
            name={rubric.name}
            score={rubric.score}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}
