import { createHash } from 'node:crypto'
import { verifierScopeKey } from '@/lib/improvements/verifier-scope'

export function trackingPageKey(pageUrl: string): string {
  return createHash('sha256').update(verifierScopeKey(pageUrl)).digest('hex')
}

/** Compare request URLs and methods without retaining project keys or query values. */
export function trackingRequestKey(url: string, method: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return createHash('sha256').update(JSON.stringify([method.toUpperCase(), parsed.href])).digest('hex')
}

export const TRACKING_VERIFICATION_RULE = 'Tracking observation v2: repeat every original request, page, browser phase and capture identity. A different library or project cannot certify repair.'
export const TRACKING_REQUEST_CONTEXT = /:request:v2:[a-f0-9]{64}:capture:[a-f0-9]{64}:page:[a-f0-9]{64}$/
