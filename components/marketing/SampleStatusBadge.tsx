'use client'

import { Badge } from '@/components/ui/badge'
import { sampleStatusLabel } from '@/lib/marketing/display-meta'
import type { SampleSource } from '@/lib/marketing/live-sample'

export function SampleStatusBadge({
  source,
  completedAt,
  pipelineVersion,
  isDogfood,
  isDemoFixture,
  marketing = false,
}: {
  source: SampleSource
  completedAt?: Date | string | null
  pipelineVersion?: string | null
  isDogfood?: boolean
  isDemoFixture?: boolean
  marketing?: boolean
}) {
  const label = sampleStatusLabel(source, {
    version: pipelineVersion ?? undefined,
    completedAt,
    isDogfood,
    isDemoFixture,
    marketing,
  })
  const variant = source === 'live' ? 'secondary' : 'outline'

  return (
    <Badge variant={variant} className="text-xs font-normal">
      {label}
    </Badge>
  )
}
