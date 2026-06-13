import { cn, severityColor } from '@/lib/utils'

interface Props {
  severity: string
  className?: string
}

export function SeverityBadge({ severity, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-label border border-transparent',
        severityColor(severity),
        className
      )}
    >
      {severity}
    </span>
  )
}
