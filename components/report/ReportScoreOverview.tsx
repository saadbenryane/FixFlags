'use client'

import { PipelineStepsList } from '@/components/report/PipelineStepsList'
import { ScoreStack } from '@/components/report/ScoreStack'
import type { PipelineStep, RubricScoreRow } from '@/lib/audit/report-pipeline-steps'
import { cn } from '@/lib/utils'

export function ReportScoreOverview({
  score,
  rubricScores,
  pipelineSteps,
  scoreSize = 'md',
  compact = false,
  showProgress = true,
  className,
}: {
  score: number | null
  rubricScores: RubricScoreRow[]
  pipelineSteps: PipelineStep[]
  scoreSize?: 'sm' | 'md' | 'lg'
  compact?: boolean
  showProgress?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid items-start gap-x-6 gap-y-3 sm:gap-x-10',
        showProgress
          ? 'grid-cols-[minmax(5.5rem,7rem)_minmax(0,1fr)] sm:grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)]'
          : 'grid-cols-1',
        className
      )}
    >
      <ScoreStack
        score={score}
        rubricScores={rubricScores}
        scoreSize={scoreSize}
        compact={compact}
      />
      {showProgress && (
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 sm:mb-3">
            Review progress
          </p>
          <PipelineStepsList steps={pipelineSteps} />
        </div>
      )}
    </div>
  )
}
