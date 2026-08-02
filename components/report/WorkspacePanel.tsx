'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WorkspacePanelProps {
  children: ReactNode
  className?: string
  /** Optional mono section label above panel content */
  label?: string
}

export function WorkspacePanel({ children, className, label }: WorkspacePanelProps) {
  return (
    <div
      className={cn(
        'glass-surface shadow-card rounded-card px-3 py-3 sm:px-4 sm:py-4',
        className
      )}
    >
      {label ? (
        <p className="section-label mb-2 text-muted-foreground">{label}</p>
      ) : null}
      {children}
    </div>
  )
}
