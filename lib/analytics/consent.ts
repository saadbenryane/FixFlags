export const ANALYTICS_CONSENT_COOKIE = 'fixflags_analytics_consent'
export const ANALYTICS_CONSENT_EVENT = 'fixflags:analytics-consent'
export const ANALYTICS_PREFERENCES_EVENT = 'fixflags:analytics-preferences'

export type AnalyticsConsent = 'granted' | 'denied'

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${ANALYTICS_CONSENT_COOKIE}=`))
    ?.split('=')[1]
  return raw === 'granted' || raw === 'denied' ? raw : null
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: value }))
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === 'granted'
}
