'use client'

import { StatusBadge } from '@/components/audit/StatusBadge'
import type { ReactNode } from 'react'

interface Props {
  status: string
  label?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RubricStatusBadge({ status, label, size = 'md', className }: Props) {
  return (
    <StatusBadge kind="rubric" status={status} label={label} size={size} className={className} />
  )
}
