import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { HERO } from '@/lib/marketing/copy'
import type { SampleSource } from '@/lib/marketing/live-sample'

export const TRUST_LINE = HERO.trustLine

export function formatPipelineVersion(version: string = PIPELINE_VERSION): string {
  return `Pipeline v${version}`
}

export function sampleStatusLabel(
  source: SampleSource,
  options?: { version?: string; completedAt?: Date | string | null }
): string {
  const version = options?.version ?? PIPELINE_VERSION
  const dateStr = options?.completedAt
    ? new Date(options.completedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const parts: string[] = []
  if (source === 'live') {
    parts.push('Live sample')
  } else if (source === 'archived') {
    parts.push('Last published')
  } else {
    parts.push('Sample report')
  }
  parts.push(formatPipelineVersion(version))
  if (dateStr) parts.push(dateStr)
  return parts.join(' · ')
}

export const COMPACT_DISCLAIMER =
  'Automated audit, illustrative, not an endorsement.' as const
