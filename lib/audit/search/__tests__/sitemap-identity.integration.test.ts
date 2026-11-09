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
import { SEARCH_DOCUMENT_LIMIT } from '../collect'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('sitemap URL identity through the application and installed workers', () => {
  const userId = 'sitemap-owner-' + randomUUID(), projectId = 'sitemap-site-' + randomUUID()
  const origin = 'https://example.com', pageUrl = origin + '/catalog?item=2&lang=en'
  const child = origin + '/sitemap-pages.xml?page=2&type=product'
  const sibling = origin + '/sitemap-categories.xml'
  const formats = {
    '/format.xml': { contentType: 'application/xml', invalid: '<urlset><sitemap/></urlset>',
      valid: `<urlset><url><loc>${origin}/xml-page</loc></url></urlset>` },
    '/sitemap.txt': { contentType: 'text/plain', invalid: '/relative', valid: `${pageUrl}\r\n${origin}/text-page\n` },
    '/feed.rss': { contentType: 'application/rss+xml', invalid: '<rss version="2.0">',
      valid: `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Catalog</title><description>Catalog feed</description>` +
        `<link>${origin}/feed-home</link><item><title>RSS page</title><link>${origin}/rss-page</link>` +
        `<media:content url="${origin}/video.mp4"/></item></channel></rss>` },
    '/feed.atom': { contentType: 'application/atom+xml', invalid: '<feed xmlns="http://www.w3.org/2005/Atom">',
      valid: `<feed xmlns="http://www.w3.org/2005/Atom"><title>Catalog</title><id>${origin}/opaque-feed</id>` +
        '<updated>2026-11-08T12:00:00Z</updated><author><name>Catalog owner</name></author>' +
        `<entry><title>Atom page</title><id>${origin}/opaque-item</id><updated>2026-11-08T12:00:00Z</updated>` +
        `<link href="${origin}/atom-page"/><link rel="enclosure" href="${origin}/audio.mp3"/></entry></feed>` },
  }
  const requests: string[] = []
  let excluded = true, originalBodyLimited = true, missing = false, childChallenged = false
  let malformedChild = false, childExtension = false
  let feedPhase: 'invalid' | 'incomplete' | 'valid' | undefined
  let browserIndexing: 'none' | 'matched' | 'changed' = 'none'
  let siblingStatus: 200 | 404 | 503 | undefined = 503
  let firstChild = true, siblingRequested = false, siblingStartedWhileChildPending = false
  let releaseSibling!: () => void
  const siblingRequest = new Promise<void>(resolve => { releaseSibling = resolve })
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer(async (request, response) => {
    requests.push(request.url!)
    if (request.url === '/robots.txt') {
      response.setHeader('content-type', 'text/plain')
      response.end('User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml'); return
    }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      const children = feedPhase ? Object.keys(formats).map(path => origin + path) : siblingStatus === undefined ? [child] : [child, sibling]
      response.end('<sitemapindex>' + children.map(url => '<sitemap><loc>' + url.replaceAll('&', '&amp;') + '</loc></sitemap>').join('') + '</sitemapindex>'); return
    }
    const format = Object.entries(formats).find(([path]) => path === request.url)?.[1]
    if (feedPhase && format) {
      response.setHeader('content-type', format.contentType)
      if (feedPhase === 'incomplete' && request.url !== '/sitemap.txt') response.writeHead(503).end('Temporarily unavailable')
      else response.end(feedPhase === 'invalid' ? format.invalid : format.valid)
      return
    }
    if (request.url?.startsWith('/sitemap-pages.xml')) {
      if (firstChild) {
        firstChild = false
        await Promise.race([siblingRequest, new Promise<void>(resolve => { setTimeout(resolve, 2000).unref() })])
        siblingStartedWhileChildPending = siblingRequested
      }
      response.setHeader('content-type', 'application/xml')
      response.statusCode = !missing && origin + request.url === child ? 200 : 404
      if (childChallenged) response.setHeader('cf-mitigated', 'challenge')
      if (response.statusCode === 404 && !childChallenged) {
        response.write('Missing sitemap')
        setTimeout(() => response.destroy(), 20)
        return
      }
      response.end(response.statusCode === 200
        ? malformedChild ? '<urlset><sitemap><loc>' + origin + '/unrelated.xml</loc></sitemap></urlset>'
          : '<urlset xmlns:x="urn:fixture">' + (childExtension ? '<x:url><x:loc>' + origin + '/unrelated</x:loc></x:url>' : '') +
            '<url><loc>' + pageUrl.replaceAll('&', '&#38;') + '</loc></url></urlset>'
        : 'Missing sitemap'); return
    }
    if (origin + request.url === sibling && siblingStatus !== undefined) {
      siblingRequested = true
      releaseSibling()
      response.setHeader('content-type', 'application/xml')
      response.statusCode = siblingStatus
      response.end(siblingStatus === 200 ? '<urlset><url><loc>' + origin + '/categories</loc></url></urlset>' : 'Sitemap unavailable'); return
    }
    response.setHeader('content-type', 'text/html')
    const original = request.headers['x-fixture-collector'] === 'http'
    if (original ? excluded : browserIndexing !== 'none') response.setHeader('x-robots-tag', 'googlebot: noindex')
    response.end('<!doctype html><html lang="en"><head><title>Useful product catalog</title><meta name="description" content="Explore useful products for your business.">' +
      '<template><meta name="robots" content="noindex"><script type="application/ld+json">{broken}</script></template>' +
      (!original && browserIndexing === 'changed' ? '<script>history.replaceState(null, "", "?item=99&lang=en")</script>' : '') +
      '</head><body><main><h1>Useful product catalog</h1><p>Explore our products and services.</p></main></body></html>' +
      (original && originalBodyLimited ? ' '.repeat(SEARCH_DOCUMENT_LIMIT) : ''))
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
      const headers = new Headers(options?.headers)
      headers.set('x-fixture-collector', 'http')
      return nativeFetch(transport + url.pathname + url.search, { ...options, headers })
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
  async function verify(flagId: string, key: string, outcome: 'UNCHANGED' | 'IMPROVED' | 'INCONCLUSIVE') {
    const fix = await recordSiteFlagFix({ siteId: projectId, flagId, userId, idempotencyKey: key + ':fix', changeSummary: 'Repair the recorded public Search condition' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: key + ':verify' })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Search verification was not admitted')
    await complete(check.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
      .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    const results = { IMPROVED: 'CLEAR', UNCHANGED: 'FLAG', INCONCLUSIVE: 'COULD_NOT_VERIFY' }
    expect(await getOwnedRun(userId, run.id)).toMatchObject({ result: results[outcome] })
    return check.verificationAuditId!
  }
  it('detects the real indexing conflict, independently repairs it and preserves resource recovery and recurrence', async () => {
    const baseline = await category('sitemap-baseline')
    const rows = await prisma.auditVerificationReceipt.findMany({ where: { auditId: baseline.auditId!, targetKey: 'module:search-indexing' } })
    expect(rows).toHaveLength(1)
    const indexing = searchReceiptSchema.parse(rows[0].detail)
    expect(indexing.complete).toBe(false)
    expect(indexing.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'search-indexing-source', source: 'original-html', disposition: 'unknown', reason: 'document_truncated' }),
      expect.objectContaining({ checkId: 'search-indexing-source', source: 'http', disposition: 'observed', observed: 'X-Robots-Tag: googlebot: noindex' }),
      expect.objectContaining({ checkId: 'robots-blocks-indexing', reason: 'sitemap_indexing_conflict', disposition: 'failed', checkVersion: 3 }),
    ]))
    expect(await prisma.flag.count({ where: { auditId: baseline.auditId!, checkId: 'search-structured-invalid' } })).toBe(0)
    expect(requests).toContain('/sitemap-pages.xml?page=2&type=product')
    expect(siblingStartedWhileChildPending).toBe(true)
    expect(requests.some(path => path.includes('&amp;'))).toBe(false)
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: baseline.auditId!, checkId: 'robots-blocks-indexing' } })
    expect(await getOwnedRun(userId, baseline.runId)).toMatchObject({ result: 'FLAG' })
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'sitemap-unchanged', 'UNCHANGED')
    excluded = false
    await verify(flag.id, 'sitemap-header-removed-without-html', 'INCONCLUSIVE')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
    originalBodyLimited = false; siblingStatus = undefined
    browserIndexing = 'matched'
    await verify(flag.id, 'sitemap-browser-header-matched', 'UNCHANGED')
    browserIndexing = 'changed'
    const changed = await verify(flag.id, 'sitemap-browser-route-changed', 'INCONCLUSIVE')
    const scoped = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: changed, targetKey: 'module:search-indexing' } })
    expect(searchReceiptSchema.parse(scoped.detail).observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'search-indexing-source', source: 'rendered-dom', disposition: 'observed' }),
      expect.objectContaining({ checkId: 'search-indexing-source', source: 'http', disposition: 'unknown', reason: 'rendered_response_scope_unavailable' }),
      expect.objectContaining({ checkId: 'robots-blocks-indexing', reason: 'indexing_comparison_incomplete', disposition: 'observed' }),
    ]))
    browserIndexing = 'none'
    await verify(flag.id, 'sitemap-repaired', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    excluded = true; originalBodyLimited = true
    const recurring = await category('sitemap-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    excluded = false; originalBodyLimited = false; missing = true; siblingStatus = 404
    const absent = await category('sitemap-child-missing')
    const missingFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: absent.auditId!, checkId: 'sitemap-missing' } })
    expect(missingFlag.evidence).toContain(child)
    expect(missingFlag.evidence).toContain(sibling)
    expect(missingFlag.evidence).not.toContain('&amp;')
    siblingStatus = 503
    childChallenged = true
    await verify(missingFlag.id, 'sitemap-child-challenged', 'INCONCLUSIVE')
    childChallenged = false
    await verify(missingFlag.id, 'sitemap-child-still-missing', 'UNCHANGED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: missingFlag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    missing = false; siblingStatus = 200; malformedChild = true
    await verify(missingFlag.id, 'sitemap-child-unusable-structure', 'INCONCLUSIVE')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: missingFlag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    malformedChild = false
    await verify(missingFlag.id, 'sitemap-child-repaired', 'IMPROVED')
  }, 180_000)

  it('flags wrong XML entry structure, independently verifies the original file and records recurrence', async () => {
    malformedChild = true
    const before = await category('sitemap-structure-baseline')
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: before.auditId!, checkId: 'search-sitemap-invalid' } })
    expect(flag.evidence).toContain(child)
    const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: before.auditId!, targetKey: 'module:search-discovery' } })
    const original = searchReceiptSchema.parse(row.detail)
    expect(original.complete).toBe(false)
    expect(original.observations).toContainEqual(expect.objectContaining({ checkId: 'search-sitemap-invalid', disposition: 'failed', reason: 'sitemap_invalid_structure' }))
    expect(original.observations).toContainEqual(expect.objectContaining({ checkId: 'search-discovery-links', disposition: 'unknown' }))
    expect(requests).not.toContain('/unrelated.xml')
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'sitemap-structure-unchanged', 'UNCHANGED')
    childChallenged = true
    await verify(flag.id, 'sitemap-structure-unavailable', 'INCONCLUSIVE')
    childChallenged = false; malformedChild = false; childExtension = true
    const repairedAudit = await verify(flag.id, 'sitemap-structure-repaired', 'IMPROVED')
    const repairedRow = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: repairedAudit, targetKey: 'module:search-discovery' } })
    expect(searchReceiptSchema.parse(repairedRow.detail).observations).toContainEqual(expect.objectContaining({
      checkId: 'search-sitemap-contents', observed: '1 page URLs and 0 child sitemaps recorded in this document.',
      evidence: [expect.objectContaining({ url: child })],
    }))
    malformedChild = true
    const recurring = await category('sitemap-structure-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
  }, 100_000)

  it('checks text, RSS and Atom child sitemaps and independently verifies all original files before recovery', async () => {
    feedPhase = 'invalid'
    const before = await category('sitemap-formats-baseline')
    const checkId = 'search-sitemap-invalid'
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: before.auditId!, checkId } })
    for (const path of Object.keys(formats)) expect(flag.evidence).toContain(origin + path)
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'sitemap-formats-unchanged', 'UNCHANGED')
    feedPhase = 'incomplete'
    await verify(flag.id, 'sitemap-formats-partially-repaired', 'INCONCLUSIVE')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
    feedPhase = 'valid'
    const repaired = await verify(flag.id, 'sitemap-formats-repaired', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: repaired, targetKey: 'module:search-discovery' } })
    const receipt = searchReceiptSchema.parse(row.detail)
    expect(receipt.complete).toBe(true)
    for (const [path, count] of [['/format.xml', 1], ['/sitemap.txt', 2], ['/feed.rss', 1], ['/feed.atom', 1]] as const) {
      expect(receipt.observations).toContainEqual(expect.objectContaining({ checkId: 'search-sitemap-contents',
        observed: `${count} page URLs and 0 child sitemaps recorded in this document.`, evidence: [expect.objectContaining({ url: origin + path })] }))
    }
    expect(receipt.observations).toContainEqual(expect.objectContaining({ checkId: 'search-discovery-links',
      disposition: 'observed', observed: expect.stringContaining('This page appears in the parsed sitemap scope.') }))
    feedPhase = 'invalid'
    const recurring = await category('sitemap-formats-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
  }, 100_000)
})
