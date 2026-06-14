import { Badge } from '@/components/ui/badge'
import { sampleStatusLabel } from '@/lib/marketing/display-meta'
import type { SampleSource } from '@/lib/marketing/live-sample'

export function SampleStatusBadge({
  source,
  completedAt,
  pipelineVersion,
}: {
  source: SampleSource
  completedAt?: Date | string | null
  pipelineVersion?: string | null
}) {
  const label = sampleStatusLabel(source, { version: pipelineVersion ?? undefined, completedAt })
  const variant = source === 'live' ? 'secondary' : 'outline'

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  )
}
