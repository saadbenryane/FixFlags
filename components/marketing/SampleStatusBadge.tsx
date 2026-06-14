import { Badge } from '@/components/ui/badge'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
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
  const version = pipelineVersion ?? PIPELINE_VERSION
  const dateStr = completedAt
    ? new Date(completedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  if (source === 'live') {
    return (
      <Badge variant="secondary" className="text-xs">
        Live sample · v{version}
        {dateStr ? ` · ${dateStr}` : ''}
      </Badge>
    )
  }

  if (source === 'archived') {
    return (
      <Badge variant="outline" className="text-xs">
        Last published · v{version}
        {dateStr ? ` · ${dateStr}` : ''}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs">
      Sample report · v{version}
      {dateStr ? ` · ${dateStr}` : ''}
    </Badge>
  )
}
