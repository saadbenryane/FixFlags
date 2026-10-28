import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import { runGoogleSearchForAudit } from '../google'
import { searchReceiptSchema } from '../contracts'
import { assessSearchRecovery } from '../recovery'
import { getGscAccessToken } from '@/lib/integrations/google-search-console'
import { decryptSecret } from '@/lib/security/crypto'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Search provider authorization at evidence commit', () => {
  const owner = 'search-grant-' + randomUUID(), stranger = owner + '-other'
  const pageUrl = 'https://example.com/', property = 'sc-domain:example.com'
  let hold: Promise<void> | undefined
  let requests = 0
  let tokenUnavailable = false
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.createMany({ data: [owner, stranger].map(id => ({ id, email: id + '@example.test' })) })
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      requests++
      await hold
      if (url.hostname === 'oauth2.googleapis.com') return tokenUnavailable
        ? Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers: { 'retry-after': '13' } })
        : Response.json({ access_token: 'refreshed-access', refresh_token: 'refreshed-grant', expires_in: 3600 })
      if (url.hostname === 'searchconsole.googleapis.com') return Response.json({ inspectionResult: {
        indexStatusResult: { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED',
          lastCrawlTime: '2026-10-26T00:00:00Z', googleCanonical: pageUrl, userCanonical: pageUrl },
      } })
      if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/searchAnalytics/query')) return Response.json({ rows: [
        { keys: ['service', pageUrl, 'DESKTOP', 'USA'], clicks: 20, impressions: 100, ctr: 0.2, position: 2 },
      ] })
      throw new Error('External transport unavailable in this fixture')
    })
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.user.deleteMany({ where: { id: { in: [owner, stranger] } } })
    await prisma.$disconnect()
  })

  it.each([false, true])('defers a temporary token-service outage and records only recovered provider evidence (legacy: %s)', async legacy => {
    const site = await prisma.project.create({ data: { userId: owner, name: 'Google token outage fixture', url: pageUrl,
      canonicalHost: randomUUID() + '.example.com' } })
    if (legacy) await prisma.gscConnection.create({ data: { userId: owner, siteUrl: property, accessToken: encryptSecret('expired-access'),
      refreshToken: encryptSecret('fixture-refresh'), tokenExpiry: new Date(0) } })
    else await prisma.siteConnection.create({ data: { projectId: site.id, authorizedByUserId: owner, provider: 'SEARCH_CONSOLE', status: 'CONNECTED', propertyId: property,
      encryptedAccessToken: encryptSecret('expired-access'), encryptedRefreshToken: encryptSecret('fixture-refresh'), tokenExpiresAt: new Date(0) } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner, url: pageUrl } })
    const input = { auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000, deferTransient: true }
    try {
      tokenUnavailable = true
      const interrupted = await runGoogleSearchForAudit(input)
      expect(interrupted.receipts[0]).toMatchObject({ complete: false,
        observations: [expect.objectContaining({ reason: 'PROVIDER_UNAVAILABLE' }), expect.objectContaining({ reason: 'PROVIDER_UNAVAILABLE' })] })
      expect(interrupted.retryAfterMs).toBe(13_000)
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: audit.id } })).toBe(0)
      expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(0)
      if (!legacy) expect(await prisma.siteConnection.findUniqueOrThrow({ where: { projectId_provider: { projectId: site.id, provider: 'SEARCH_CONSOLE' } } }))
        .toMatchObject({ status: 'CONNECTED', tokenExpiresAt: new Date(0) })
      tokenUnavailable = false
      expect((await runGoogleSearchForAudit(input)).receipts[0].complete).toBe(true)
      expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(1)
      expect(await prisma.searchPerformance.count({ where: { auditId: audit.id } })).toBe(1)
    } finally {
      tokenUnavailable = false
      if (legacy) await prisma.gscConnection.deleteMany({ where: { userId: owner } })
    }
  })

  it('keeps independently scheduled index and performance checks authorized when both renew one expired Site credential', async () => {
    const site = await prisma.project.create({ data: { userId: owner, name: 'Concurrent Google fixture', url: pageUrl,
      canonicalHost: randomUUID() + '.example.com' } })
    await prisma.siteConnection.create({ data: { projectId: site.id, authorizedByUserId: owner, provider: 'SEARCH_CONSOLE', status: 'CONNECTED',
      propertyId: property, encryptedAccessToken: encryptSecret('expired-access'), encryptedRefreshToken: encryptSecret('fixture-refresh'),
      tokenExpiresAt: new Date(0) } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner, url: pageUrl } })
    requests = 0
    let release!: () => void
    hold = new Promise<void>(resolve => { release = resolve })
    const base = { auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000 }
    const checking = Promise.all([
      runGoogleSearchForAudit({ ...base, sections: ['index'], receiptModule: 'search-google-index' }),
      runGoogleSearchForAudit({ ...base, sections: ['analytics'], receiptModule: 'search-google-performance' }),
    ])
    try { await vi.waitFor(() => expect(requests).toBe(2)) } finally { release(); hold = undefined }
    const results = await checking
    for (const result of results) expect(result.receipts).toEqual([expect.objectContaining({ complete: true,
      observations: expect.not.arrayContaining([expect.objectContaining({ reason: 'AUTH_EXPIRED' })]) })])
    expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(1)
    expect(await prisma.searchPerformance.count({ where: { auditId: audit.id } })).toBe(1)
    expect(await prisma.siteConnection.findUniqueOrThrow({ where: { projectId_provider: { projectId: site.id, provider: 'SEARCH_CONSOLE' } } }))
      .toMatchObject({ status: 'CONNECTED' })
  })

  it.each(['revoked', 'replaced', 'property', 'owner', 'deleted', 'access-refresh'] as const)(
    'retains the current grant boundary after an in-flight %s change', async phase => {
      requests = 0
      const site = await prisma.project.create({ data: { userId: owner, name: 'Search grant fixture', url: pageUrl, canonicalHost: randomUUID() + '.example.com' } })
      const connection = await prisma.siteConnection.create({ data: { projectId: site.id, authorizedByUserId: owner, provider: 'SEARCH_CONSOLE', status: 'CONNECTED',
        propertyId: property, encryptedAccessToken: encryptSecret('fixture-access'), encryptedRefreshToken: encryptSecret('fixture-refresh'),
        tokenExpiresAt: new Date(Date.now() + 3600_000) } })
      const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner, url: pageUrl } })
      let release!: () => void
      hold = new Promise<void>(resolve => { release = resolve })
      const result = runGoogleSearchForAudit({ auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000 })
      const settled = result.then(value => ({ value, error: null }), error => ({ value: null, error }))
      try {
        await vi.waitFor(() => expect(requests).toBe(2))
        if (phase === 'owner') await prisma.project.update({ where: { id: site.id }, data: { userId: stranger } })
        else if (phase === 'deleted') await prisma.siteConnection.delete({ where: { id: connection.id } })
        else await prisma.siteConnection.update({ where: { id: connection.id }, data: phase === 'revoked'
          ? { status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null }
          : phase === 'replaced' ? { encryptedAccessToken: encryptSecret('new-access'), encryptedRefreshToken: encryptSecret('new-grant') }
            : phase === 'property' ? { propertyId: pageUrl }
              : { encryptedAccessToken: encryptSecret('refreshed-access'), tokenExpiresAt: new Date(Date.now() + 7200_000) } })
        release()
        const completed = await settled
        expect(completed.error).toBeNull()
        const saved = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'module:search-google' } })
        const receipt = searchReceiptSchema.parse(saved.detail)
        if (phase === 'access-refresh') {
          expect(receipt.complete).toBe(true)
          expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(1)
          expect(await prisma.searchPerformance.count({ where: { auditId: audit.id } })).toBe(1)
          await prisma.siteConnection.update({ where: { id: connection.id }, data: { status: 'REVOKED' } })
          const replay = await runGoogleSearchForAudit({ auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000 })
          expect(replay.receipts[0]).toEqual(receipt)
          expect(requests).toBe(2)
        } else {
          expect(receipt).toMatchObject({ complete: false, observations: [
            { source: 'google-index', disposition: 'unknown', reason: 'AUTHORIZATION_CHANGED' },
            { source: 'google-analytics', disposition: 'unknown', reason: 'AUTHORIZATION_CHANGED' },
          ] })
          expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(0)
          expect(await prisma.searchPerformance.count({ where: { auditId: audit.id } })).toBe(0)
          expect(completed.value?.findings).toEqual([])
          expect(assessSearchRecovery(receipt, 'indexing-failure', { policy: 'search', version: 1, kind: 'flag',
            reason: 'google_indexing_regression', sources: ['google-index'], google: { property, lastCrawlAt: '2026-10-25T00:00:00Z' } }))
            .toMatchObject({ comparable: false, verdict: 'unknown' })
        }
      } finally {
        release(); await settled; hold = undefined
        await prisma.project.delete({ where: { id: site.id } })
      }
    })

  it.each(['replaced', 'property', 'owner', 'deleted', 'access-refresh'] as const)(
    'fences a legacy account grant after an in-flight %s change', async phase => {
      requests = 0
      const site = await prisma.project.create({ data: { userId: owner, name: 'Legacy Search grant fixture', url: pageUrl, canonicalHost: randomUUID() + '.example.com' } })
      const connection = await prisma.gscConnection.create({ data: { userId: owner, siteUrl: property,
        accessToken: encryptSecret('legacy-access'), refreshToken: encryptSecret('legacy-refresh'), tokenExpiry: new Date(Date.now() + 3600_000) } })
      const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner, url: pageUrl } })
      let release!: () => void
      hold = new Promise<void>(resolve => { release = resolve })
      const result = runGoogleSearchForAudit({ auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000 })
      const settled = result.then(value => ({ value, error: null }), error => ({ value: null, error }))
      try {
        await vi.waitFor(() => expect(requests).toBe(2))
        if (phase === 'owner') await prisma.project.update({ where: { id: site.id }, data: { userId: stranger } })
        else if (phase === 'deleted') await prisma.gscConnection.delete({ where: { id: connection.id } })
        else await prisma.gscConnection.update({ where: { id: connection.id }, data: phase === 'replaced'
          ? { refreshToken: encryptSecret('new-grant'), accessToken: encryptSecret('new-access') }
          : phase === 'property' ? { siteUrl: pageUrl } : { accessToken: encryptSecret('refreshed-access'), tokenExpiry: new Date(Date.now() + 7200_000) } })
        release()
        const completed = await settled
        expect(completed.error).toBeNull()
        const receipt = completed.value!.receipts[0]
        expect(receipt.complete).toBe(phase === 'access-refresh')
        expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(phase === 'access-refresh' ? 1 : 0)
        expect(await prisma.searchPerformance.count({ where: { auditId: audit.id } })).toBe(phase === 'access-refresh' ? 1 : 0)
        if (phase !== 'access-refresh') expect(receipt.observations.every(item => item.reason === 'AUTHORIZATION_CHANGED' && item.disposition === 'unknown')).toBe(true)
      } finally {
        release(); await settled; hold = undefined
        await prisma.gscConnection.deleteMany({ where: { userId: owner } })
        await prisma.project.delete({ where: { id: site.id } })
      }
    })

  it.each(['replaced', 'inactive', 'deleted'] as const)('cannot overwrite a legacy credential after %s during refresh', async phase => {
    requests = 0
    const connection = await prisma.gscConnection.create({ data: { userId: owner, siteUrl: property, accessToken: encryptSecret('expired-access'),
      refreshToken: encryptSecret('initial-grant'), tokenExpiry: new Date(0) } })
    let release!: () => void
    hold = new Promise<void>(resolve => { release = resolve })
    const result = getGscAccessToken(owner)
    try {
      await vi.waitFor(() => expect(requests).toBe(1))
      if (phase === 'inactive') await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'SUSPENDED' } })
      else if (phase === 'deleted') await prisma.gscConnection.delete({ where: { id: connection.id } })
      else await prisma.gscConnection.update({ where: { id: connection.id }, data: { accessToken: encryptSecret('replacement-access'),
        refreshToken: encryptSecret('replacement-grant'), tokenExpiry: new Date(Date.now() + 7200_000) } })
      const changed = await prisma.gscConnection.findUnique({ where: { id: connection.id } })
      release()
      expect(await result).toBeNull()
      expect(await prisma.gscConnection.findUnique({ where: { id: connection.id } })).toEqual(changed)
    } finally {
      release(); await result; hold = undefined
      await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'ACTIVE' } })
      await prisma.gscConnection.deleteMany({ where: { userId: owner } })
    }
  })

  it('retains provider authority when a normal legacy refresh rotates its refresh token', async () => {
    requests = 0
    const site = await prisma.project.create({ data: { userId: owner, name: 'Refreshed legacy grant fixture', url: pageUrl, canonicalHost: randomUUID() + '.example.com' } })
    const connection = await prisma.gscConnection.create({ data: { userId: owner, siteUrl: property, accessToken: encryptSecret('expired-access'),
      refreshToken: encryptSecret('initial-grant'), tokenExpiry: new Date(0) } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner, url: pageUrl } })
    try {
      const result = await runGoogleSearchForAudit({ auditId: audit.id, userId: owner, pages: [{ url: pageUrl }], deadline: Date.now() + 10_000 })
      expect(result.receipts[0].complete).toBe(true)
      expect(requests).toBe(3)
      const refreshed = await prisma.gscConnection.findUniqueOrThrow({ where: { id: connection.id } })
      expect(decryptSecret(refreshed.refreshToken)).toBe('refreshed-grant')
      expect(await prisma.indexStatus.count({ where: { auditId: audit.id } })).toBe(1)
    } finally {
      await prisma.gscConnection.deleteMany({ where: { userId: owner } })
      await prisma.project.delete({ where: { id: site.id } })
    }
  })
})
