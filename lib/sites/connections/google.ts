import { createHmac, timingSafeEqual } from 'node:crypto'
import { Prisma, type SiteConnection, type SiteConnectionProvider } from '@prisma/client'
import { getAuthBaseUrl } from '@/lib/auth/env'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { analyticsReportScope, analyticsWatchedPagePaths, ANALYTICS_PAGE_LIMIT, searchReportScope, searchPageFilter, searchPropertyCoversUrl, type SearchReportScope, type AnalyticsReportScope, type AnalyticsReport } from './report-scope'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'
import { GoogleProviderError, googleResponseFailure, readGoogleTokens } from '@/lib/integrations/google-response'
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
  findAnalyticsProperty(accessToken: string, host: string, propertyId?: string): Promise<AnalyticsProperty | null>
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

async function googlePost(url: string, body: URLSearchParams) {
  const response = await googleFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return readGoogleTokens(response)
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
      if (!response.ok) throw await googleResponseFailure(response)
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
      if (!response.ok) throw await googleResponseFailure(response)
      const data = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }> }
      return data.rows ?? []
    },
    async findAnalyticsProperty(accessToken, host, propertyId) {
      let requests = 0
      const read = async (path: string, token?: string) => {
        signal.throwIfAborted()
        if (++requests > 100) throw new Error('Analytics discovery request budget exceeded')
        const url = new URL('https://analyticsadmin.googleapis.com/v1beta/' + path)
        if (path.endsWith('accountSummaries') || path.endsWith('/dataStreams')) url.searchParams.set('pageSize', '200')
        if (token) url.searchParams.set('pageToken', token)
        const response = await request(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!response.ok) throw await googleResponseFailure(response)
        return response
      }
      const nextPage = (token: unknown, seen: Set<string>) => {
        if (token == null || token === '') return undefined
        if (typeof token !== 'string' || token.length > 8192 || seen.has(token)) throw new Error('Analytics discovery pagination is incomplete')
        seen.add(token)
        return token
      }
      const matchingStreams = async (id: string, label: string): Promise<AnalyticsProperty | null> => {
        if (!/^properties\/[0-9]+$/.test(id)) throw new Error('Analytics property identity is unavailable')
        const seen = new Set<string>()
        let token: string | undefined
        do {
          const body = await (await read(id + '/dataStreams', token)).json() as {
            dataStreams?: Array<{ webStreamData?: { defaultUri?: string } }>; nextPageToken?: string
          }
          const candidate = { propertyId: id, label,
            streamUrls: (body.dataStreams ?? []).flatMap(stream => stream.webStreamData?.defaultUri ? [stream.webStreamData.defaultUri] : []) }
          const matched = chooseAnalyticsProperty([candidate], host)
          if (matched) return matched
          token = nextPage(body.nextPageToken, seen)
        } while (token)
        return null
      }
      // A retained property has its own authority. Unrelated properties and
      // account ordering cannot disrupt its next refresh or change its identity.
      if (propertyId) {
        if (!/^properties\/[0-9]+$/.test(propertyId)) throw new Error('Analytics property identity is unavailable')
        const property = await (await read(propertyId)).json() as { displayName?: string }
        return matchingStreams(propertyId, property.displayName ?? propertyId)
      }
      const seen = new Set<string>(), properties = new Set<string>()
      let token: string | undefined
      do {
        const body = await (await read('accountSummaries', token)).json() as {
          accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }>; nextPageToken?: string
        }
        for (const account of body.accountSummaries ?? []) for (const property of account.propertySummaries ?? []) {
          if (!property.property) throw new Error('Analytics property identity is unavailable')
          if (properties.has(property.property)) continue
          properties.add(property.property)
          const matched = await matchingStreams(property.property, property.displayName ?? property.property)
          if (matched) return matched
        }
        token = nextPage(body.nextPageToken, seen)
      } while (token)
      return null
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
      if (!response.ok) throw await googleResponseFailure(response)
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
const activeConnectionProject = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } satisfies Prisma.ProjectWhereInput

async function lockConnectionOwner(tx: Prisma.TransactionClient, projectId: string, userId: string) {
  // Account lifecycle commands acquire User before Project. Keep that order,
  // then compare permission while both rows remain stable through the commit.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR SHARE`
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR SHARE`
}

/** Credentials require an active owner and the admitted, non-revoked grant. */
export function googleConnectionGrantScope(connection: GoogleCredentials, userId: string): Prisma.SiteConnectionWhereInput {
  return { id: connection.id, authorizedByUserId: userId, status: { not: 'REVOKED' }, project: { ...activeConnectionProject, userId },
    ...(connection.encryptedRefreshToken ? { encryptedRefreshToken: connection.encryptedRefreshToken }
      : { encryptedAccessToken: connection.encryptedAccessToken }) }
}

export function googleConnectionCredentialScope(connection: GoogleCredentials, userId: string): Prisma.SiteConnectionWhereInput {
  return { ...googleConnectionGrantScope(connection, userId),
    encryptedAccessToken: connection.encryptedAccessToken, encryptedRefreshToken: connection.encryptedRefreshToken,
    tokenExpiresAt: connection.tokenExpiresAt }
}

async function commitSync(input: { connectionId: string; projectId: string; userId: string; credentialScope: Prisma.SiteConnectionWhereInput; siteUrl?: string }, result: SyncResult,
  facts: ConnectionFact[] | null, observedAt: Date, period: ReportingPeriod) {
  await prisma.$transaction(async tx => {
    await lockConnectionOwner(tx, input.projectId, input.userId)
    const admitted = await tx.siteConnection.updateMany({
      where: { ...input.credentialScope, id: input.connectionId, projectId: input.projectId,
        project: { ...activeConnectionProject, userId: input.userId, ...(input.siteUrl ? { url: input.siteUrl } : {}) },
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
  connectionId: string; projectId: string; userId: string; provider: SiteConnectionProvider; host: string; siteUrl?: string;
  accessToken: string; propertyId?: string | null; client?: GoogleConnectionClient
}): Promise<SyncResult> {
  const connection = await prisma.siteConnection.findFirst({
    where: { id: input.connectionId, projectId: input.projectId, authorizedByUserId: input.userId, provider: input.provider, status: { not: 'REVOKED' },
      project: { ...activeConnectionProject, userId: input.userId, ...(input.siteUrl ? { url: input.siteUrl } : {}) } },
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
      const selected = await client.findAnalyticsProperty(input.accessToken, input.host, input.propertyId ?? undefined)
      const property = selected && (!input.propertyId || selected.propertyId === input.propertyId)
        ? chooseAnalyticsProperty([selected], input.host) : null
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
    const reauthenticate = error instanceof GoogleProviderError && error.requiresReauthentication
    result = { status: reauthenticate ? 'NEEDS_REAUTH' : 'UNAVAILABLE',
      detail: reauthenticate ? 'Reconnect this Google account to keep reading it.'
        : 'Google is unavailable. Earlier context retains its original observation date.',
      propertyId: input.propertyId ?? null, propertyLabel: null }
  }
  // Write failures roll back both state and facts; they cannot claim a successful sync.
  return commitSync({ ...input, credentialScope: googleConnectionCredentialScope(connection, input.userId) }, result, facts, observedAt, period)
}

export async function completeGoogleConnection(input: {
  state: string
  code: string
  sessionUserId: string
  client?: GoogleConnectionClient
}): Promise<{ projectId: string } | { error: string }> {
  const parsed = readConnectionState(input.state)
  if (!parsed || parsed.userId !== input.sessionUserId) return { error: 'This connection link expired. Start again from Integrations.' }
  const project = await prisma.project.findFirst({
    where: { id: parsed.projectId, userId: parsed.userId, ...activeConnectionProject },
    select: { url: true, canonicalHost: true },
  })
  if (!project) return { error: 'Site not found' }
  const client = input.client ?? liveGoogleClient()
  const tokens = await client.exchangeCode(input.code)
  const connection = await prisma.$transaction(async tx => {
    await lockConnectionOwner(tx, parsed.projectId, parsed.userId)
    if (!await tx.project.findFirst({ where: { id: parsed.projectId, userId: parsed.userId,
      ...activeConnectionProject, url: project.url, canonicalHost: project.canonicalHost }, select: { id: true } })) return null
    const previous = await tx.siteConnection.findUnique({
      where: { projectId_provider: { projectId: parsed.projectId, provider: parsed.provider } }, select: { authorizedByUserId: true },
    })
    return tx.siteConnection.upsert({
      where: { projectId_provider: { projectId: parsed.projectId, provider: parsed.provider } },
      create: {
        projectId: parsed.projectId,
        authorizedByUserId: parsed.userId,
        provider: parsed.provider,
        scopes: parsed.provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
        encryptedAccessToken: encryptSecret(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        status: 'NEEDS_REAUTH',
      },
      update: {
        authorizedByUserId: parsed.userId,
        // Retain old facts in storage, but never lend the former owner's
        // property or observation identity to a newly authorized owner.
        ...(previous?.authorizedByUserId !== parsed.userId ? {
          externalAccount: null, propertyId: null, propertyLabel: null, lastSyncedAt: null, lastSyncAttemptAt: null,
        } : {}),
        encryptedAccessToken: encryptSecret(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000),
        scopes: parsed.provider === 'SEARCH_CONSOLE' ? SEARCH_SCOPE : ANALYTICS_SCOPE,
        status: 'NEEDS_REAUTH',
      },
    })
  })
  if (!connection) return { error: C.changed }
  await syncGoogleConnection({
    connectionId: connection.id,
    projectId: parsed.projectId,
    userId: parsed.userId,
    provider: parsed.provider,
    host: project.canonicalHost,
    siteUrl: project.url,
    accessToken: tokens.accessToken,
    client,
  })
  return { projectId: parsed.projectId }
}

export async function accessTokenForConnection(connection: GoogleCredentials, userId: string): Promise<string | null> {
  if (!connection.encryptedAccessToken) return null
  const readCurrent = () => prisma.siteConnection.findFirst({ where: googleConnectionGrantScope(connection, userId) })
  const usableToken = (candidate: GoogleCredentials | null) => candidate?.encryptedAccessToken &&
    (!candidate.tokenExpiresAt || candidate.tokenExpiresAt.getTime() - REFRESH_BUFFER_MS > Date.now())
    ? decryptSecret(candidate.encryptedAccessToken) : null
  const current = await readCurrent()
  if (!current) return null
  const available = usableToken(current)
  if (available) return available
  if (!current.encryptedRefreshToken) return null
  let data: Awaited<ReturnType<typeof readGoogleTokens>>
  try {
    data = await googlePost('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: googleClientId() ?? '',
      client_secret: googleClientSecret() ?? '',
      refresh_token: decryptSecret(current.encryptedRefreshToken),
      grant_type: 'refresh_token',
    }))
  } catch (error) {
    const renewed = usableToken(await readCurrent())
    if (renewed) return renewed
    throw error
  }
  const accessToken = data.access_token
  const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)
  const updated = await prisma.$transaction(async tx => {
    await lockConnectionOwner(tx, current.projectId, userId)
    return tx.siteConnection.updateMany({
      where: googleConnectionCredentialScope(current, userId),
      data: {
        encryptedAccessToken: encryptSecret(accessToken),
        tokenExpiresAt,
      },
    })
  })
  // Independent workers may renew this same grant. Losing the credential write
  // is not revocation when a current, usable token for that grant already won.
  return updated.count === 1 ? accessToken : usableToken(await readCurrent())
}

/** Refresh retained provider context independently of website-check admission. */
export async function refreshDueGoogleContexts(now = new Date(), limit = 20, dependencies: { client?: GoogleConnectionClient; signal?: AbortSignal } = {}) {
  if (!googleConnectionConfigured()) return
  if (dependencies.signal?.aborted) return
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const monitoredProject = { ...activeConnectionProject, watchInterval: { not: null }, watchNextRunAt: { not: null } }
  // Compare grant authority before LIMIT so transferred connections cannot
  // occupy the upkeep batch while the current owner's connections wait.
  const due = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c.id FROM site_connections c
    JOIN projects p ON p.id = c."projectId" AND p."userId" = c."authorizedByUserId"
    JOIN users u ON u.id = c."authorizedByUserId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
      AND p."watchInterval" IS NOT NULL AND p."watchNextRunAt" IS NOT NULL
      AND c.status IN ('CONNECTED', 'UNAVAILABLE')
      AND (c."lastSyncedAt" IS NULL OR c."lastSyncedAt" <= ${cutoff})
      AND (c."lastSyncAttemptAt" IS NULL OR c."lastSyncAttemptAt" <= ${cutoff})
    ORDER BY c."lastSyncAttemptAt" ASC, c.id ASC
    LIMIT ${Math.max(1, Math.min(20, Math.floor(limit)))}`)
  if (!due.length) return
  const rows = await prisma.siteConnection.findMany({
    where: { id: { in: due.map(row => row.id) }, project: monitoredProject, status: { in: ['CONNECTED', 'UNAVAILABLE'] },
      AND: [{ OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: cutoff } }] },
        { OR: [{ lastSyncAttemptAt: null }, { lastSyncAttemptAt: { lte: cutoff } }] }] },
    include: { project: { select: { userId: true, url: true, canonicalHost: true } } },
    orderBy: [{ lastSyncAttemptAt: 'asc' }, { id: 'asc' }], take: Math.max(1, Math.min(20, Math.floor(limit))),
  })
  async function refresh(connection: (typeof rows)[number]) {
    if (dependencies.signal?.aborted) return
    const claimed = await prisma.siteConnection.updateMany({
      where: { ...googleConnectionCredentialScope(connection, connection.project.userId),
        project: { ...monitoredProject, userId: connection.project.userId }, status: { in: ['CONNECTED', 'UNAVAILABLE'] },
        OR: [{ lastSyncAttemptAt: null }, { lastSyncAttemptAt: { lte: cutoff } }] },
      data: { lastSyncAttemptAt: now },
    })
    if (claimed.count !== 1) return
    try {
      const token = await accessTokenForConnection(connection, connection.project.userId)
      if (!token) {
        await prisma.siteConnection.updateMany({ where: googleConnectionCredentialScope(connection, connection.project.userId),
          data: { status: 'NEEDS_REAUTH', statusDetail: 'Reconnect this Google account to keep reading it.' } })
        return
      }
      await syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, userId: connection.project.userId, provider: connection.provider,
        host: connection.project.canonicalHost, siteUrl: connection.project.url, propertyId: connection.propertyId, accessToken: token, client: dependencies.client })
    } catch (error) {
      const reauthenticate = error instanceof GoogleProviderError && error.requiresReauthentication
      await prisma.siteConnection.updateMany({ where: googleConnectionCredentialScope(connection, connection.project.userId),
        data: { status: reauthenticate ? 'NEEDS_REAUTH' : 'UNAVAILABLE', statusDetail: reauthenticate
          ? 'Reconnect this Google account to keep reading it.' : 'Google is unavailable. Earlier context retains its original observation date.' } })
    }
  }
  for (let offset = 0; offset < rows.length && !dependencies.signal?.aborted; offset += 2) {
    const batch = rows.slice(offset, offset + 2)
    // Claims and failure persistence can also fail. Settle both siblings before
    // admitting the next bounded batch, preserving per-connection recovery.
    const results = await Promise.allSettled(batch.map(refresh))
    for (const [index, result] of results.entries()) if (result.status === 'rejected')
      logger.warn('Google context upkeep interrupted; later connections will continue', { connectionId: batch[index].id })
  }
}
