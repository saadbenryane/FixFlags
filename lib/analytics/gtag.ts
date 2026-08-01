declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: 'event' | 'config' | 'set',
      target: string,
      params?: Record<string, unknown>
    ) => void
    fbq?: (...args: unknown[]) => void
  }
}

/** Whether a GA4 measurement ID is configured for client instrumentation. */
export function isGaConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim()
  return Boolean(id && /^G-[A-Z0-9]+$/.test(id))
}

/**
 * Ensure gtag exists and queues to dataLayer before gtag.js loads.
 * Without this stub, early funnel events are dropped when scripts use lazyOnload.
 */
export function ensureGtagStub(): boolean {
  if (typeof window === 'undefined') return false
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = (command, target, params) => {
      window.dataLayer!.push(params === undefined ? [command, target] : [command, target, params])
    }
  }
  return true
}
