'use client'

import { Badge } from '@/components/ui/badge'
import { cn, rubricStatusColor, severityColor, severityLabel } from '@/lib/utils'
import type { ReactNode } from 'react'

export type StatusKind = 'rubric' | 'severity'

const STATUS_COLOR: Record<StatusKind, (status: string) => string> = {
  rubric: rubricStatusColor,
  severity: severityColor,
}

function defaultLabel(kind: StatusKind, status: string): string {
  if (kind === 'severity') return severityLabel(status)
  return status.replace(/_/g, ' ')
}

interface StatusBadgeProps {
  kind: StatusKind
  status: string
  label?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Single status-badge surface for both rubric and severity states. */
export function StatusBadge({ kind, status, label, size = 'sm', className }: StatusBadgeProps) {
  const displayLabel = label ?? defaultLabel(kind, status)
  return (
    <Badge
      variant="outline"
      size={size}
      className={cn(STATUS_COLOR[kind](status), className)}
    >
      {displayLabel}
    </Badge>
  )
}
