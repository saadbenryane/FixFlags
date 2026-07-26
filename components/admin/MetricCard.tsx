import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatValue } from '@/components/admin/StatValue'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: React.ReactNode
  value: React.ReactNode
  detail?: React.ReactNode
  action?: React.ReactNode
  variant?: 'solid' | 'subtle'
  className?: string
}

export function MetricCard({
  label,
  value,
  detail,
  action,
  variant = 'solid',
  className,
}: MetricCardProps) {
  return (
    <Card variant={variant} className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn((detail || action) && 'space-y-2')}>
        <StatValue>{value}</StatValue>
        {detail}
        {action}
      </CardContent>
    </Card>
  )
}
