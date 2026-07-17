import * as React from 'react'
import { cn } from '@/lib/utils'

interface TerminalShellProps {
  label: React.ReactNode
  headerRight?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  /** Concentric radius when nested inside rounded-card */
  nested?: boolean
}

/**
 * Shared terminal chrome for code/prompt blocks; uses design tokens, not raw zinc.
 */
export function TerminalShell({
  label,
  headerRight,
  children,
  className,
  bodyClassName,
  nested = false,
}: TerminalShellProps) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-terminal-border bg-terminal shadow-card',
        nested ? 'rounded-nested-lg' : 'rounded-card',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-terminal-border px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-destructive/80" aria-hidden />
          <span className="h-2 w-2 shrink-0 rounded-full bg-warning/80" aria-hidden />
          <span className="h-2 w-2 shrink-0 rounded-full bg-success/80" aria-hidden />
          <span className="truncate meta-label text-terminal-muted sm:text-2xs">
            {label}
          </span>
        </div>
        {headerRight}
      </div>
      <div className={cn('text-terminal-foreground', bodyClassName)}>{children}</div>
    </div>
  )
}
