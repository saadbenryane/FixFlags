import { Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface LandingSectionHeaderProps {
  label?: string
  headline: string
  className?: string
  align?: 'center' | 'left'
  showLabel?: boolean
}

export function LandingSectionHeader({
  label,
  headline,
  className,
  align = 'center',
  showLabel = Boolean(label),
}: LandingSectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-prose text-left',
        className
      )}
    >
      {showLabel && label ? <p className="section-label">{label}</p> : null}
      <Heading as="h2">{headline}</Heading>
    </div>
  )
}
