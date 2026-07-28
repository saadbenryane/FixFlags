import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { SITE_URL } from '@/lib/marketing/copy'
import type { SampleSource } from '@/lib/marketing/curated-sample'

import { DEMO_BRAND } from '@/lib/demo/brand'

/** Default demo URL for "Try sample", landing sample report, and marketing captures. */
export const DEFAULT_SAMPLE_AUDIT_URL = 'https://fixflags.com/demo'

/** Client-safe sample URL for "Try sample" (set NEXT_PUBLIC_SAMPLE_AUDIT_URL to override). */
export const SAMPLE_AUDIT_URL =
  process.env.NEXT_PUBLIC_SAMPLE_AUDIT_URL ?? DEFAULT_SAMPLE_AUDIT_URL

export const DOGFOOD_CONTEXT_TAG = 'Dogfooding our homepage' as const

export const DEMO_FIXTURE_CONTEXT_TAG = `${DEMO_BRAND.displayLabel} fixture` as const

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const MARKETING_HOST = 'fixflags.com'
const DEMO_PATH_PREFIX = '/demo'

const FRESH_CAPTURE_DAYS = 7

function isDemoFixturePath(pathname: string): boolean {
  return pathname === DEMO_PATH_PREFIX || pathname.startsWith(`${DEMO_PATH_PREFIX}/`)
}

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
    const isSameHost =
      isLocal || hostname === MARKETING_HOST || hostname === envHost
    const isDemoFixture = isSameHost && isDemoFixturePath(parsed.pathname)

    if (isDemoFixture) {
      return {
        displayHost: DEMO_BRAND.displayLabel,
        contextTag: DEMO_FIXTURE_CONTEXT_TAG,
        browserUrl: parsed.toString(),
        isDogfood: false,
        isDemoFixture: true,
      }
    }

    const isDogfood = isSameHost

    return {
      displayHost: isDogfood ? DOGFOOD_CONTEXT_TAG : hostname,
      contextTag: isDogfood ? DOGFOOD_CONTEXT_TAG : hostname,
      browserUrl: isDogfood ? `https://${MARKETING_HOST}` : parsed.toString(),
      isDogfood,
      isDemoFixture: false,
    }
  } catch {
    return {
      displayHost: DEMO_BRAND.displayLabel,
      contextTag: DEMO_FIXTURE_CONTEXT_TAG,
      browserUrl: DEFAULT_SAMPLE_AUDIT_URL,
      isDogfood: false,
      isDemoFixture: true,
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
    isDemoFixture?: boolean
    marketing?: boolean
  }
): string {
  const isDogfood = options?.isDogfood ?? false
  const isDemoFixture = options?.isDemoFixture ?? false
  const marketing = options?.marketing ?? false

  if (marketing && isDemoFixture) {
    const version = options?.version ?? PIPELINE_VERSION
    const dateStr = options?.completedAt
      ? new Date(options.completedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null
    const parts = [DEMO_FIXTURE_CONTEXT_TAG, formatPipelineVersion(version)]
    if (dateStr) parts.push(dateStr)
    return parts.join(' · ')
  }

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

  const parts: string[] = ['Curated sample']
  parts.push(formatPipelineVersion(version))
  if (dateStr) parts.push(dateStr)
  return parts.join(' · ')
}
