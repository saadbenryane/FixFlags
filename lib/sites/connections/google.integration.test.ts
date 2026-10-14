import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import { accessTokenForConnection, completeGoogleConnection, googleConnectionGrantScope, liveGoogleClient, refreshDueGoogleContexts, signConnectionState, syncGoogleConnection, type GoogleConnectionClient } from './google'
import { loadSiteConnectionViews, connectionLines } from './read'
import type { AnalyticsReport } from './report-scope'
import { searchReportScope, searchFactScope } from './report-scope'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip

run('Google credential ownership during refresh', () => {
  let userId: string
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable local execution verifier')
    userId = 'google-test-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', preferredTools: [] } })
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    await prisma.user.delete({ where: { id: userId } })
  })
  afterAll(async () => { await prisma.$disconnect() })

  async function connectionFixture(host = 'example.com', provider: 'ANALYTICS' | 'SEARCH_CONSOLE' = 'ANALYTICS') {
    const project = await prisma.project.create({ data: { userId, name: 'Google fixture', url: `https://${host}/`, canonicalHost: host } })
    return prisma.siteConnection.create({ data: {
      projectId: project.id, provider, status: 'CONNECTED',
      encryptedAccessToken: encryptSecret('fixture-expired-access'), encryptedRefreshToken: encryptSecret('fixture-refresh'), tokenExpiresAt: new Date(0),
    } })
  }

  it('bounds domain-property Search context to the owning Site and retains the source URL through persistence', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture-client')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture-secret')
    const initial = await connectionFixture('example.com', 'SEARCH_CONSOLE')
    const propertyId = 'sc-domain:example.com'
    const connection = await prisma.siteConnection.update({ where: { id: initial.id }, data: { propertyId, lastSyncedAt: new Date() } })
    const legacy = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'search_query', pagePath: '/pricing', subject: 'unscoped', impressions: 900 } })
    expect((await loadSiteConnectionViews(connection.projectId)).facts).toEqual([])
    expect(await prisma.siteConnectionFact.findUnique({ where: { id: legacy.id } })).not.toBeNull()
    const transport = vi.fn(async (_target: string, options?: RequestInit) => {
      const query = JSON.parse(options!.body as string)
      const filter = query.dimensionFilterGroups[0].filters[0]
      expect(filter).toMatchObject({ dimension: 'page', operator: 'includingRegex' })
      const pattern = new RegExp(filter.expression)
      expect(pattern.test('https://example.com/pricing')).toBe(true)
      expect(pattern.test('https://shop.example.com/pricing')).toBe(false)
      // Returned rows are also checked locally before hostname information is lost.
      return new Response(JSON.stringify({ rows: [
        { keys: ['https://example.com/pricing', 'plans'], impressions: 80, clicks: 4, position: 6 },
        { keys: ['https://shop.example.com/pricing', 'sibling'], impressions: 900, clicks: 90 },
      ] }))
    })
    vi.stubGlobal('fetch', transport)
    const input = { connectionId: connection.id, projectId: connection.projectId, provider: 'SEARCH_CONSOLE' as const,
      host: 'example.com', siteUrl: 'https://example.com/', propertyId, accessToken: 'fixture-expired-access' }
    await expect(syncGoogleConnection(input)).resolves.toMatchObject({ status: 'CONNECTED' })
    const saved = await prisma.siteConnectionFact.findMany({ where: { connectionId: connection.id } })
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ impressions: 80, clicks: 4, periodStart: expect.any(Date), periodEnd: expect.any(Date),
      reportScope: { version: 1, kind: 'search-hostnames', propertyId, hostnames: ['example.com', 'www.example.com'], pageUrl: 'https://example.com/pricing' } })
    const view = await loadSiteConnectionViews(connection.projectId)
    expect(connectionLines(view.facts, 'https://example.com/pricing').join(' ')).toContain('80 impressions')
    expect(connectionLines(view.facts, 'https://shop.example.com/pricing')).toEqual([])
    await expect(syncGoogleConnection({ ...input, host: 'shop.example.com' })).rejects.toThrow('This connection changed')
    expect(transport).toHaveBeenCalledOnce()
  })

  it('retains dated Search counts when reporting is empty and preserves an explicit zero', async () => {
    const initial = await connectionFixture('example.com', 'SEARCH_CONSOLE')
    const propertyId = 'sc-domain:example.com'
    const connection = await prisma.siteConnection.update({ where: { id: initial.id }, data: { propertyId } })
    const observedAt = new Date('2026-10-01T12:00:00Z')
    const previous = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'search_query', pagePath: '/pricing', subject: 'plans', impressions: 80, clicks: 4, observedAt,
      reportScope: searchFactScope(searchReportScope('example.com', propertyId), 'https://example.com/pricing')! } })
    const querySearch = vi.fn<GoogleConnectionClient['querySearch']>().mockResolvedValue([])
    const client = { querySearch } as unknown as GoogleConnectionClient
    const input = { connectionId: connection.id, projectId: connection.projectId, provider: 'SEARCH_CONSOLE' as const,
      host: 'example.com', propertyId, accessToken: 'fixture-expired-access', client }
    await expect(syncGoogleConnection(input)).resolves.toMatchObject({ status: 'UNAVAILABLE' })
    expect(await prisma.siteConnectionFact.findUniqueOrThrow({ where: { id: previous.id } })).toMatchObject({ impressions: 80, clicks: 4, observedAt })
    querySearch.mockResolvedValueOnce([{ keys: ['https://example.com/pricing', 'plans'], impressions: 0, clicks: 0 }])
    await expect(syncGoogleConnection(input)).resolves.toMatchObject({ status: 'CONNECTED' })
    expect(await prisma.siteConnectionFact.findFirstOrThrow({ where: { connectionId: connection.id } })).toMatchObject({ impressions: 0, clicks: 0 })
  })

  it('scopes a shared Analytics property to the owned Site and preserves unscoped observations without presenting them as current traffic', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture-client')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture-secret')
    const initial = await connectionFixture()
    const connection = await prisma.siteConnection.update({ where: { id: initial.id }, data: { propertyId: 'properties/123', lastSyncedAt: new Date() } })
    const historical = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'analytics_page', pagePath: '/pricing', subject: 'sessions', sessions: 900 } })
    expect((await loadSiteConnectionViews(connection.projectId)).facts).toEqual([])
    expect(await prisma.siteConnectionFact.findUnique({ where: { id: historical.id } })).not.toBeNull()
    const transport = vi.fn(async (target: string, options?: RequestInit) => {
      if (target.endsWith('/accountSummaries')) return new Response(JSON.stringify({ accountSummaries: [{ propertySummaries: [{ property: 'properties/123', displayName: 'Several websites' }] }] }))
      if (target.endsWith('/dataStreams')) return new Response(JSON.stringify({ dataStreams: [
        { webStreamData: { defaultUri: 'https://example.com/' } }, { webStreamData: { defaultUri: 'https://other.example/' } },
      ] }))
      if (target.endsWith(':batchRunReports')) {
        const query = JSON.parse(options!.body as string)
        const hosts = query.requests[0].dimensionFilter.filter.inListFilter.values as string[]
        expect(query.requests[1].dimensionFilter).toEqual(query.requests[0].dimensionFilter)
        expect(query.requests[2].dimensionFilter).toEqual({ andGroup: { expressions: [query.requests[0].dimensionFilter,
          { filter: { fieldName: 'pagePath', inListFilter: { values: ['/'], caseSensitive: true } } }] } })
        expect(hosts).toEqual(['example.com', 'www.example.com'])
        const sessions = [{ host: 'example.com', sessions: 7 }, { host: 'other.example', sessions: 900 }]
          .filter(row => hosts.includes(row.host)).reduce((total, row) => total + row.sessions, 0)
        return new Response(JSON.stringify({ reports: [{ dimensionHeaders: [{ name: 'pagePath' }], metricHeaders: [{ name: 'sessions' }, { name: 'screenPageViews' }], rows: [
          { dimensionValues: [{ value: '/pricing' }], metricValues: [{ value: String(sessions) }, { value: '12' }] },
          { dimensionValues: [{ value: '/other-page' }], metricValues: [{ value: String(sessions) }, { value: '9' }] },
        ] }, { metricHeaders: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }], rows: [{ metricValues: [{ value: String(sessions) }, { value: '5' }, { value: '25' }] }] },
        { dimensionHeaders: [{ name: 'pagePath' }], metricHeaders: [{ name: 'sessions' }, { name: 'screenPageViews' }], rows: [] }] }))
      }
      throw new Error('Unexpected fixture provider request')
    })
    vi.stubGlobal('fetch', transport)
    await syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, provider: 'ANALYTICS', host: 'example.com',
      siteUrl: 'https://example.com/', accessToken: 'fixture-expired-access' })
    const saved = await prisma.siteConnectionFact.findFirstOrThrow({ where: { connectionId: connection.id, kind: 'analytics_page' } })
    expect(saved).toMatchObject({ sessions: 7, pageViews: 12, reportScope: { version: 1, kind: 'analytics-hostnames', propertyId: 'properties/123', hostnames: ['example.com', 'www.example.com'] },
      periodStart: expect.any(Date), periodEnd: expect.any(Date) })
    const audience = await prisma.siteConnectionFact.findFirstOrThrow({ where: { connectionId: connection.id, kind: 'analytics_site' } })
    expect(audience).toMatchObject({ sessions: 7, activeUsers: 5, pageViews: 25, reportScope: saved.reportScope })
    const view = await loadSiteConnectionViews(connection.projectId)
    expect(connectionLines(view.facts, 'https://example.com/pricing').join(' ')).toContain('12 page views')
    expect(connectionLines(view.facts, 'https://other.example/pricing')).toEqual([])
    expect(transport).toHaveBeenCalledTimes(3)
  })
  it('retains earlier scoped metrics when counts are unavailable and distinguishes explicit zero', async () => {
    const initial = await connectionFixture()
    const connection = await prisma.siteConnection.update({ where: { id: initial.id }, data: { propertyId: 'properties/1' } })
    const observedAt = new Date('2026-10-01T12:00:00Z')
    const previous = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'analytics_site', subject: 'audience', sessions: 7, activeUsers: 5, observedAt,
      reportScope: { version: 1, kind: 'analytics-hostnames', propertyId: 'properties/1', hostnames: ['example.com', 'www.example.com'] } } })
    const queryAnalytics = vi.fn(async () => ({ pages: [], audience: {} }))
    const client = { listAnalyticsProperties: async () => [{ propertyId: 'properties/1', label: 'Site', streamUrls: ['https://example.com/'] }], queryAnalytics } as unknown as GoogleConnectionClient
    const input = { connectionId: connection.id, projectId: connection.projectId, provider: 'ANALYTICS' as const, host: 'example.com',
      accessToken: 'fixture-expired-access', client }
    expect(await syncGoogleConnection(input)).toMatchObject({ status: 'UNAVAILABLE' })
    expect(await prisma.siteConnectionFact.findUniqueOrThrow({ where: { id: previous.id } })).toMatchObject({ sessions: 7, activeUsers: 5, observedAt })
    queryAnalytics.mockResolvedValueOnce({ pages: [], audience: { sessions: 0, activeUsers: 0 } })
    expect(await syncGoogleConnection(input)).toMatchObject({ status: 'CONNECTED' })
    expect(await prisma.siteConnectionFact.findFirstOrThrow({ where: { connectionId: connection.id, kind: 'analytics_site' } }))
      .toMatchObject({ sessions: 0, activeUsers: 0 })
  })

  it('collects actual page views for saved watched pages outside the top rows without counting overlapping rows twice', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture-client')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture-secret')
    const connection = await connectionFixture()
    const siteUrl = 'https://example.com/entry'
    await prisma.project.update({ where: { id: connection.projectId }, data: { url: siteUrl } })
    await prisma.sitePage.createMany({ data: ['/watched', '/top-0', '/missing'].map(path => ({ projectId: connection.projectId, url: 'https://example.com' + path, path })) })
    await prisma.sitePage.create({ data: { projectId: connection.projectId, url: 'https://other.example/foreign', path: '/foreign' } })
    const transport = vi.fn(async (_target: string, options?: RequestInit) => {
      const query = JSON.parse(options!.body as string)
      expect(query.requests).toHaveLength(3)
      const expressions = query.requests[2].dimensionFilter.andGroup.expressions
      expect(expressions[0]).toEqual(query.requests[0].dimensionFilter)
      expect(expressions[1].filter.inListFilter.values.sort()).toEqual(['/entry', '/missing', '/top-0', '/watched'])
      expect(query.requests[2].dateRanges).toEqual(query.requests[0].dateRanges)
      const header = { dimensionHeaders: [{ name: 'pagePath' }], metricHeaders: [{ name: 'screenPageViews' }, { name: 'sessions' }] }
      return new Response(JSON.stringify({ reports: [
        { ...header, rows: Array.from({ length: 25 }, (_, i) => ({ dimensionValues: [{ value: '/top-' + i }], metricValues: [{ value: String(200 - i) }, { value: String(100 - i) }] })) },
        { metricHeaders: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'sessions' }], rows: [{ metricValues: [{ value: '1000' }, { value: '20' }, { value: '500' }] }] },
        { ...header, rows: [
          { dimensionValues: [{ value: '/entry' }], metricValues: [{ value: '3' }, { value: '1' }] },
          { dimensionValues: [{ value: '/watched' }], metricValues: [{ value: '9' }, { value: '2' }] },
          { dimensionValues: [{ value: '/top-0' }], metricValues: [{ value: '200' }, { value: '100' }] },
          { dimensionValues: [{ value: '/missing' }], metricValues: [] },
        ] },
      ] }))
    })
    vi.stubGlobal('fetch', transport)
    const client = { ...liveGoogleClient(), listAnalyticsProperties: async () => [{ propertyId: 'properties/123', label: 'Site', streamUrls: ['https://example.com/'] }] }
    await expect(syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, provider: 'ANALYTICS', host: 'example.com',
      siteUrl, accessToken: 'fixture-expired-access', client })).resolves.toMatchObject({ status: 'CONNECTED' })
    const saved = await prisma.siteConnectionFact.findMany({ where: { connectionId: connection.id } })
    expect(saved.filter(fact => fact.pagePath === '/top-0')).toHaveLength(1)
    expect(saved.find(fact => fact.pagePath === '/top-0')).toMatchObject({ pageViews: 200, sessions: 100 })
    expect(saved.find(fact => fact.pagePath === '/watched')).toMatchObject({ pageViews: 9, sessions: 2, periodStart: expect.any(Date), periodEnd: expect.any(Date) })
    expect(saved.find(fact => fact.kind === 'analytics_site')).toMatchObject({ pageViews: 1000, activeUsers: 20, sessions: 500 })
    const view = await loadSiteConnectionViews(connection.projectId)
    expect(connectionLines(view.facts, siteUrl).join(' ')).toContain('3 page views')
    expect(connectionLines(view.facts, 'https://example.com/watched').join(' ')).toContain('9 page views')
    expect(connectionLines(view.facts, 'https://example.com/missing')).toEqual([])
    expect(connectionLines(view.facts, 'https://other.example/watched')).toEqual([])
    expect(transport).toHaveBeenCalledOnce()
  })

  it('cannot restore credentials after disconnect while a refresh request is in flight', async () => {
    const connection = await connectionFixture()
    let finish!: (response: Response) => void
    const transport = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', transport)
    const refreshing = accessTokenForConnection(connection)
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce())
    await prisma.siteConnection.update({ where: { id: connection.id }, data: {
      status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null,
    } })
    finish(new Response(JSON.stringify({ access_token: 'fixture-refreshed-access', expires_in: 3600 }), { status: 200 }))
    expect(await refreshing).toBeNull()
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })).toMatchObject({
      status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null,
    })
  })

  it('cannot overwrite a replacement connection with an older token refresh', async () => {
    const connection = await connectionFixture()
    let finish!: (response: Response) => void
    const transport = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', transport)
    const refreshing = accessTokenForConnection(connection)
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce())
    const replacement = { encryptedAccessToken: encryptSecret('fixture-replacement-access'), encryptedRefreshToken: encryptSecret('fixture-replacement-refresh'),
      tokenExpiresAt: new Date(Date.now() + 3600_000) }
    await prisma.siteConnection.update({ where: { id: connection.id }, data: replacement })
    finish(new Response(JSON.stringify({ access_token: 'fixture-older-refresh', expires_in: 3600 }), { status: 200 }))
    expect(await refreshing).toBeNull()
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })).toMatchObject(replacement)
  })

  it('refuses a cached credential snapshot after its connection has been revoked', async () => {
    const initial = await connectionFixture()
    const connection = await prisma.siteConnection.update({ where: { id: initial.id }, data: { tokenExpiresAt: new Date(Date.now() + 3600_000) } })
    const transport = vi.fn()
    vi.stubGlobal('fetch', transport)
    expect(await accessTokenForConnection(connection)).toBe('fixture-expired-access')
    await prisma.siteConnection.update({ where: { id: connection.id }, data: { status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null } })
    expect(await accessTokenForConnection(connection)).toBeNull()
    expect(transport).not.toHaveBeenCalled()
  })

  it.each(['disconnect', 'replace'] as const)('does not replace saved facts after %s during a provider read', async change => {
    const connection = await connectionFixture()
    const previous = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'analytics', subject: 'retained observation', sessions: 2 } })
    let finish!: (rows: Array<{ pagePath: string; sessions: number }>) => void
    const queryAnalytics = vi.fn(() => new Promise<AnalyticsReport>(resolve => { finish = rows => resolve({ pages: rows, audience: {} }) }))
    const client = { listAnalyticsProperties: async () => [{ propertyId: 'properties/fixture', label: 'Fixture', streamUrls: ['https://example.com/'] }],
      queryAnalytics } as unknown as GoogleConnectionClient
    const reading = syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, provider: 'ANALYTICS',
      host: 'example.com', siteUrl: 'https://example.com/', accessToken: decryptSecret(connection.encryptedAccessToken!), client })
    // Attach the expected rejection before releasing the provider read.
    const rejected = expect(reading).rejects.toThrow('This connection changed')
    await vi.waitFor(() => expect(queryAnalytics).toHaveBeenCalledOnce())
    const replacement = change === 'disconnect' ? { status: 'REVOKED' as const, encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null }
      : { status: 'CONNECTED' as const, encryptedAccessToken: encryptSecret('fixture-new-account'), encryptedRefreshToken: encryptSecret('fixture-new-refresh'),
          tokenExpiresAt: new Date(Date.now() + 3600_000), propertyId: 'properties/replacement' }
    await prisma.siteConnection.update({ where: { id: connection.id }, data: replacement })
    finish([{ pagePath: '/', sessions: 99 }])
    await rejected
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })).toMatchObject(replacement)
    expect(await prisma.siteConnectionFact.findMany({ where: { connectionId: connection.id } })).toEqual([previous])
  })

  it('commits current credentials and traffic facts together after a successful refresh', async () => {
    const connection = await connectionFixture()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'fixture-current-access', expires_in: 3600 }), { status: 200 })))
    const token = await accessTokenForConnection(connection)
    expect(token).toBe('fixture-current-access')
    const client = { listAnalyticsProperties: async () => [{ propertyId: 'properties/fixture', label: 'Fixture', streamUrls: ['https://example.com/'] }],
      queryAnalytics: async () => ({ pages: [{ pagePath: '/', sessions: 7 }], audience: {} }) } as unknown as GoogleConnectionClient
    expect(await syncGoogleConnection({ connectionId: connection.id, projectId: connection.projectId, provider: 'ANALYTICS',
      host: 'example.com', siteUrl: 'https://example.com/', accessToken: token!, client })).toMatchObject({ status: 'CONNECTED' })
    const saved = await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id }, include: { facts: true } })
    expect(saved.lastSyncedAt).toBeInstanceOf(Date)
    expect(saved.facts).toHaveLength(1)
    expect(saved.facts[0]).toMatchObject({ sessions: 7, pagePath: '/' })
  })

  it('keeps a grant comparable across token refresh but refuses stale permission writes after replacement', async () => {
    const connection = await connectionFixture()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'fixture-current-access', expires_in: 3600 }), { status: 200 })))
    expect(await accessTokenForConnection(connection)).toBe('fixture-current-access')
    const scope = googleConnectionGrantScope(connection)
    expect((await prisma.siteConnection.updateMany({ where: scope, data: { status: 'NEEDS_REAUTH' } })).count).toBe(1)
    await prisma.siteConnection.update({ where: { id: connection.id }, data: {
      status: 'CONNECTED', encryptedAccessToken: encryptSecret('fixture-new-account'), encryptedRefreshToken: encryptSecret('fixture-new-grant'),
    } })
    expect((await prisma.siteConnection.updateMany({ where: scope, data: { status: 'NEEDS_REAUTH' } })).count).toBe(0)
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })).toMatchObject({ status: 'CONNECTED' })
  })

  it('does not retain a previous account refresh token when new authorization supplies none', async () => {
    const connection = await connectionFixture()
    vi.stubEnv('BETTER_AUTH_SECRET', 'google-authorization-fixture-secret')
    const client = {
      exchangeCode: async () => ({ accessToken: 'fixture-new-access', refreshToken: null, expiresInSeconds: 3600 }),
      listAnalyticsProperties: async () => [{ propertyId: 'properties/fixture', label: 'Fixture', streamUrls: ['https://example.com/'] }],
      queryAnalytics: async () => ({ pages: [], audience: { sessions: 0, activeUsers: 0 } }),
    } as unknown as GoogleConnectionClient
    const state = signConnectionState({ userId, projectId: connection.projectId, provider: 'ANALYTICS' })
    expect(await completeGoogleConnection({ state, code: 'fixture-auth-code', sessionUserId: userId,
      hostForProject: async () => 'https://example.com/', client })).toEqual({ projectId: connection.projectId })
    const saved = await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })
    expect(saved.status).toBe('CONNECTED')
    expect(decryptSecret(saved.encryptedAccessToken!)).toBe('fixture-new-access')
    expect(saved.encryptedRefreshToken).toBeNull()
  })

  async function monitoredContext(host: string, now: Date) {
    const connection = await connectionFixture(host)
    await prisma.project.update({ where: { id: connection.projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 7 * 86400_000) } })
    return prisma.siteConnection.update({ where: { id: connection.id }, data: { tokenExpiresAt: new Date(now.getTime() + 3600_000) } })
  }

  function contextClient(hosts: string[], queryAnalytics: GoogleConnectionClient['queryAnalytics']) {
    return { listAnalyticsProperties: async () => hosts.map((host, index) => ({ propertyId: `properties/${index}`, label: host, streamUrls: [`https://${host}/`] })),
      queryAnalytics } as unknown as GoogleConnectionClient
  }

  function enableGoogleFixture() {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture-google-client')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture-google-secret')
  }

  it('refreshes a weekly Site context before its next analysis while leaving paused and deleted Sites untouched', async () => {
    enableGoogleFixture()
    const now = new Date()
    const active = await monitoredContext('active.example.com', now)
    const paused = await connectionFixture('paused.example.com')
    const deleted = await monitoredContext('deleted.example.com', now)
    await prisma.project.update({ where: { id: deleted.projectId }, data: { deletedAt: now } })
    const queryAnalytics = vi.fn(async () => ({ pages: [{ pagePath: '/', sessions: 5 }], audience: {} }))
    await refreshDueGoogleContexts(now, 20, { client: contextClient(['active.example.com'], queryAnalytics) })
    expect(queryAnalytics).toHaveBeenCalledOnce()
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ status: 'CONNECTED', lastSyncedAt: expect.any(Date) })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: active.projectId } })).toMatchObject({ watchNextRunAt: new Date(now.getTime() + 7 * 86400_000) })
    for (const id of [paused.id, deleted.id]) expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id } })).toMatchObject({ lastSyncAttemptAt: null, lastSyncedAt: null })
  })

  it('claims a due context once across competing sweeps and respects its daily freshness window', async () => {
    enableGoogleFixture()
    vi.useFakeTimers({ toFake: ['Date'] })
    const now = new Date('2026-10-13T12:00:00Z')
    vi.setSystemTime(now)
    const connection = await monitoredContext('example.com', now)
    const queryAnalytics = vi.fn(async () => ({ pages: [{ pagePath: '/', sessions: 5 }], audience: {} }))
    const client = contextClient(['example.com'], queryAnalytics)
    await Promise.all([refreshDueGoogleContexts(now, 20, { client }), refreshDueGoogleContexts(now, 20, { client })])
    await refreshDueGoogleContexts(new Date(now.getTime() + 23 * 3600_000), 20, { client })
    expect(queryAnalytics).toHaveBeenCalledOnce()
    // Keep the same grant valid so the next daily observation exercises the provider read.
    vi.setSystemTime(new Date(now.getTime() + 24 * 3600_000))
    await prisma.siteConnection.update({ where: { id: connection.id }, data: { tokenExpiresAt: new Date(Date.now() + 3600_000) } })
    await refreshDueGoogleContexts(new Date(), 20, { client })
    expect(queryAnalytics).toHaveBeenCalledTimes(2)
  })

  it('bounds concurrent provider reads and stops admitting later contexts when its scheduler lease is lost', async () => {
    enableGoogleFixture()
    const now = new Date()
    const hosts = ['one.example.com', 'two.example.com', 'three.example.com']
    const connections = await Promise.all(hosts.map(host => monitoredContext(host, now)))
    const finish: Array<() => void> = []
    const queryAnalytics = vi.fn(() => new Promise<AnalyticsReport>(resolve => { finish.push(() => resolve({ pages: [{ pagePath: '/', sessions: 1 }], audience: {} })) }))
    const controller = new AbortController()
    const refreshing = refreshDueGoogleContexts(now, 3, { client: contextClient(hosts, queryAnalytics), signal: controller.signal })
    try {
      await vi.waitFor(() => expect(queryAnalytics).toHaveBeenCalledTimes(2))
      controller.abort()
    } finally {
      finish.forEach(resolve => resolve())
      await refreshing
    }
    expect(queryAnalytics).toHaveBeenCalledTimes(2)
    const saved = await prisma.siteConnection.findMany({ where: { id: { in: connections.map(connection => connection.id) } } })
    expect(saved.filter(connection => connection.lastSyncedAt)).toHaveLength(2)
    expect(saved.filter(connection => connection.lastSyncAttemptAt === null)).toHaveLength(1)
  })

  it('keeps previous dated facts when a scheduled provider read fails', async () => {
    enableGoogleFixture()
    const now = new Date()
    const connection = await monitoredContext('example.com', now)
    const previous = await prisma.siteConnectionFact.create({ data: { connectionId: connection.id, projectId: connection.projectId,
      kind: 'analytics', subject: 'previous report', sessions: 5, observedAt: new Date(now.getTime() - 3 * 86400_000) } })
    const queryAnalytics = vi.fn(async () => { throw new Error('Provider unavailable') })
    await refreshDueGoogleContexts(now, 20, { client: contextClient(['example.com'], queryAnalytics) })
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { id: connection.id } })).toMatchObject({ status: 'UNAVAILABLE', lastSyncedAt: null, lastSyncAttemptAt: expect.any(Date) })
    expect(await prisma.siteConnectionFact.findMany({ where: { connectionId: connection.id } })).toEqual([previous])
  })
})
