'use client'

import { Badge } from '@/components/ui/badge'
import { cn, rubricStatusColor } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Props {
  status: string
  label?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RubricStatusBadge({ status, label, size = 'md', className }: Props) {
  const displayLabel = label ?? status.replace(/_/g, ' ')
  return (
    <Badge variant="outline" size={size} className={cn(rubricStatusColor(status), className)}>
      {displayLabel}
    </Badge>
  )
}
