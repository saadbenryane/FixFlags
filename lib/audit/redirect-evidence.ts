import type { PublicHttpDocument } from './http-evidence'

type RedirectResponse = Pick<PublicHttpDocument, 'statusCode' | 'finalUrl' | 'headers' | 'redirects'>

export function isAutomaticRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

export function publicRedirectDestination(status: number, location: string | null | undefined, responseUrl: string): string | null {
  if (!isAutomaticRedirectStatus(status) || !location?.trim()) return null
  try { return new URL(location, responseUrl).href } catch { return null }
}

/** An intermediate response cannot supply final-page header or TLS recovery. */
export function isUnresolvedPublicRedirect(document: { status: number | null }): boolean {
  return document.status !== null && document.status >= 300 && document.status < 400
}

/** The last observed redirect must repeat an already observed request and
 * destination. A long chain alone cannot establish a repeating cycle. */
export function hasRepeatedRedirect(response: RedirectResponse): boolean {
  const next = publicRedirectDestination(response.statusCode, response.headers.location, response.finalUrl)
  if (!next) return false
  const identity = (value: string) => { const url = new URL(value); url.hash = ''; return url.href }
  try {
    const from = identity(response.finalUrl)
    const destination = identity(next)
    const requests = [...response.redirects, response.finalUrl].map(identity)
    return requests.slice(0, -1).some((url, index) => url === from && requests[index + 1] === destination)
  } catch { return false }
}

/** Keep the last actual HTTP response and the bounded source chain. Redirects
 * depending on cookies, challenges or nonstandard redirect handling remain inconclusive. */
export class PublicRedirectError extends Error {
  readonly reason: 'redirect_loop' | 'redirect_limit' | 'redirect_unresolved'
  readonly response: RedirectResponse & { body: null; complete: false }
  constructor(response: RedirectResponse, uncertain: boolean, message?: string) {
    const unresolved = publicRedirectDestination(response.statusCode, response.headers.location, response.finalUrl) === null
    super(message ?? (unresolved ? 'Public response did not establish a followable redirect' : 'Public evidence redirect limit exceeded'))
    this.name = 'PublicRedirectError'
    this.response = { ...response, body: null, complete: false }
    this.reason = unresolved ? 'redirect_unresolved' : !uncertain && hasRepeatedRedirect(response) ? 'redirect_loop' : 'redirect_limit'
  }
}
