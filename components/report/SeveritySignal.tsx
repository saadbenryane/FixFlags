'use client'

import { CircleAlert } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, severityLabel } from '@/lib/utils'

interface Props {
  severity: string
  className?: string
}

/**
 * Compact severity signal for flag meta rows.
 * Single CircleAlert (no outer ring). Hover shows "Critical Flag" etc.
 */
export function SeveritySignal({ severity, className }: Props) {
  const label = severityLabel(severity)
  const isCritical = severity === 'CRITICAL'
  const isImportant = severity === 'IMPORTANT'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            className={cn(
              'inline-flex shrink-0 items-center justify-center',
              isCritical && 'text-destructive',
              isImportant && 'text-grade-D',
              !isCritical && !isImportant && 'text-muted-foreground/70',
            )}
          >
            <CircleAlert
              className={cn('h-5 w-5', className)}
              aria-hidden
              strokeWidth={2.25}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
