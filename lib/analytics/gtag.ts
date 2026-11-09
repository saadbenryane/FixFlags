import { hasAnalyticsConsent } from '@/lib/analytics/consent'
import { getGoogleAdsId } from '@/lib/analytics/ad-conversions'
import { carriesPrivateContinuation, isPrivateDocumentPath } from '@/lib/http/private-document'
import { controlledGoogleLocation, controlledGoogleReferrer, isControlledGooglePath, usesControlledGooglePageviews } from './controlled-pageview'

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

export function isAnalyticsSuppressedPath(pathname: string | null): boolean {
  return pathname !== null && (
    isPrivateDocumentPath(pathname) || pathname === '/admin' || pathname.startsWith('/admin/')
  )
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

type TagState = {
  consent: boolean
  configured: Set<string>
  controlledPage?: { path: string; location: string; referrer: string; viewed: boolean }
  crossedUnmeasuredPage?: boolean
}
const tagStates = new WeakMap<unknown[], TagState>()

function setControlledPageContext(state: TagState, url: URL, consented: boolean) {
  const location = controlledGoogleLocation(url, consented)
  const previous = state.controlledPage
  const samePage = previous?.path === url.pathname
  if (samePage && previous.location === location) return
  const referrer = samePage ? previous.referrer : previous ? url.origin + previous.path :
    state.crossedUnmeasuredPage ? '' : controlledGoogleReferrer()
  state.controlledPage = { path: url.pathname, location, referrer, viewed: samePage && previous.viewed }
  window.gtag!('set', { page_location: location, page_referrer: referrer, page_title: url.pathname })
}

/** Queue consent before configuration, including for events fired before the script loads. */
export function initializeGoogleTag(): boolean {
  if (typeof window === 'undefined' || isAnalyticsSuppressedPath(window.location.pathname)) return false
  if (carriesPrivateContinuation(window.location.pathname, new URLSearchParams(window.location.search))) return false
  const gaId = getGoogleAnalyticsId()
  const granted = hasAnalyticsConsent()
  const adsId = granted ? getGoogleAdsId() : undefined
  const controlled = usesControlledGooglePageviews()
  if (!gaId && !adsId) return false
  if (controlled && !isControlledGooglePath(window.location.pathname)) return false
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
    state = { consent: false, configured: new Set() }
    if (controlled) setControlledPageContext(state, new URL(window.location.href), granted)
    window.gtag!('js', new Date())
    tagStates.set(window.dataLayer!, state)
  } else if (controlled) {
    setControlledPageContext(state, new URL(window.location.href), granted)
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
      ...(controlled && { send_page_view: false }),
    })
    state.configured.add(gaId)
  }
  if (adsId && !state.configured.has(adsId)) {
    window.gtag!('config', adsId)
    state.configured.add(adsId)
  }
  return true
}

/** Observe committed public paths once, with a fresh entry after an excluded route. */
export function trackControlledGooglePageview(pathname: string | null, suppressed: boolean) {
  if (!usesControlledGooglePageviews() || pathname !== window.location.pathname) return
  const gaId = getGoogleAnalyticsId()
  if (!gaId) return
  if (suppressed || !initializeGoogleTag()) {
    const state = window.dataLayer && tagStates.get(window.dataLayer)
    if (state) {
      state.controlledPage = undefined
      state.crossedUnmeasuredPage = true
    }
    return
  }
  const page = tagStates.get(window.dataLayer!)?.controlledPage
  if (!page || page.viewed) return
  page.viewed = true
  window.gtag!('event', 'page_view', {
    send_to: gaId, page_location: page.location, page_referrer: page.referrer, page_title: page.path,
  })
}
