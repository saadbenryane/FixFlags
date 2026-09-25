import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SiteConnectionProvider } from '@prisma/client'
import { getAuthBaseUrl } from '@/lib/auth/env'
import { prisma } from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import {
  chooseAnalyticsProperty,
  chooseSearchProperty,
  factsFromAnalyticsRows,
  factsFromSearchRows,
  type AnalyticsProperty,
  type ConnectionFact,
} from '@/lib/sites/connections/match'

const STATE_TTL_MS = 10 * 60 * 1000
const REFRESH_BUFFER_MS = 5 * 60 * 1000
const SEARCH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export type GoogleTokens = {
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number
}

export type GoogleConnectionClient = {
  exchangeCode(code: string): Promise<GoogleTokens>
  listSearchSites(accessToken: string): Promise<Array<{ siteUrl: string }>>
  querySearch(accessToken: string, property: string): Promise<Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }>>
  listAnalyticsProperties(accessToken: string): Promise<AnalyticsProperty[]>
  queryAnalytics(accessToken: string, propertyId: string): Promise<Array<{ pagePath?: string; sessions?: number }>>
  revoke(token: string): Promise<void>
}

export function googleConnectionConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret())
}

export function googleCallbackUrl(): string {
  return `${getAuthBaseUrl().replace(/\/$/, '')}/api/sites/connections/google/callback`
}

function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || process.env.GSC_CLIENT_ID?.trim() || null
}

function googleClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || process.env.GSC_CLIENT_SECRET?.trim() || null
}

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required to sign connection state')
  return secret
}

export function signConnectionState(input: {
  userId: string
  projectId: string
  provider: SiteConnectionProvider
}): string {
  const body = Buffer.from(JSON.stringify({ ...input, ts: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(body).digest('hex')
  return `${body}.${sig}`
}

export function readConnectionState(state: string): {
  userId: string
  projectId: string
  provider: SiteConnectionProvider
} | null {
  try {
    const [body, sig] = state.split('.')
    if (!body || !sig) return null
    const expected = createHmac('sha256', stateSecret()).update(body).digest('hex')
    const provided = Buffer.from(sig, 'hex')
    const wanted = Buffer.from(expected, 'hex')
    if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      userId?: string
      projectId?: string
      provider?: string
      ts?: number
    }
    if (!parsed.userId || !parsed.projectId || (parsed.provider !== 'SEARCH_CONSOLE' && parsed.provider !== 'ANALYTICS')) return null
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > STATE_TTL_MS || parsed.ts > Date.now() + 60_000) return null
    return { userId: parsed.userId, projectId: parsed.projectId, provider: parsed.provider }
  } catch {
    return null
  }
}

export function buildGoogleAuthorizeUrl(state: string, provider: SiteConnectionProvider): string {
  const params = new URLSearchParams({
    client_id: googleClientId() ?? '',
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function googlePost(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof payload.error_description === 'string' ? payload.error_description : 'Google request failed')
  return payload
}

export function liveGoogleClient(): GoogleConnectionClient {
  return {
    async exchangeCode(code) {
      const data = await googlePost('https://oauth2.googleapis.com/token', new URLSearchParams({
        client_id: googleClientId() ?? '',
        client_secret: googleClientSecret() ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: googleCallbackUrl(),
      }))
      if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
        throw new Error('Google returned incomplete tokens')
      }
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
        expiresInSeconds: data.expires_in,
      }
    },
    async listSearchSites(accessToken) {
      const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(`Search Console list failed (${response.status})`)
      const data = await response.json() as { siteEntry?: Array<{ siteUrl: string }> }
      return data.siteEntry ?? []
    },
    async querySearch(accessToken, property) {
      const end = new Date()
      const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
      const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ['page', 'query'],
          rowLimit: 25,
        }),
      })
      if (!response.ok) throw new Error(`Search Console query failed (${response.status})`)
      const data = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }> }
      return data.rows ?? []
    },
    async listAnalyticsProperties(accessToken) {
      const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(`Analytics properties failed (${response.status})`)
      const data = await response.json() as {
        accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }>
      }
      const properties: AnalyticsProperty[] = []
      for (const account of data.accountSummaries ?? []) {
        for (const property of account.propertySummaries ?? []) {
          if (properties.length >= 20) return properties
          if (!property.property) continue
          const streams = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${property.property}/dataStreams`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const streamBody = streams.ok
            ? await streams.json() as { dataStreams?: Array<{ webStreamData?: { defaultUri?: string } }> }
            : { dataStreams: [] }
          properties.push({
            propertyId: property.property,
            label: property.displayName ?? property.property,
            streamUrls: (streamBody.dataStreams ?? []).flatMap((stream) => stream.webStreamData?.defaultUri ? [stream.webStreamData.defaultUri] : []),
          })
        }
      }
      return properties
    },
    async queryAnalytics(accessToken, propertyId) {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'sessions' }],
          limit: 25,
        }),
      })
      if (!response.ok) throw new Error(`Analytics report failed (${response.status})`)
      const data = await response.json() as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> }
      return (data.rows ?? []).map((row) => ({
        pagePath: row.dimensionValues?.[0]?.value,
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
      }))
    },
    async revoke(token) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => undefined)
    },
  }
}

async function saveFacts(connectionId: string, projectId: string, facts: ConnectionFact[]) {
  await prisma.siteConnectionFact.deleteMany({ where: { connectionId } })
  if (facts.length === 0) return
  await prisma.siteConnectionFact.createMany({
    data: facts.map((fact) => ({ ...fact, connectionId, projectId })),
  })
}

export async function syncGoogleConnection(input: {
  connectionId: string
  projectId: string
  provider: SiteConnectionProvider
  host: string
  accessToken: string
  propertyId?: string | null
  client?: GoogleConnectionClient
}): Promise<{ status: 'CONNECTED' | 'MISMATCH' | 'NEEDS_REAUTH'; detail: string; propertyId: string | null; propertyLabel: string | null }> {
  const client = input.client ?? liveGoogleClient()
  try {
    if (input.provider === 'SEARCH_CONSOLE') {
      const property = input.propertyId ?? chooseSearchProperty(await client.listSearchSites(input.accessToken), input.host)
      if (!property) {
        await saveFacts(input.connectionId, input.projectId, [])
        return { status: 'MISMATCH', detail: 'No Search Console property matches this Site.', propertyId: null, propertyLabel: null }
      }
      const facts = factsFromSearchRows(await client.querySearch(input.accessToken, property))
      await saveFacts(input.connectionId, input.projectId, facts)
      return { status: 'CONNECTED', detail: 'Search Console numbers are available as context.', propertyId: property, propertyLabel: property }
    }
    const properties = await client.listAnalyticsProperties(input.accessToken)
    const property = input.propertyId
      ? properties.find((item) => item.propertyId === input.propertyId) ?? null
      : chooseAnalyticsProperty(properties, input.host)
    if (!property) {
      await saveFacts(input.connectionId, input.projectId, [])
      return { status: 'MISMATCH', detail: 'No Analytics property matches this Site.', propertyId: null, propertyLabel: null }
    }
    const facts = factsFromAnalyticsRows(await client.queryAnalytics(input.accessToken, property.propertyId))
    await saveFacts(input.connectionId, input.projectId, facts)
    return { status: 'CONNECTED', detail: 'Analytics session counts are available as context.', propertyId: property.propertyId, propertyLabel: property.label }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google could not be read'
    if (/401|403|auth/i.test(message)) {
      return { status: 'NEEDS_REAUTH', detail: 'Reconnect this Google account to keep reading it.', propertyId: input.propertyId ?? null, propertyLabel: null }
    }
    throw error
  }
}

export async function completeGoogleConnection(input: {
  state: string
  code: string
  sessionUserId: string
  hostForProject: (projectId: string, userId: string) => Promise<string | null>
  client?: GoogleConnectionClient
}): Promise<{ projectId: string } | { error: string }> {
  const parsed = readConnectionState(input.state)
  if (!parsed || parsed.userId !== input.sessionUserId) return { error: 'This connection link expired. Start again from Site settings.' }
  const host = await input.hostForProject(parsed.projectId, parsed.userId)
  if (!host) return { error: 'Site not found' }
  const client = input.client ?? liveGoogleClient()
  const tokens = await client.exchangeCode(input.code)
  const connection = await prisma.siteConnection.upsert({
    where: { projectId_provider: { projectId: parsed.projectId, provider: parsed.provider } },
    create: {
      projectId: parsed.projectId,
      provider: parsed.provider,
      scopes: parsed.provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      status: 'NEEDS_REAUTH',
    },
    update: {
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      scopes: parsed.provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
    },
  })
  const synced = await syncGoogleConnection({
    connectionId: connection.id,
    projectId: parsed.projectId,
    provider: parsed.provider,
    host,
    accessToken: tokens.accessToken,
    client,
  })
  await prisma.siteConnection.update({
    where: { id: connection.id },
    data: {
      status: synced.status,
      statusDetail: synced.detail,
      propertyId: synced.propertyId,
      propertyLabel: synced.propertyLabel,
      lastSyncedAt: synced.status === 'CONNECTED' ? new Date() : null,
    },
  })
  return { projectId: parsed.projectId }
}

export async function accessTokenForConnection(connection: {
  id: string
  encryptedAccessToken: string | null
  encryptedRefreshToken: string | null
  tokenExpiresAt: Date | null
}): Promise<string | null> {
  if (!connection.encryptedAccessToken) return null
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() - REFRESH_BUFFER_MS > Date.now()) {
    return decryptSecret(connection.encryptedAccessToken)
  }
  if (!connection.encryptedRefreshToken) return null
  const data = await googlePost('https://oauth2.googleapis.com/token', new URLSearchParams({
    client_id: googleClientId() ?? '',
    client_secret: googleClientSecret() ?? '',
    refresh_token: decryptSecret(connection.encryptedRefreshToken),
    grant_type: 'refresh_token',
  }))
  if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') return null
  await prisma.siteConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptSecret(data.access_token),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  })
  return data.access_token
}
