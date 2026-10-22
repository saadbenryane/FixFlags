import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { searchReceiptSchema } from '../contracts'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('sitemap URL identity through the application and installed workers', () => {
  const userId = 'sitemap-owner-' + randomUUID(), projectId = 'sitemap-site-' + randomUUID()
  const origin = 'https://example.com', pageUrl = origin + '/catalog?item=2&lang=en'
  const child = origin + '/sitemap-pages.xml?page=2&type=product'
  const requests: string[] = []
  let excluded = true, missing = false
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    requests.push(request.url!)
    if (request.url === '/robots.txt') {
      response.setHeader('content-type', 'text/plain')
      response.end('User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml'); return
    }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<sitemapindex><sitemap><loc>' + child.replaceAll('&', '&amp;') + '</loc></sitemap></sitemapindex>'); return
    }
    if (request.url?.startsWith('/sitemap-pages.xml')) {
      response.setHeader('content-type', 'application/xml')
      response.statusCode = !missing && origin + request.url === child ? 200 : 404
      response.end(response.statusCode === 200
        ? '<urlset><url><loc>' + pageUrl.replaceAll('&', '&#38;') + '</loc></url></urlset>' : 'Missing sitemap'); return
    }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Useful product catalog</title><meta name="description" content="Explore useful products for your business.">' +
      '<template><meta name="robots" content="noindex"><script type="application/ld+json">{broken}</script></template>' +
      (excluded ? '<meta name="robots" content="noindex">' : '') + '</head><body><main><h1>Useful product catalog</h1><p>Explore our products and services.</p></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External provider unavailable in this fixture')
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
    await prisma.project.create({ data: { id: projectId, userId, canonicalHost: 'example.com', url: pageUrl, name: 'Sitemap identity fixture' } })
    // This admission fixture supplies page scope only, not passing evidence.
    await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', completedAt: new Date(),
      executionSpec: { version: 1, scope: 'SITE', targetUrl: pageUrl, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url: pageUrl, normalizedUrl: pageUrl, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: userId } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
      .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 60_000, interval: 100 })
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY', categoryArea: 'search', idempotencyKey: key })
    await complete(result.auditId!); return result
  }
  async function verify(flagId: string, key: string, outcome: 'UNCHANGED' | 'IMPROVED') {
    const fix = await recordSiteFlagFix({ siteId: projectId, flagId, userId, idempotencyKey: key + ':fix', changeSummary: 'Repair the recorded public Search condition' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: key + ':verify' })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Search verification was not admitted')
    await complete(check.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, run.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR' : 'FLAG' })
  }
  it('detects the real indexing conflict, independently repairs it and preserves resource recovery and recurrence', async () => {
    const baseline = await category('sitemap-baseline')
    const rows = await prisma.auditVerifierExecution.findMany({ where: { auditId: baseline.auditId!, targetKey: 'module:search-indexing' } })
    expect(rows).toHaveLength(1)
    expect(searchReceiptSchema.parse(rows[0].detail).observations).toContainEqual(expect.objectContaining({
      checkId: 'robots-blocks-indexing', reason: 'sitemap_indexing_conflict', disposition: 'failed', checkVersion: 3 }))
    expect(await prisma.flag.count({ where: { auditId: baseline.auditId!, checkId: 'search-structured-invalid' } })).toBe(0)
    expect(requests).toContain('/sitemap-pages.xml?page=2&type=product')
    expect(requests.some(path => path.includes('&amp;'))).toBe(false)
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: baseline.auditId!, checkId: 'robots-blocks-indexing' } })
    expect(await getOwnedRun(userId, baseline.runId)).toMatchObject({ result: 'FLAG' })
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'sitemap-unchanged', 'UNCHANGED')
    excluded = false
    await verify(flag.id, 'sitemap-repaired', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    excluded = true
    const recurring = await category('sitemap-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    excluded = false; missing = true
    const absent = await category('sitemap-child-missing')
    const missingFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: absent.auditId!, checkId: 'sitemap-missing' } })
    expect(missingFlag.evidence).toContain(child)
    expect(missingFlag.evidence).not.toContain('&amp;')
    missing = false
    await verify(missingFlag.id, 'sitemap-child-repaired', 'IMPROVED')
  }, 180_000)
})
