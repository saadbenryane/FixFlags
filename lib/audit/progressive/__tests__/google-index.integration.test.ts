import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getOwnedRun, requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, getBrowserDiagnostics, closeBrowser } from '@/lib/audit/screenshot'
import { encryptSecret } from '@/lib/security/crypto'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { searchReceiptSchema } from '@/lib/audit/search/contracts'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlags } from '@/lib/sites/flags'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Google indexed-version worker observations', () => {
  const userId = 'google-index-' + randomUUID(), projectId = 'google-index-' + randomUUID()
  const origin = 'https://example.com', pageUrl = origin + '/', peerUrl = origin + '/pricing', property = 'sc-domain:example.com'
  let fetchState = 'SUCCESSFUL', verdict = 'PASS', crawl = '2026-10-01T00:00:00Z'
  let peerCrawl = crawl
  let currentProperty = property
  let providerRequests = 0
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml'); return }
    if (request.url === '/sitemap.xml') { response.setHeader('content-type', 'application/xml'); response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + pageUrl + '</loc></url></urlset>'); return }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Useful Google indexing fixture ' + request.url + '</title><meta name="description" content="Useful information about our service."><link rel="canonical" href="' + (request.url === '/pricing' ? peerUrl : pageUrl) + '"></head><body><main><h1>Useful service information</h1><p>Read about our service and how it works.</p><a href="/pricing">Prices</a></main></body></html>')
  })
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname)) throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'searchconsole.googleapis.com' && url.pathname === '/v1/urlInspection/index:inspect') {
        providerRequests++
        const requested = JSON.parse(String(options?.body))
        expect([pageUrl, peerUrl]).toContain(requested.inspectionUrl)
        expect(requested.siteUrl).toBe(currentProperty)
        expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-search-access')
        return new Response(JSON.stringify({ inspectionResult: { indexStatusResult: { verdict, lastCrawlTime: requested.inspectionUrl === peerUrl ? peerCrawl : crawl, pageFetchState: fetchState,
          robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', ...(verdict === 'PASS' ? { googleCanonical: requested.inspectionUrl } : {}), userCanonical: requested.inspectionUrl } } }))
      }
      if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/searchAnalytics/query')) {
        providerRequests++
        const filter = JSON.parse(String(options?.body)).dimensionFilterGroups[0].filters[0]
        expect(filter).toMatchObject({ dimension: 'page', operator: 'equals' })
        expect([pageUrl, peerUrl]).toContain(filter.expression)
        return new Response(JSON.stringify({ rows: [] }))
      }
      if (url.origin !== origin) throw new Error('External service unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Google indexing fixture', canonicalHost: 'example.com', url: pageUrl } })
    // Admission needs a previously discovered page. This scope fixture supplies
    // no passing coverage; the Google baseline runs through the actual worker.
    await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', completedAt: new Date(),
      executionSpec: { version: 1, scope: 'SITE', targetUrl: pageUrl, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: [pageUrl, peerUrl].map((url, position) => ({ url, normalizedUrl: url, role: position ? 'pricing' : 'primary', position, status: 'COMPLETED' })) } } })
    await prisma.siteConnection.create({ data: { projectId, provider: 'SEARCH_CONSOLE', status: 'CONNECTED', propertyId: property,
      encryptedAccessToken: encryptSecret('fixture-search-access'), tokenExpiresAt: new Date(Date.now() + 3600_000) } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 60_000, interval: 200 })
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY', categoryArea: 'search', idempotencyKey: key })
    await complete(result.auditId!); return result
  }
  it('keeps unconfigured Search Console optional without treating a revoked connection as successful evidence', async () => {
    const connection = await prisma.siteConnection.findUniqueOrThrow({ where: { projectId_provider: { projectId, provider: 'SEARCH_CONSOLE' } } })
    await prisma.siteConnection.delete({ where: { id: connection.id } })
    const before = providerRequests
    try {
      const unconfigured = await category('google-unconfigured')
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: unconfigured.auditId! } })
      expect(audit.failedModules).not.toEqual(expect.arrayContaining(['search-google-index', 'search-google-performance']))
      const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: unconfigured.auditId!, targetKey: { startsWith: 'module:search-google' } } })
      expect(receipts).toHaveLength(4)
      expect(receipts.every(item => item.status === 'NOT_APPLICABLE')).toBe(true)
      for (const receipt of receipts) expect(searchReceiptSchema.parse(receipt.detail)).toMatchObject({ complete: false,
        observations: [expect.objectContaining({ disposition: 'unknown', reason: 'NOT_CONNECTED' })] })
      expect(providerRequests).toBe(before)
      expect((await getOwnedRun(userId, unconfigured.runId))?.completionState).toBe('FULL')
      const home = (await loadSiteHome(projectId))!
      expect(home.cards.find(item => item.id === 'search')).toMatchObject({ evidenced: true, incompleteReason: null })
      expect((await loadSiteSummaries(userId)).find(item => item.id === projectId)?.presentation.coverage)
        .toEqual(home.presentation.coverage)
      await prisma.siteConnection.create({ data: { ...connection, status: 'REVOKED' } })
      const revoked = await category('google-revoked')
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: revoked.auditId! } })).toMatchObject({
        reportCompleteness: 'PARTIAL', failedModules: expect.arrayContaining(['search-google-index', 'search-google-performance']) })
      const unavailable = await prisma.auditVerifierExecution.findMany({ where: { auditId: revoked.auditId!, targetKey: { startsWith: 'module:search-google' } } })
      expect(unavailable.every(item => item.status === 'COMPLETED')).toBe(true)
      expect(providerRequests).toBe(before)
    } finally {
      await prisma.siteConnection.deleteMany({ where: { projectId, provider: 'SEARCH_CONSOLE' } })
      await prisma.siteConnection.create({ data: connection })
    }
  }, 120_000)
  it('persists soft 404 evidence, refuses stale repair proof, verifies a later crawl and preserves recurrence', async () => {
    await category('google-index-baseline')
    verdict = 'NEUTRAL'; fetchState = 'SOFT_404'; crawl = '2026-10-10T00:00:00Z'; peerCrawl = '2026-10-12T00:00:00Z'
    const failure = await category('google-index-failure')
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: failure.auditId!, checkId: 'indexing-failure' } })
    expect(flag.evidence).toContain('SOFT_404')
    expect(flag.affectedPaths).toEqual(expect.arrayContaining([pageUrl, peerUrl]))
    const site = (await loadSiteRecord(projectId))!
    const sourceHistory = async () => (await loadMonitoringHistory(site)).timeline.find(entry => entry.id === failure.auditId)
    expect(await getOwnedRun(userId, failure.runId)).toMatchObject({ result: 'FLAG' })
    expect(await loadSiteFlags(site)).toEqual(expect.arrayContaining([expect.objectContaining({ sourceFlagId: flag.id, checkId: 'indexing-failure' })]))
    expect(await sourceHistory()).toMatchObject({ result: 'FLAG', flagCount: 1,
      flags: [{ id: flag.id, title: flag.problem }] })
    const saved = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { auditId_targetKey_scopeKey: {
      auditId: failure.auditId!, targetKey: 'module:search-google-index', scopeKey: 'page:' + pageUrl } } })
    expect(searchReceiptSchema.parse(saved.detail).observations.find(item => item.checkId === 'search-google-fetch'))
      .toMatchObject({ reason: 'google_soft_404_recorded', google: { property, pageFetchState: 'SOFT_404', lastCrawlAt: crawl } })
    verdict = 'PASS'; fetchState = 'SUCCESSFUL'
    for (const phase of ['stale', 'changed-property', 'partial', 'unconfigured', 'fresh'] as const) {
      currentProperty = phase === 'changed-property' ? pageUrl : property
      await prisma.siteConnection.update({ where: { projectId_provider: { projectId, provider: 'SEARCH_CONSOLE' } }, data: { propertyId: currentProperty } })
      if (phase === 'partial' || phase === 'fresh') crawl = '2026-10-11T00:00:00Z'
      if (phase === 'partial') peerCrawl = '2026-10-11T00:00:00Z'
      if (phase === 'fresh') peerCrawl = '2026-10-13T00:00:00Z'
      const disconnected = phase === 'unconfigured'
        ? await prisma.siteConnection.findUniqueOrThrow({ where: { projectId_provider: { projectId, provider: 'SEARCH_CONSOLE' } } }) : null
      if (disconnected) await prisma.siteConnection.delete({ where: { id: disconnected.id } })
      try {
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'google-index-fix-' + phase, changeSummary: 'Restore useful content and allow Google to recrawl' })
        const check = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'google-index-verify-' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: 'indexing-failure', parentAuditId: failure.auditId!, attemptId: fix.attemptId } })
        await complete(check.auditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: phase === 'fresh' ? 'IMPROVED' : 'INCONCLUSIVE', comparable: phase === 'fresh' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'fresh' ? 'FIXED' : 'OPEN' })
        if (disconnected) {
          const provider = await prisma.auditVerifierExecution.findMany({ where: { auditId: check.auditId!, targetKey: 'module:search-google-index' } })
          expect(provider).toHaveLength(2)
          expect(provider.every(item => item.status === 'COMPLETED' && !searchReceiptSchema.parse(item.detail).complete)).toBe(true)
          expect((await getOwnedRun(userId, check.runId))?.result).toBe('COULD_NOT_VERIFY')
        }
      } finally { if (disconnected) await prisma.siteConnection.create({ data: disconnected }) }
    }
    expect(await loadSiteFlags(site)).not.toEqual(expect.arrayContaining([expect.objectContaining({ checkId: 'indexing-failure' })]))
    expect(await sourceHistory()).toMatchObject({ result: 'FLAG', flagCount: 1,
      flags: [{ id: flag.id, title: flag.problem }] })
    verdict = 'NEUTRAL'; fetchState = 'SOFT_404'; crawl = '2026-10-13T12:00:00Z'; peerCrawl = '2026-10-13T18:00:00Z'
    const recurring = await category('google-index-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'indexing-failure' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    const source = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: source.improvementId })
    expect((await loadMonitoringHistory(site)).timeline.find(entry => entry.id === recurring.auditId))
      .toMatchObject({ result: 'FLAG', flagCount: 1, flags: [{ id: recurrence.id, title: recurrence.problem }] })
  }, 240_000)
})
