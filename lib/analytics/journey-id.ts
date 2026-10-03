import { hasAnalyticsConsent } from '@/lib/analytics/consent'

export const ANALYTICS_JOURNEY_PARAM = 'journey_id'
export const ANALYTICS_JOURNEY_STORAGE_KEY = 'ff:analytics-journey:v1'

const JOURNEY_PREFIX = 'ffj_'
const RANDOM_BYTE_COUNT = 16
const JOURNEY_PATTERN = /^ffj_[0-9a-f]{32}$/

export function isAnalyticsJourneyId(value: unknown): value is string {
  return typeof value === 'string' && JOURNEY_PATTERN.test(value)
}

function createAnalyticsJourneyId(): string | null {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.getRandomValues !== 'function'
  ) {
    return null
  }
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_BYTE_COUNT))
  return `${JOURNEY_PREFIX}${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Returns one opaque id for the current browser tab only after analytics
 * consent. It contains no URL, account, visitor-cookie, or customer content.
 */
export function readOrCreateAnalyticsJourneyId(): string | null {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return null

  try {
    const existing = window.sessionStorage.getItem(
      ANALYTICS_JOURNEY_STORAGE_KEY,
    )
    if (isAnalyticsJourneyId(existing)) return existing

    const created = createAnalyticsJourneyId()
    if (!created) return null
    window.sessionStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, created)
    return created
  } catch {
    return null
  }
}
