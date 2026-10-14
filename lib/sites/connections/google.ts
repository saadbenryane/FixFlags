import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Prisma, SiteConnection, SiteConnectionProvider } from '@prisma/client'
import { getAuthBaseUrl } from '@/lib/auth/env'
import { prisma } from '@/lib/db'
import { analyticsReportScope, analyticsWatchedPagePaths, ANALYTICS_PAGE_LIMIT, searchReportScope, searchPageFilter, searchPropertyCoversUrl, type SearchReportScope, type AnalyticsReportScope, type AnalyticsReport } from './report-scope'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'
import {
  chooseAnalyticsProperty,
  chooseSearchProperty,
  factsFromAnalyticsRows,
  factsFromAnalyticsAudience,
  factsFromSearchRows,
  type AnalyticsProperty,
  type ConnectionFact,
  canonicalHost,
} from '@/lib/sites/connections/match'

export type ReportingPeriod = { startDate: string; endDate: string }

function reportingPeriod(now = new Date()): ReportingPeriod {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

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
  querySearch(accessToken: string, scope: SearchReportScope, period: ReportingPeriod): Promise<Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }>>
  listAnalyticsProperties(accessToken: string): Promise<AnalyticsProperty[]>
  queryAnalytics(accessToken: string, scope: AnalyticsReportScope, period: ReportingPeriod, watchedPagePaths?: string[]): Promise<AnalyticsReport>
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

function googleFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(10_000) })
}

async function googlePost(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await googleFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof payload.error_description === 'string' ? payload.error_description : 'Google request failed')
  return payload
}

export function liveGoogleClient(): GoogleConnectionClient {
  const signal = AbortSignal.timeout(20_000)
  const request = (url: string, options: RequestInit = {}) => googleFetch(url, { ...options, signal })
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
      const response = await request('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error(`Search Console list failed (${response.status})`)
      const data = await response.json() as { siteEntry?: Array<{ siteUrl: string }> }
      return data.siteEntry ?? []
    },
    async querySearch(accessToken, scope, period) {
      const response = await request(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(scope.propertyId)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: period.startDate,
          endDate: period.endDate,
          dimensions: ['page', 'query'],
          dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'page', operator: 'includingRegex', expression: searchPageFilter(scope) }] }],
          rowLimit: 25,
        }),
      })
      if (!response.ok) throw new Error(`Search Console query failed (${response.status})`)
      const data = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }> }
      return data.rows ?? []
    },
    async listAnalyticsProperties(accessToken) {
      const response = await request('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
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
          const streams = await request(`https://analyticsadmin.googleapis.com/v1beta/${property.property}/dataStreams`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (!streams.ok) throw new Error(`Analytics streams failed (${streams.status})`)
          const streamBody = await streams.json() as { dataStreams?: Array<{ webStreamData?: { defaultUri?: string } }> }
          properties.push({
            propertyId: property.property,
            label: property.displayName ?? property.property,
            streamUrls: (streamBody.dataStreams ?? []).flatMap((stream) => stream.webStreamData?.defaultUri ? [stream.webStreamData.defaultUri] : []),
          })
        }
      }
      return properties
    },
    async queryAnalytics(accessToken, scope, period, watchedPagePaths = []) {
      const shared = { dateRanges: [period], dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: scope.hostnames, caseSensitive: false } } } }
      const pageReportRequest = { ...shared, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }, { dimension: { dimensionName: 'pagePath' } }], limit: ANALYTICS_PAGE_LIMIT }
      const watched = [...new Set(watchedPagePaths)].slice(0, ANALYTICS_PAGE_LIMIT)
      const response = await request(`https://analyticsdata.googleapis.com/v1beta/${scope.propertyId}:batchRunReports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [pageReportRequest,
            { ...shared, metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }], limit: 1 },
            ...(watched.length ? [{ ...pageReportRequest, dimensionFilter: { andGroup: { expressions: [shared.dimensionFilter,
              { filter: { fieldName: 'pagePath', inListFilter: { values: watched, caseSensitive: true } } }] } } }] : [])],
        }),
      })
      if (!response.ok) throw new Error(`Analytics report failed (${response.status})`)
      const data = await response.json() as { reports?: Array<{ dimensionHeaders?: Array<{ name?: string }>; metricHeaders?: Array<{ name?: string }>;
        rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> }> }
      const pageReports = [data.reports?.[0], ...(watched.length ? [data.reports?.[2]] : [])], audienceReport = data.reports?.[1]
      const audienceSessions = audienceReport?.metricHeaders?.findIndex(header => header.name === 'sessions') ?? -1
      const activeUsers = audienceReport?.metricHeaders?.findIndex(header => header.name === 'activeUsers') ?? -1
      const audienceViews = audienceReport?.metricHeaders?.findIndex(header => header.name === 'screenPageViews') ?? -1
      if (data.reports?.length !== (watched.length ? 3 : 2) || [audienceSessions, activeUsers, audienceViews].some(index => index < 0))
        throw new Error('Analytics report columns are unavailable')
      const metric = (value: string | undefined) => value?.trim() ? Number(value) : undefined
      const pages = pageReports.flatMap(report => {
        const path = report?.dimensionHeaders?.findIndex(header => header.name === 'pagePath') ?? -1
        const sessions = report?.metricHeaders?.findIndex(header => header.name === 'sessions') ?? -1
        const views = report?.metricHeaders?.findIndex(header => header.name === 'screenPageViews') ?? -1
        if ([path, sessions, views].some(index => index < 0)) throw new Error('Analytics report columns are unavailable')
        return (report?.rows ?? []).slice(0, ANALYTICS_PAGE_LIMIT).map(row => ({ pagePath: row.dimensionValues?.[path]?.value,
          sessions: metric(row.metricValues?.[sessions]?.value), pageViews: metric(row.metricValues?.[views]?.value) }))
      })
      // A watched page may also be a top page. Use its single provider aggregate, never add both copies.
      return { pages: [...new Map(pages.map(page => [page.pagePath, page])).values()],
        audience: { sessions: metric(audienceReport?.rows?.[0]?.metricValues?.[audienceSessions]?.value),
          activeUsers: metric(audienceReport?.rows?.[0]?.metricValues?.[activeUsers]?.value),
          pageViews: metric(audienceReport?.rows?.[0]?.metricValues?.[audienceViews]?.value) } }
    },
    async revoke(token) {
      await request('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => undefined)
    },
  }
}

type SyncResult = { status: 'CONNECTED' | 'MISMATCH' | 'NEEDS_REAUTH' | 'UNAVAILABLE'; detail: string; propertyId: string | null; propertyLabel: string | null }

type GoogleCredentials = Pick<SiteConnection, 'id' | 'encryptedAccessToken' | 'encryptedRefreshToken' | 'tokenExpiresAt'>

/** A delayed request cannot adopt credentials from a revoked or replaced grant. */
export function googleConnectionGrantScope(connection: GoogleCredentials): Prisma.SiteConnectionWhereInput {
  return { id: connection.id, status: { not: 'REVOKED' }, project: { deletedAt: null },
    ...(connection.encryptedRefreshToken ? { encryptedRefreshToken: connection.encryptedRefreshToken }
      : { encryptedAccessToken: connection.encryptedAccessToken }) }
}

export function googleConnectionCredentialScope(connection: GoogleCredentials): Prisma.SiteConnectionWhereInput {
  return { ...googleConnectionGrantScope(connection),
    encryptedAccessToken: connection.encryptedAccessToken, encryptedRefreshToken: connection.encryptedRefreshToken,
    tokenExpiresAt: connection.tokenExpiresAt }
}

async function commitSync(input: { connectionId: string; projectId: string; credentialScope: Prisma.SiteConnectionWhereInput; siteUrl?: string }, result: SyncResult,
  facts: ConnectionFact[] | null, observedAt: Date, period: ReportingPeriod) {
  await prisma.$transaction(async tx => {
    const admitted = await tx.siteConnection.updateMany({
      where: { ...input.credentialScope, id: input.connectionId, projectId: input.projectId,
        project: { deletedAt: null, ...(input.siteUrl ? { url: input.siteUrl } : {}) },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: observedAt } }] },
      data: { lastSyncAttemptAt: observedAt, status: result.status, statusDetail: result.detail,
        ...(['CONNECTED', 'MISMATCH'].includes(result.status) ? { propertyId: result.propertyId, propertyLabel: result.propertyLabel } : {}), ...(result.status === 'CONNECTED' ? { lastSyncedAt: observedAt } : {}) },
    })
    if (admitted.count !== 1) throw new Error(C.changed)
    if (facts !== null) {
      await tx.siteConnectionFact.deleteMany({ where: { connectionId: input.connectionId } })
      if (facts.length) await tx.siteConnectionFact.createMany({ data: facts.map(fact => ({
        kind: fact.kind, pagePath: fact.pagePath, subject: fact.subject, clicks: fact.clicks,
        impressions: fact.impressions, sessions: fact.sessions, activeUsers: fact.activeUsers, pageViews: fact.pageViews, position: fact.position,
        connectionId: input.connectionId, projectId: input.projectId, observedAt,
        periodStart: new Date(period.startDate), periodEnd: new Date(period.endDate),
        ...(fact.reportScope ? { reportScope: fact.reportScope } : {}),
      })) })
    }
  })
  return result
}

export async function syncGoogleConnection(input: {
  connectionId: string; projectId: string; provider: SiteConnectionProvider; host: string; siteUrl?: string;
  accessToken: string; propertyId?: string | null; client?: GoogleConnectionClient
}): Promise<SyncResult> {
  const connection = await prisma.siteConnection.findFirst({
    where: { id: input.connectionId, projectId: input.projectId, provider: input.provider, status: { not: 'REVOKED' },
      project: { deletedAt: null, ...(input.siteUrl ? { url: input.siteUrl } : {}) } },
    select: { id: true, encryptedAccessToken: true, encryptedRefreshToken: true, tokenExpiresAt: true,
      project: { select: { canonicalHost: true, url: true, ...(input.provider === 'ANALYTICS'
        ? { sitePages: { select: { url: true }, orderBy: [{ updatedAt: 'desc' as const }, { id: 'asc' as const }], take: ANALYTICS_PAGE_LIMIT } } : {}) } } },
  })
  if (!connection?.encryptedAccessToken) throw new Error(C.changed)
  if (canonicalHost(input.host) !== canonicalHost(connection.project.canonicalHost)) throw new Error(C.changed)
  const recordedToken = Buffer.from(decryptSecret(connection.encryptedAccessToken))
  const suppliedToken = Buffer.from(input.accessToken)
  if (recordedToken.length !== suppliedToken.length || !timingSafeEqual(recordedToken, suppliedToken)) throw new Error(C.changed)
  const client = input.client ?? liveGoogleClient()
  const observedAt = new Date()
  const period = reportingPeriod(observedAt)
  let result: SyncResult
  let facts: ConnectionFact[] | null = null
  try {
    if (input.provider === 'SEARCH_CONSOLE') {
      const properties = input.propertyId ? [] : await client.listSearchSites(input.accessToken)
      const property = input.propertyId ?? (input.siteUrl
        ? properties.find(property => searchPropertyCoversUrl(property.siteUrl, input.siteUrl!))?.siteUrl ?? null
        : chooseSearchProperty(properties, input.host))
      if (!property || input.siteUrl && !searchPropertyCoversUrl(property, input.siteUrl)) {
        result = { status: 'MISMATCH', detail: 'No Search Console property matches this Site.', propertyId: null, propertyLabel: null }
      } else {
        const scope = searchReportScope(input.host, property)
        facts = factsFromSearchRows(await client.querySearch(input.accessToken, scope, period), scope)
        if (!facts.some(fact => fact.impressions !== null || fact.clicks !== null)) {
          facts = null
          result = { status: 'UNAVAILABLE', detail: C.searchMissingCounts, propertyId: property, propertyLabel: property }
        } else result = { status: 'CONNECTED', detail: 'Search Console numbers are available as context.', propertyId: property, propertyLabel: property }
      }
    } else {
      const properties = await client.listAnalyticsProperties(input.accessToken)
      const property = input.propertyId ? properties.find(item => item.propertyId === input.propertyId &&
        chooseAnalyticsProperty([item], input.host)) ?? null : chooseAnalyticsProperty(properties, input.host)
      if (!property) result = { status: 'MISMATCH', detail: 'No Analytics property matches this Site.', propertyId: null, propertyLabel: null }
      else {
        const scope = analyticsReportScope(input.host, property.propertyId)
        const watched = analyticsWatchedPagePaths(connection.project.url, connection.project.sitePages?.map(page => page.url) ?? [], scope)
        const report = await client.queryAnalytics(input.accessToken, scope, period, watched)
        facts = [...factsFromAnalyticsRows(report.pages, scope), ...factsFromAnalyticsAudience(report.audience, scope)]
        if (!facts.some(fact => fact.sessions !== null || fact.activeUsers != null || fact.pageViews != null)) {
          facts = null
          result = { status: 'UNAVAILABLE', detail: C.analyticsMissingCounts, propertyId: property.propertyId, propertyLabel: property.label }
        } else result = { status: 'CONNECTED', detail: C.analyticsAvailable, propertyId: property.propertyId, propertyLabel: property.label }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    result = { status: /401|403|auth/i.test(message) ? 'NEEDS_REAUTH' : 'UNAVAILABLE',
      detail: /401|403|auth/i.test(message) ? 'Reconnect this Google account to keep reading it.'
        : 'Google is unavailable. Earlier context retains its original observation date.',
      propertyId: input.propertyId ?? null, propertyLabel: null }
  }
  // Write failures roll back both state and facts; they cannot claim a successful sync.
  return commitSync({ ...input, credentialScope: googleConnectionCredentialScope(connection) }, result, facts, observedAt, period)
}

export async function completeGoogleConnection(input: {
  state: string
  code: string
  sessionUserId: string
  hostForProject: (projectId: string, userId: string) => Promise<string | null>
  client?: GoogleConnectionClient
}): Promise<{ projectId: string } | { error: string }> {
  const parsed = readConnectionState(input.state)
  if (!parsed || parsed.userId !== input.sessionUserId) return { error: 'This connection link expired. Start again from Integrations.' }
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
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      scopes: parsed.provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
      status: 'NEEDS_REAUTH',
    },
  })
  await syncGoogleConnection({
    connectionId: connection.id,
    projectId: parsed.projectId,
    provider: parsed.provider,
    host: host.includes('://') ? new URL(host).hostname : host,
    siteUrl: host.includes('://') ? host : undefined,
    accessToken: tokens.accessToken,
    client,
  })
  return { projectId: parsed.projectId }
}

export async function accessTokenForConnection(connection: GoogleCredentials): Promise<string | null> {
  if (!connection.encryptedAccessToken) return null
  const credentialScope = googleConnectionCredentialScope(connection)
  if (!await prisma.siteConnection.findFirst({ where: credentialScope, select: { id: true } })) return null
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
  if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) return null
  const updated = await prisma.siteConnection.updateMany({
    where: credentialScope,
    data: {
      encryptedAccessToken: encryptSecret(data.access_token),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  })
  return updated.count === 1 ? data.access_token : null
}

/** Refresh retained provider context independently of website-check admission. */
export async function refreshDueGoogleContexts(now = new Date(), limit = 20, dependencies: { client?: GoogleConnectionClient; signal?: AbortSignal } = {}) {
  if (!googleConnectionConfigured()) return
  if (dependencies.signal?.aborted) return
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const monitoredProject = { deletedAt: null, watchInterval: { not: null }, watchNextRunAt: { not: null } }
  const rows = await prisma.siteConnection.findMany({
    where: { project: monitoredProject, status: { in: ['CONNECTED', 'UNAVAILABLE'] },
      AND: [{ OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: cutoff } }] },
        { OR: [{ lastSyncAttemptAt: null }, { lastSyncAttemptAt: { lte: cutoff } }] }] },
    include: { project: { select: { url: true, canonicalHost: true } } },
    orderBy: [{ lastSyncAttemptAt: 'asc' }, { id: 'asc' }], take: Math.max(1, Math.min(20, Math.floor(limit))),
  })
  async function refresh(connection: (typeof rows)[number]) {
    if (dependencies.signal?.aborted) return
    const claimed = await prisma.siteConnection.updateMany({
      where: { ...googleConnectionCredentialScope(connection), project: monitoredProject, status: { in: ['CONNECTED', 'UNAVAILABLE'] },
        OR: [{ lastSyncAttemptAt: null }, { lastSyncAttemptAt: { lte: cutoff } }] },
      data: { lastSyncAttemptAt: now },
    })
    if (claimed.count !== 1) return
    try {
      const token = await accessTokenForConnection(connection)
      if (!token) {
        await prisma.siteConnection.updateMany({ where: googleConnectionCredentialScope(connection),
          data: { status: 'NEEDS_REAUTH', statusDetail: 'Reconnect this Google account to keep reading it.' } })
        return
      }
      await syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, provider: connection.provider,
        host: connection.project.canonicalHost, siteUrl: connection.project.url, propertyId: connection.propertyId, accessToken: token, client: dependencies.client })
    } catch {
      await prisma.siteConnection.updateMany({ where: googleConnectionCredentialScope(connection),
        data: { status: 'UNAVAILABLE', statusDetail: 'Google is unavailable. Earlier context retains its original observation date.' } })
    }
  }
  for (let offset = 0; offset < rows.length && !dependencies.signal?.aborted; offset += 2) {
    await Promise.all(rows.slice(offset, offset + 2).map(refresh))
  }
}
