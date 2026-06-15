import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { HERO, SITE_URL } from '@/lib/marketing/copy'
import type { SampleSource } from '@/lib/marketing/live-sample'

export const TRUST_LINE = HERO.trustLine

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const MARKETING_HOST = 'qualityos.com'

export function getSampleSiteDisplay(auditUrl: string) {
  try {
    const parsed = new URL(auditUrl)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const isLocal =
      LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')
    const envHost = (() => {
      try {
        return new URL(SITE_URL).hostname.toLowerCase().replace(/^www\./, '')
      } catch {
        return MARKETING_HOST
      }
    })()
    const isDogfood =
      isLocal || hostname === MARKETING_HOST || hostname === envHost

    return {
      displayHost: isDogfood ? MARKETING_HOST : hostname,
      browserUrl: isDogfood ? `https://${MARKETING_HOST}` : parsed.toString(),
      isDogfood,
    }
  } catch {
    return {
      displayHost: MARKETING_HOST,
      browserUrl: `https://${MARKETING_HOST}`,
      isDogfood: true,
    }
  }
}

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
