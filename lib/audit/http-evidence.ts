export type PublicHttpDocument = {
  body: string; finalUrl: string; statusCode: number; headers: Record<string, string>;
  complete: boolean; redirects: string[];
}

const credentialHeaders = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'set-cookie2',
  'www-authenticate', 'proxy-authenticate', 'authentication-info', 'proxy-authentication-info'])

/** A recorded header can prove an authentication or cookie boundary without carrying its value. */
export function responseEvidenceHeaders(entries: Iterable<readonly [string, string]>): Record<string, string> {
  return Object.fromEntries(Array.from(entries, ([name, value]) => {
    const key = name.toLowerCase()
    return credentialHeaders.has(key) ? [key, value ? '[redacted]' : ''] : [name, value]
  }))
}

export function isPublicChallengeHeader(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'challenge'
}

/** Status-only restrictions are meaningful even when no body is collected. */
export function publicResponseStatusRestriction(status: number) {
  if (status === 407 || status === 511) return 'intermediary_authentication_required' as const
  if (status === 401) return 'authentication_required' as const
  if (status === 403) return 'access_denied' as const
  if (status === 429) return 'rate_limited' as const
  return null
}

/** Public probes send an ordinary GET. A server-provided partial response
 * cannot verify that the full request succeeded. */
export function isSuccessfulPublicGetStatus(status: number): boolean {
  return status >= 200 && status < 300 && status !== 206
}

/** A failed body cannot erase an already observed response or become complete
 * content. Consumers needing a whole body retain the ordinary error path. */
export class PublicResponseBodyError extends Error {
  readonly response: Omit<PublicHttpDocument, 'body' | 'complete'> & { body: string | null; complete: false }
  constructor(response: Omit<PublicHttpDocument, 'body' | 'complete'> & { body: string | null }, cause: unknown) {
    super('Public response body could not be collected', { cause })
    this.name = 'PublicResponseBodyError'
    this.response = { ...response, complete: false }
  }
}
