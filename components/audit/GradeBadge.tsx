import { ScoreDisplay } from '@/components/audit/ScoreDisplay'

interface Props {
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
  rubricName?: string
  className?: string
}

/** Compact inline grade pill. Use ScoreDisplay for richer layouts. */
export function GradeBadge({ grade, score, size = 'md', rubricName, className }: Props) {
  return (
    <ScoreDisplay
      rubricName={rubricName}
      grade={grade}
      score={score}
      size={size}
      variant="pill"
      className={className}
    />
  )
}
