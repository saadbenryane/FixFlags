export const ANALYTICS_CONSENT_COOKIE = 'fixflags_analytics_consent'
export const ANALYTICS_CONSENT_EVENT = 'fixflags:analytics-consent'
export const ANALYTICS_PREFERENCES_EVENT = 'fixflags:analytics-preferences'

export type AnalyticsConsent = 'granted' | 'denied'

/** Only a remembered preference changes the neutral server-rendered notice.
 * This runs before paint and never authorizes or loads an analytics script. */
export const ANALYTICS_CONSENT_BOOTSTRAP = `(()=>{try{const value=document.cookie.split('; ').find(entry=>entry.startsWith(${JSON.stringify(ANALYTICS_CONSENT_COOKIE + '=')}))?.split('=')[1];if(value==='granted'||value==='denied')document.documentElement.setAttribute('data-analytics-consent',value)}catch{}})()`

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
  document.documentElement.setAttribute('data-analytics-consent', value)
  if (value === 'denied') clearAnalyticsCookies()
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: value }))
}

/** GA measures public visits until the visitor explicitly opts out. */
export function isGoogleAnalyticsEnabled(): boolean {
  return typeof document !== 'undefined' && readAnalyticsConsent() !== 'denied'
}

/** Advertising and first-party journey attribution still require an explicit grant. */
export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === 'granted'
}

function clearAnalyticsCookies(): void {
  const names = document.cookie.split('; ').map(entry => entry.split('=')[0])
    .filter(name => /^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_gcl_|_fbp$|_fbc$)/.test(name))
  const domains = ['', ...window.location.hostname.split('.').map((_, index, parts) => parts.slice(index).join('.'))]
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`
    }
  }
}
