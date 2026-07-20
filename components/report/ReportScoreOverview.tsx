'use client'

import { PipelineStepsList } from '@/components/report/PipelineStepsList'
import { ReportFixLoop, type ReportFixLoopProps } from '@/components/report/ReportFixLoop'
import { ScoreStack } from '@/components/report/ScoreStack'
import type { PipelineStep, RubricScoreRow } from '@/lib/audit/report-pipeline-steps'
import { cn } from '@/lib/utils'

function ProgressPanel({
  fixLoop,
  pipelineSteps,
  loading,
}: {
  fixLoop?: ReportFixLoopProps
  pipelineSteps?: PipelineStep[]
  loading?: boolean
}) {
  return (
    <div className="min-w-0">
      {fixLoop ? (
        <ReportFixLoop {...fixLoop} loading={loading} />
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
  loading = false,
  progress,
  className,
}: {
  score: number | null
  rubricScores: RubricScoreRow[]
  pipelineSteps?: PipelineStep[]
  fixLoop?: ReportFixLoopProps
  scoreSize?: 'sm' | 'md'
  compact?: boolean
  showProgress?: boolean
  /** stacked: ring + bars, then progress below. split: ring+bars | progress side by side */
  layout?: 'stacked' | 'split'
  /** Render score + fix loop in an in-progress scanning state. */
  loading?: boolean
  /** Determinate scan progress (0-100) for the ring while loading. */
  progress?: number
  className?: string
}) {
  if (layout === 'split') {
    return (
      <div
        className={cn(
          'grid items-start gap-x-6 gap-y-3 sm:gap-x-10',
          showProgress
            ? 'grid-cols-[minmax(7.5rem,9rem)_minmax(0,1fr)] sm:grid-cols-[minmax(8.5rem,10rem)_minmax(0,1fr)]'
            : 'grid-cols-1',
          className
        )}
      >
        <ScoreStack
          score={score}
          rubricScores={rubricScores}
          scoreSize={scoreSize}
          compact={compact}
          loading={loading}
          progress={progress}
        />
        {showProgress && (
          <ProgressPanel
            fixLoop={fixLoop}
            pipelineSteps={pipelineSteps}
            loading={loading}
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
        loading={loading}
        progress={progress}
      />
      {showProgress && (
        <ProgressPanel fixLoop={fixLoop} pipelineSteps={pipelineSteps} loading={loading} />
      )}
    </div>
  )
}
