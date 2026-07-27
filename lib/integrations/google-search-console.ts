import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAuthBaseUrl } from '@/lib/auth/env'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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

async function refreshAccessTokenIfNeeded(refreshToken: string, expiry: Date): Promise<string> {
  if (Date.now() + TOKEN_REFRESH_BUFFER_MS < expiry.getTime()) {
    return decryptSecret(refreshToken)
  }

  const decryptedRefresh = decryptSecret(refreshToken)
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
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Google returned no access token on refresh')
  }
  return data.access_token
}

export async function getGscAccessToken(userId: string): Promise<string | null> {
  const connection = await prisma.gscConnection.findUnique({ where: { userId } })
  if (!connection) return null
  try {
    return await refreshAccessTokenIfNeeded(connection.refreshToken, connection.tokenExpiry)
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
  startRow = 0
): Promise<GscSearchRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
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
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GSC searchAnalytics query failed (${res.status}): ${body}`)
  }
  const data = (await res.json()) as GscSearchResponse
  return data.rows ?? []
}

export interface GscUrlInspection {
  inspectionResult: {
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      robotsTxtState?: string
      indexingState?: string
      lastCrawlTime?: string
      googleCanonical?: string
      userCanonical?: string
      crawledAs?: string
      sitemap?: string[]
      richResults?: {
        verdict?: string
        detectedItems?: unknown[]
      }
    }
  }
}

export async function inspectUrl(
  accessToken: string,
  siteUrl: string,
  url: string
): Promise<GscUrlInspection['inspectionResult']['indexStatusResult'] | null> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/urlInspection/index:inspect`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl,
      }),
    }
  )
  if (!res.ok) {
    logger.warn('GSC URL inspection failed', { status: res.status, url })
    return null
  }
  const data = (await res.json()) as GscUrlInspection
  return data.inspectionResult?.indexStatusResult ?? null
}
