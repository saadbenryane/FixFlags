'use client'

import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import type { RubricScoreRow } from '@/lib/audit/report-pipeline-steps'
import { cn } from '@/lib/utils'

export function ScoreStack({
  score,
  rubricScores,
  scoreSize = 'md',
  compact = false,
}: {
  score: number | null
  rubricScores: RubricScoreRow[]
  scoreSize?: 'sm' | 'md' | 'lg'
  compact?: boolean
}) {
  const ringSize = compact ? 'sm' : scoreSize

  return (
    <div className={cn(compact ? 'space-y-2' : 'space-y-3')}>
      <div className="flex w-full justify-center">
        <ScoreRingGauge score={score} size={ringSize} />
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
