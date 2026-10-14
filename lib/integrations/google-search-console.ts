import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAuthBaseUrl } from '@/lib/auth/env'
import { decryptSecret } from '@/lib/security/crypto'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { readBoundedJson } from '@/lib/http/read-json'

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const STATE_TTL_MS = 10 * 60 * 1000
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required to sign OAuth state')
  return secret
}

export function isGoogleSearchConsoleConfigured(): boolean {
  return !!(process.env.GSC_CLIENT_ID && process.env.GSC_CLIENT_SECRET)
}

export function gscCallbackUrl(): string {
  const base = getAuthBaseUrl().replace(/\/$/, '')
  return `${base}/api/integrations/gsc/callback`
}

export function signGscConnectState(userId: string): string {
  const payload = `${userId}.${Date.now()}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyGscConnectState(state: string, expectedUserId: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [uid, ts, sig] = decoded.split('.')
    if (!uid || !ts || !sig) return false
    if (uid !== expectedUserId) return false
    const age = Date.now() - Number(ts)
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return false

    const expected = createHmac('sha256', stateSecret()).update(`${uid}.${ts}`).digest('hex')
    const provided = Buffer.from(sig, 'hex')
    const wanted = Buffer.from(expected, 'hex')
    if (provided.length !== wanted.length) return false
    return timingSafeEqual(provided, wanted)
  } catch {
    return false
  }
}

export function buildGscAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GSC_CLIENT_ID ?? '',
    redirect_uri: gscCallbackUrl(),
    response_type: 'code',
    scope: GSC_SCOPE,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

export async function exchangeCodeForGscTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GSC_CLIENT_ID ?? '',
      client_secret: process.env.GSC_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: gscCallbackUrl(),
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${body}`)
  }
  const data = (await res.json()) as GoogleTokenResponse
  if (!data.access_token || !data.refresh_token || !data.expires_in) {
    throw new Error(data.error_description || data.error || 'Google returned incomplete tokens')
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  }
}

export interface GscSiteEntry {
  siteUrl: string
  permissionLevel: string
}

export async function listGscSites(accessToken: string): Promise<GscSiteEntry[]> {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to list GSC sites (${res.status})`)
  const data = (await res.json()) as { siteEntry?: GscSiteEntry[] }
  return data.siteEntry ?? []
}

async function refreshAccessTokenIfNeeded(connection: {
  id: string
  accessToken: string
  refreshToken: string
  tokenExpiry: Date
}): Promise<string> {
  if (Date.now() + TOKEN_REFRESH_BUFFER_MS < connection.tokenExpiry.getTime()) {
    return decryptSecret(connection.accessToken)
  }

  const decryptedRefresh = decryptSecret(connection.refreshToken)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GSC_CLIENT_ID ?? '',
      client_secret: process.env.GSC_CLIENT_SECRET ?? '',
      refresh_token: decryptedRefresh,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status})`)
  }
  const data = (await res.json()) as GoogleTokenResponse
  if (!data.access_token || !data.expires_in || data.expires_in <= 0) {
    throw new Error(data.error_description || data.error || 'Google returned incomplete refreshed credentials')
  }
  const { encryptSecret } = await import('@/lib/security/crypto')
  await prisma.gscConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(data.access_token),
      tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      ...(data.refresh_token ? { refreshToken: encryptSecret(data.refresh_token) } : {}),
    },
  })
  return data.access_token
}

export async function getGscAccessToken(userId: string): Promise<string | null> {
  const connection = await prisma.gscConnection.findUnique({ where: { userId } })
  if (!connection) return null
  try {
    return await refreshAccessTokenIfNeeded(connection)
  } catch (err) {
    logger.error('GSC token refresh failed', err instanceof Error ? err : new Error(String(err)))
    return null
  }
}

export async function revokeGoogleGrant(accessToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch {
    // Best-effort revocation
  }
}

export interface GscSearchRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscSearchResponse {
  rows?: GscSearchRow[]
  responseAggregationType?: string
}

export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 25000,
  startRow = 0,
  pageUrl?: string,
  signal?: AbortSignal,
): Promise<GscSearchRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      signal: signal ?? AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow,
        ...(pageUrl ? { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }] }] } : {}),
      }),
    }
  )
  if (!res.ok) {
    throw await searchConsoleFailure(res)
  }
  const parsed = searchRowsSchema.safeParse(await readBoundedJson(res, 1_000_000).catch(() => null))
  if (!parsed.success) throw new SearchConsoleError('MALFORMED_PROVIDER_RESPONSE')
  return parsed.data.rows ?? []
}

export class SearchConsoleError extends Error {
  constructor(readonly code: 'AUTH_EXPIRED' | 'PERMISSION_REFUSED' | 'PROVIDER_QUOTA' | 'PROVIDER_UNAVAILABLE' | 'MALFORMED_PROVIDER_RESPONSE', readonly retryAfterMs?: number) {
    super(code); this.name = 'SearchConsoleError'
  }
}

async function searchConsoleFailure(response: Response): Promise<SearchConsoleError> {
  const payload = await readBoundedJson(response, 16_384).catch(() => null) as { error?: { status?: string; errors?: Array<{ reason?: string }> } } | null
  const quota = payload?.error?.status === 'RESOURCE_EXHAUSTED' ||
    payload?.error?.errors?.some(item => ['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'].includes(item.reason ?? ''))
  return new SearchConsoleError(response.status === 429 || quota ? 'PROVIDER_QUOTA' : response.status === 401 ? 'AUTH_EXPIRED'
    : response.status === 403 ? 'PERMISSION_REFUSED' : 'PROVIDER_UNAVAILABLE', providerRetryDelay(response.headers.get('retry-after')))
}

export function providerRetryDelay(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(delay) && delay > 0 ? delay : undefined
}

const searchRowsSchema = z.object({ rows: z.array(z.object({
  keys: z.array(z.string()), clicks: z.number().finite().nonnegative(), impressions: z.number().finite().nonnegative(),
  ctr: z.number().finite().nonnegative(), position: z.number().finite().nonnegative(),
})).max(1000).optional() })

const indexResultSchema = z.object({
  verdict: z.string().optional(), coverageState: z.string().optional(), robotsTxtState: z.string().optional(),
  indexingState: z.string().optional(), pageFetchState: z.string().optional(), lastCrawlTime: z.string().datetime({ offset: true }).optional(),
  googleCanonical: z.string().url().optional(), userCanonical: z.string().url().optional(),
  crawledAs: z.string().optional(), sitemap: z.array(z.string().url()).optional(),
})
export const urlInspectionSchema = z.object({ inspectionResult: z.object({
  inspectionResultLink: z.string().url().optional(),
  indexStatusResult: indexResultSchema.optional(),
  richResultsResult: z.object({ verdict: z.string().optional(), detectedItems: z.array(z.object({
    richResultType: z.string().optional(), items: z.array(z.object({
      name: z.string().optional(), issues: z.array(z.object({ issueMessage: z.string().optional(), severity: z.string().optional() })).optional(),
    })).optional(),
  })).optional() }).optional(),
}) })
export type SearchUrlInspection = z.infer<typeof urlInspectionSchema>['inspectionResult']

export async function inspectSearchUrl(accessToken: string, siteUrl: string, url: string, signal?: AbortSignal): Promise<SearchUrlInspection> {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST', signal: signal ?? AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl }),
  })
  if (!response.ok) throw await searchConsoleFailure(response)
  const parsed = urlInspectionSchema.safeParse(await readBoundedJson(response, 1_000_000).catch(() => null))
  if (!parsed.success) throw new SearchConsoleError('MALFORMED_PROVIDER_RESPONSE')
  return parsed.data.inspectionResult
}

export interface GscUrlInspection {
  inspectionResult: {
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      robotsTxtState?: string
      indexingState?: string
      pageFetchState?: string
      lastCrawlTime?: string
      googleCanonical?: string
      userCanonical?: string
      crawledAs?: string
      sitemap?: string[]
    }
    richResultsResult?: SearchUrlInspection['richResultsResult']
  }
}

export async function inspectUrl(
  accessToken: string,
  siteUrl: string,
  url: string
): Promise<GscUrlInspection['inspectionResult']['indexStatusResult'] | null> {
  // Compatibility response; the complete evaluator keeps rich-results evidence separate.
  try { return (await inspectSearchUrl(accessToken, siteUrl, url)).indexStatusResult ?? null }
  catch { return null }
}
