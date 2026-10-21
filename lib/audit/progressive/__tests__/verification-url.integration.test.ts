import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { persistImprovementCycle } from '@/lib/audit/finalize'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { collectDocument, collectSearchEvidence } from '@/lib/audit/search/collect'
import { evaluateSearch } from '@/lib/audit/search/registry'
import { searchReceiptSchema } from '@/lib/audit/search/contracts'
import { recordVerifierExecution } from '@/lib/improvements/verifier-provenance'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('exact recovery resource through saved publication and installed workers', () => {
  const userId = 'verification-url-' + randomUUID()
  const pageUrl = 'https://example.com/pricing/', peerUrl = 'https://example.com/pricing'
  const requests: string[] = []
  let repaired = false, projectId: string, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') {
      response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return
    }
    if (request.url === '/sitemap.xml') { response.statusCode = 404; response.end('Unavailable'); return }
    response.setHeader('content-type', 'text/html')
    const title = request.url === '/pricing/' && !repaired ? '' : '<title>Useful pricing</title>'
    response.end('<!doctype html><html lang="en"><head>' + title +
      '<meta name="description" content="Explore useful pricing for your business."></head>' +
      '<body><main><h1>Useful pricing</h1><p>Compare the available plans.</p></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== new URL(pageUrl).origin) throw new Error('External transport unavailable in this fixture')
      requests.push(url.href)
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== new URL(pageUrl).origin) { await route.abort('blockedbyclient'); return }
          requests.push(resource.href)
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
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
    await vi.waitFor(async () => {
      // Keep unrelated providers, media and actions explicitly incomplete.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'search', 'search-resources', 'discovery'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
  }
  async function verify(flagId: string, outcome: 'UNCHANGED' | 'IMPROVED') {
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'url-fix-' + outcome,
      changeSummary: 'Restore the title on the affected pricing page' })
    const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'url-verify-' + outcome })
    if (!result.ok || !('verificationAuditId' in result)) throw new Error('Verification was not admitted')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: result.verificationAuditId! } })).toMatchObject({ url: pageUrl })
    await complete(result.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { auditId: result.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR' : 'FLAG' })
  }
  it('refuses a healthy peer during partial publication, verifies the exact repair and recognizes recurrence', async () => {
    const source = await createAndEnqueueAudit({ url: pageUrl, userId })
    await complete(source.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'title-missing' } })
    expect(flag).toMatchObject({ pageUrl })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    const sourceReceipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId, targetKey: 'module:search-presentation', pageUrl } })

    // Publish an interrupted broad run with real HTTP and Chromium observations
    // for the healthy peer only. The original resource remains unobserved.
    const executionSpec = { engine: 'progressive-v1', version: 1, targetUrl: peerUrl, environment: 'production', scope: 'SITE',
      monitoringPages: [peerUrl, pageUrl], checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }
    const child = await prisma.audit.create({ data: { userId, projectId, parentId: source.auditId, url: peerUrl,
      status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL', failedModules: ['retained-page'], executionSpec,
      pages: { create: { url: peerUrl, normalizedUrl: peerUrl, position: 0, role: 'primary', status: 'COMPLETED', completeness: 'PARTIAL' } } } })
    for (const target of [peerUrl, pageUrl]) await recordVerifierExecution({ auditId: child.id,
      source: 'DETERMINISTIC', checkId: 'title-missing', pageUrl: target, status: 'PENDING' })
    expect(await prisma.auditVerifierExecution.findMany({ where: { auditId: child.id, checkId: 'title-missing' } }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ pageUrl: peerUrl, scopeKey: 'page:' + peerUrl }),
        expect.objectContaining({ pageUrl, scopeKey: 'page:' + pageUrl })]))
    const deadline = Date.now() + 30_000
    const original = await collectDocument(peerUrl, deadline)
    const session = await pageSessions.createAuditPage(await getAuditBrowser(), peerUrl, { profile: DESKTOP_CAPTURE_PROFILE, deadline })
    try {
      const evidence = await collectSearchEvidence({ auditId: child.id, pageUrl: peerUrl, original,
        renderedHtml: await session.page.content(), renderedComplete: true, finalUrl: session.page.url(),
        status: session.httpStatus, headers: session.responseHeaders, deadline, cache: new Map(), collectCanonicalTargets: false })
      const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: child.id, pageUrl: peerUrl,
        collectedAt: evidence.collectedAt, complete: true, observations: await evaluateSearch(evidence, null, ['presentation']) })
      expect(receipt.observations).toContainEqual(expect.objectContaining({ checkId: 'title-missing', source: 'rendered-dom', disposition: 'passed' }))
      await prisma.auditVerifierExecution.create({ data: { auditId: child.id, targetKey: 'module:search-presentation',
        scopeKey: 'page:' + peerUrl, pageUrl: peerUrl, source: 'DETERMINISTIC', status: 'COMPLETED',
        evidenceReference: { kind: 'search-receipt', auditId: child.id }, detail: receipt } })
    } finally { session.disposeNetwork(); await session.page.context().close() }
    await persistImprovementCycle(child.id, source.auditId)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).not.toMatchObject({ status: 'FIXED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({ reportCompleteness: 'PARTIAL' })
    await verify(flag.id, 'UNCHANGED')
    repaired = true
    await verify(flag.id, 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    repaired = false
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY', categoryArea: 'search', idempotencyKey: 'url-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint, pageUrl })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await getOwnedRun(userId, recurring.runId)).toMatchObject({ result: 'FLAG' })
    expect(requests).toContain(pageUrl); expect(requests).toContain(peerUrl)
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: sourceReceipt.id } })).toEqual(sourceReceipt)
  }, 180_000)
})
