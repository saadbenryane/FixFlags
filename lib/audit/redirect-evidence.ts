import type { PublicHttpDocument } from './http-evidence'

type RedirectResponse = Pick<PublicHttpDocument, 'statusCode' | 'finalUrl' | 'headers' | 'redirects'>

export function isAutomaticRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

/** An intermediate response cannot supply final-page header or TLS recovery. */
export function isUnresolvedPublicRedirect(document: { status: number | null; reason: string | null }): boolean {
  return document.status !== null && document.status >= 300 && document.status < 400 &&
    (document.reason === 'redirect_loop' || document.reason === 'redirect_limit')
}

/** The last observed redirect must repeat an already observed request and
 * destination. A long chain alone cannot establish a repeating cycle. */
export function hasRepeatedRedirect(response: RedirectResponse): boolean {
  if (!isAutomaticRedirectStatus(response.statusCode) || !response.headers.location) return false
  const identity = (value: string) => { const url = new URL(value); url.hash = ''; return url.href }
  try {
    const from = identity(response.finalUrl)
    const destination = identity(new URL(response.headers.location, response.finalUrl).href)
    const requests = [...response.redirects, response.finalUrl].map(identity)
    return requests.slice(0, -1).some((url, index) => url === from && requests[index + 1] === destination)
  } catch { return false }
}

/** Keep the last actual HTTP response and the bounded source chain. Redirects
 * depending on cookies, challenges or nonstandard redirect handling remain inconclusive. */
export class PublicRedirectError extends Error {
  readonly reason: 'redirect_loop' | 'redirect_limit'
  readonly response: RedirectResponse & { body: null; complete: false }
  constructor(response: RedirectResponse, uncertain: boolean, message = 'Public evidence redirect limit exceeded') {
    super(message)
    this.name = 'PublicRedirectError'
    this.response = { ...response, body: null, complete: false }
    this.reason = !uncertain && hasRepeatedRedirect(response) ? 'redirect_loop' : 'redirect_limit'
  }
}
