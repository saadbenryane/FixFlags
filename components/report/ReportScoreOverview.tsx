'use client'

import { PipelineStepsList } from '@/components/report/PipelineStepsList'
import { ReportFixLoop, type ReportFixLoopProps } from '@/components/report/ReportFixLoop'
import { ScoreStack } from '@/components/report/ScoreStack'
import type { PipelineStep, RubricScoreRow } from '@/lib/audit/report-pipeline-steps'
import { cn } from '@/lib/utils'

function ProgressPanel({
  fixLoop,
  pipelineSteps,
  label,
}: {
  fixLoop?: ReportFixLoopProps
  pipelineSteps?: PipelineStep[]
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 sm:mb-3">
        {label}
      </p>
      {fixLoop ? (
        <ReportFixLoop {...fixLoop} />
      ) : pipelineSteps ? (
        <PipelineStepsList steps={pipelineSteps} />
      ) : null}
    </div>
  )
}

export function ReportScoreOverview({
  score,
  rubricScores,
  pipelineSteps,
  fixLoop,
  scoreSize = 'md',
  compact = false,
  showProgress = true,
  layout = 'stacked',
  className,
}: {
  score: number | null
  rubricScores: RubricScoreRow[]
  pipelineSteps?: PipelineStep[]
  fixLoop?: ReportFixLoopProps
  scoreSize?: 'sm' | 'md' | 'lg'
  compact?: boolean
  showProgress?: boolean
  /** stacked: ring + bars, then progress below. split: ring+bars | progress side by side */
  layout?: 'stacked' | 'split'
  className?: string
}) {
  if (layout === 'split') {
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
          <ProgressPanel
            fixLoop={fixLoop}
            pipelineSteps={pipelineSteps}
            label="Fix loop"
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4 sm:gap-5', className)}>
      <ScoreStack
        score={score}
        rubricScores={rubricScores}
        scoreSize={scoreSize}
        compact={compact}
      />
      {showProgress && (
        <ProgressPanel fixLoop={fixLoop} pipelineSteps={pipelineSteps} label="Fix loop" />
      )}
    </div>
  )
}
