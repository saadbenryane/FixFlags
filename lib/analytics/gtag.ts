import { hasAnalyticsConsent } from '@/lib/analytics/consent'
import { getGoogleAdsId } from '@/lib/analytics/ad-conversions'

type GtagArgs =
  | [command: 'event' | 'config' | 'set' | 'consent', target: string, params?: Record<string, unknown>]
  | [command: 'set', params: Record<string, unknown>]
  | [command: 'js', date: Date]

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: GtagArgs) => void
    fbq?: (...args: unknown[]) => void
  }
}

/** Whether a GA4 measurement ID is configured for client instrumentation. */
export function getGoogleAnalyticsId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim()
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : undefined
}

export function isGaConfigured(): boolean {
  return Boolean(getGoogleAnalyticsId())
}

/**
 * Ensure gtag exists and queues to dataLayer before gtag.js loads.
 * Without this stub, early funnel events are dropped when scripts use lazyOnload.
 */
export function ensureGtagStub(): boolean {
  if (typeof window === 'undefined') return false
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      // Google processes Arguments objects as commands, not ordinary arrays.
      // eslint-disable-next-line prefer-rest-params -- The Google tag requires an Arguments object.
      window.dataLayer!.push(arguments)
    }
  }
  return true
}

const tagStates = new WeakMap<unknown[], { consent: boolean; configured: Set<string> }>()

/** Queue consent before configuration, including for events fired before the script loads. */
export function initializeGoogleTag(): boolean {
  if (typeof window === 'undefined') return false
  const gaId = getGoogleAnalyticsId()
  const granted = hasAnalyticsConsent()
  const adsId = granted ? getGoogleAdsId() : undefined
  if (!gaId && !adsId) return false
  if (!ensureGtagStub()) return false

  let state = tagStates.get(window.dataLayer!)
  if (!state) {
    window.gtag!('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    window.gtag!('set', { ads_data_redaction: true })
    window.gtag!('js', new Date())
    state = { consent: false, configured: new Set() }
    tagStates.set(window.dataLayer!, state)
  }

  if (state.consent !== granted) {
    const value = granted ? 'granted' : 'denied'
    window.gtag!('consent', 'update', {
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
    })
    state.consent = granted
  }

  if (gaId && !state.configured.has(gaId)) {
    window.gtag!('config', gaId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    state.configured.add(gaId)
  }
  if (adsId && !state.configured.has(adsId)) {
    window.gtag!('config', adsId)
    state.configured.add(adsId)
  }
  return true
}
