import { StatusBadge } from '@/components/audit/StatusBadge'

interface Props {
  severity: string
  className?: string
}

export function SeverityBadge({ severity, className }: Props) {
  return <StatusBadge kind="severity" status={severity} className={className} />
}
