import { Badge } from '@/components/ui/badge'
import { cn, severityColor, severityLabel } from '@/lib/utils'

interface Props {
  severity: string
  className?: string
}

export function SeverityBadge({ severity, className }: Props) {
  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn(
        'shrink-0 border-transparent font-mono uppercase tracking-label',
        severityColor(severity),
        className
      )}
    >
      {severityLabel(severity)}
    </Badge>
  )
}
