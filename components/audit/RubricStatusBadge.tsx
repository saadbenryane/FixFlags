'use client'

import { cn, rubricStatusColor } from '@/lib/utils'

interface Props {
  status: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export function RubricStatusBadge({ status, label, size = 'md', className }: Props) {
  const displayLabel = label ?? status.replace(/_/g, ' ')
  return (
    <span
      className={cn(
        'rounded-md border font-semibold whitespace-nowrap',
        rubricStatusColor(status),
        SIZE_CLASSES[size],
        className
      )}
    >
      {displayLabel}
    </span>
  )
}
