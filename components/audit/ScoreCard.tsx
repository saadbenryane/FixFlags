import { ScoreDisplay } from '@/components/audit/ScoreDisplay'

interface ScoreCardProps {
  areaName?: string
  label?: string
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md'
  className?: string
  layout?: 'horizontal' | 'compact'
}

/** @deprecated Prefer ScoreDisplay directly. Kept for existing imports. */
export function ScoreCard({
  areaName,
  label,
  grade,
  score,
  size = 'md',
  className,
  layout = 'horizontal',
}: ScoreCardProps) {
  return (
    <ScoreDisplay
      areaName={areaName}
      label={label}
      grade={grade}
      score={score}
      size={size}
      variant={layout === 'compact' ? 'compact' : 'card'}
      className={className}
    />
  )
}
