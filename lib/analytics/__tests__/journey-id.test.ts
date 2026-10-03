/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  ANALYTICS_JOURNEY_STORAGE_KEY,
  isAnalyticsJourneyId,
  readOrCreateAnalyticsJourneyId,
} from '@/lib/analytics/journey-id'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'

describe('consent-aware analytics journey identity', () => {
  afterEach(() => {
    sessionStorage.clear()
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
  })

  it('does not create or retain an identity before consent', () => {
    expect(readOrCreateAnalyticsJourneyId()).toBeNull()
    expect(sessionStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)).toBeNull()
  })

  it('creates one opaque tab-scoped identity after consent and reuses it', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`

    const first = readOrCreateAnalyticsJourneyId()
    const second = readOrCreateAnalyticsJourneyId()

    expect(isAnalyticsJourneyId(first)).toBe(true)
    expect(second).toBe(first)
    expect(first).not.toContain('http')
    expect(first).not.toContain('@')
  })

  it('replaces malformed stored values instead of forwarding them', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    sessionStorage.setItem(
      ANALYTICS_JOURNEY_STORAGE_KEY,
      'customer@example.com',
    )

    const journeyId = readOrCreateAnalyticsJourneyId()

    expect(isAnalyticsJourneyId(journeyId)).toBe(true)
    expect(journeyId).not.toBe('customer@example.com')
  })
})
