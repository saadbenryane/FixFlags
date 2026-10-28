import { readBoundedJson } from '@/lib/http/read-json'
import { z } from 'zod'

export type GoogleFailureCode = 'AUTH_EXPIRED' | 'AUTHORIZATION_CHANGED' | 'PERMISSION_REFUSED' |
  'PROVIDER_QUOTA' | 'PROVIDER_UNAVAILABLE' | 'MALFORMED_PROVIDER_RESPONSE'

export class GoogleProviderError extends Error {
  constructor(readonly code: GoogleFailureCode, readonly retryAfterMs?: number) {
    super(code); this.name = 'GoogleProviderError'
  }
  get requiresReauthentication() { return this.code === 'AUTH_EXPIRED' || this.code === 'PERMISSION_REFUSED' }
}

export function providerRetryDelay(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(delay) && delay > 0 ? delay : undefined
}

/** Retain failure meaning and retry guidance without exposing provider body text. */
export async function googleResponseFailure(response: Response, oauth = false): Promise<GoogleProviderError> {
  const payload = await readBoundedJson(response, 16_384).catch(() => null) as { error?: unknown } | null
  const error = payload?.error
  const detail = error && typeof error === 'object' ? error as { status?: unknown; errors?: unknown } : null
  const quota = detail?.status === 'RESOURCE_EXHAUSTED' || Array.isArray(detail?.errors) && detail.errors.some(item =>
    item && typeof item === 'object' && ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'].includes(item.reason))
  let code: GoogleFailureCode = 'PROVIDER_UNAVAILABLE'
  if (response.status === 429 || quota) code = 'PROVIDER_QUOTA'
  else if (oauth) {
    if ([400, 401].includes(response.status) && error === 'invalid_grant') code = 'AUTH_EXPIRED'
    else if ([400, 403].includes(response.status) && error === 'access_denied') code = 'PERMISSION_REFUSED'
  } else if (response.status === 401) code = 'AUTH_EXPIRED'
  else if (response.status === 403) code = 'PERMISSION_REFUSED'
  return new GoogleProviderError(code, providerRetryDelay(response.headers.get('retry-after')))
}

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().finite().positive(), refresh_token: z.string().min(1).optional() })

export async function readGoogleTokens(response: Response) {
  if (!response.ok) throw await googleResponseFailure(response, true)
  const parsed = tokenSchema.safeParse(await readBoundedJson(response, 16_384).catch(() => null))
  if (!parsed.success) throw new GoogleProviderError('MALFORMED_PROVIDER_RESPONSE')
  return parsed.data
}
