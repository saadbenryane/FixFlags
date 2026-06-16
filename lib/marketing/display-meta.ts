import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { HERO, SITE_URL } from '@/lib/marketing/copy'
import type { SampleSource } from '@/lib/marketing/live-sample'

export const TRUST_LINE = HERO.trustLine

export const SAMPLE_AUDIT_URL = `${SITE_URL.replace(/\/$/, '')}/`

export const DOGFOOD_CONTEXT_TAG = 'Dogfooding our homepage' as const

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const MARKETING_HOST = 'fixflags.com'

const FRESH_CAPTURE_DAYS = 7

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
      displayHost: isDogfood ? DOGFOOD_CONTEXT_TAG : hostname,
      contextTag: isDogfood ? DOGFOOD_CONTEXT_TAG : hostname,
      browserUrl: isDogfood ? `https://${MARKETING_HOST}` : parsed.toString(),
      isDogfood,
    }
  } catch {
    return {
      displayHost: DOGFOOD_CONTEXT_TAG,
      contextTag: DOGFOOD_CONTEXT_TAG,
      browserUrl: `https://${MARKETING_HOST}`,
      isDogfood: true,
    }
  }
}

export function formatPipelineVersion(version: string = PIPELINE_VERSION): string {
  return `Pipeline v${version}`
}

/** Relative capture label for marketing; omit when stale. */
export function formatFreshCapturedLabel(
  completedAt?: Date | string | null,
  maxAgeDays: number = FRESH_CAPTURE_DAYS
): string | null {
  if (!completedAt) return null

  const date = new Date(completedAt)
  if (Number.isNaN(date.getTime())) return null

  const ageMs = Date.now() - date.getTime()
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  if (ageMs > maxAgeMs) return null

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfCapture = new Date(date)
  startOfCapture.setHours(0, 0, 0, 0)

  if (startOfCapture.getTime() === startOfToday.getTime()) {
    return 'Captured today'
  }

  return null
}

export function sampleStatusLabel(
  source: SampleSource,
  options?: {
    version?: string
    completedAt?: Date | string | null
    isDogfood?: boolean
    marketing?: boolean
  }
): string {
  const isDogfood = options?.isDogfood ?? false
  const marketing = options?.marketing ?? false

  if (marketing && isDogfood) {
    const fresh = formatFreshCapturedLabel(options?.completedAt)
    return fresh ? `${DOGFOOD_CONTEXT_TAG} · ${fresh}` : DOGFOOD_CONTEXT_TAG
  }

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
