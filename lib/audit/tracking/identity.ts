import { createHash } from 'node:crypto'
import { verifierScopeKey } from '@/lib/improvements/verifier-scope'
import { PLAUSIBLE_LIBRARY_ENDPOINT } from './endpoints'
import type { CheckAssertion } from '../checks/assertion'

export function trackingPageKey(pageUrl: string): string {
  return createHash('sha256').update(verifierScopeKey(pageUrl)).digest('hex')
}

/** Compare request URLs and methods without retaining project keys or query values. */
export function trackingRequestKey(url: string, method: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return createHash('sha256').update(JSON.stringify([method.toUpperCase(), parsed.href])).digest('hex')
}

/** A different hop cannot certify a failed library transfer. */
export function trackingRedirectKey(previousKey: string, url: string, method: string): string {
  return createHash('sha256').update(JSON.stringify(['tracking-redirect', previousKey, trackingRequestKey(url, method)])).digest('hex')
}

export const TRACKING_VERIFICATION_RULE = 'Tracking observation v2: repeat every original request, page, browser phase and capture identity. A different library or project cannot certify repair.'
const PAGE_LOAD_CONTEXT = /^tracking:page_load:.+:request:v[234]:[a-f0-9]{64}:capture:[a-f0-9]{64}:page:[a-f0-9]{64}$/
export const TRACKING_ACTION_CONTEXT = /^tracking:public_action:.+:request:v5:[a-f0-9]{64}:capture:[a-f0-9]{64}:control:([a-f0-9]{64}):page:[a-f0-9]{64}$/

export function isComparableTrackingContext(context: string): boolean {
  return PAGE_LOAD_CONTEXT.test(context) || TRACKING_ACTION_CONTEXT.test(context)
}

export function trackingActionContext(context: string): string | undefined {
  const key = context.match(TRACKING_ACTION_CONTEXT)?.[1]
  return key ? 'flow:control:' + key : undefined
}

const PLAUSIBLE_SCRIPT_CONTEXT = /^(tracking:(?:page_load|public_action):plausible:library:[^/]+)(\/js\/[^/]+\.js)(?=:request:v[2345]:)/
const redactTrackingContext = (context: string) => context.replace(PLAUSIBLE_SCRIPT_CONTEXT, '$1' + PLAUSIBLE_LIBRARY_ENDPOINT)

/** Keep historical evidence comparable without copying the raw path into new proofs. */
export function redactTrackingAssertion(assertion: CheckAssertion): CheckAssertion {
  const context = assertion.context
  const original = context?.match(PLAUSIBLE_SCRIPT_CONTEXT)?.[2]
  if (!context || !original || original === PLAUSIBLE_LIBRARY_ENDPOINT) return assertion
  return { ...assertion, context: redactTrackingContext(context), observed: assertion.observed.replaceAll(original, PLAUSIBLE_LIBRARY_ENDPOINT) }
}

/** Version 2 can compare with version 3. Phase-wide identities cannot compare
 * with version 4, which binds the initiating document per request. */
export function currentTrackingRequestTarget(context: string) {
  return redactTrackingContext(PAGE_LOAD_CONTEXT.test(context) ? context.replace(':request:v2:', ':request:v3:') : context)
}
