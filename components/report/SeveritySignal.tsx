'use client'

import { CircleAlert, TriangleAlert, Info } from 'lucide-react'
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

const config: Record<string, { icon: typeof CircleAlert; color: string }> = {
  CRITICAL: { icon: CircleAlert, color: 'text-destructive' },
  IMPORTANT: { icon: TriangleAlert, color: 'text-warning' },
  POLISH: { icon: Info, color: 'text-info' },
}

export function SeveritySignal({ severity, className }: Props) {
  const label = severityLabel(severity)
  const entry = config[severity]
  if (!entry) {
    return <span className="sr-only">{label}</span>
  }
  const Icon = entry.icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            className={cn('inline-flex shrink-0 items-center justify-center', entry.color)}
          >
            <Icon
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
