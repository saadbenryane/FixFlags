import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'

const localWorker = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
localWorker('retained navigation obligations through installed execution', () => {
  const userId = 'retained-navigation-' + randomUUID(), origin = 'https://example.com'
  const affected = origin + '/pricing/', peer = origin + '/pricing'
  const requests: string[] = []
  const audits = new Set<string>()
  let repaired = false, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.statusCode = 404; response.end('Unavailable'); return }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head>' +
      (request.url === '/pricing/' && !repaired || request.url === '/legacy-pricing/' ? '' : '<title>Useful public plans</title>') +
      '<meta name="description" content="Compare the plans available to your team."></head>' +
      '<body><main><h1>Useful public plans</h1><p>Choose a plan for your team.</p></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External transport unavailable in this fixture')
      requests.push(url.href)
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const url = new URL(route.request().url())
          if (url.origin !== origin) { await route.abort('blockedbyclient'); return }
          requests.push(url.href)
          const response = await nativeFetch(transport + url.pathname + url.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await deleteAuditScreenshotAssets([...audits])
    await prisma.user.deleteMany({ where: { id: userId } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string, timeout = 90_000) {
    audits.add(auditId)
    await vi.waitFor(async () => {
      // Provider, media and unrelated action work is explicitly unavailable.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'bindings', 'search', 'search-resources', 'discovery'] } },
      data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout, interval: 100 })
  }
  it('checks a retained failing URL beside its healthy discovery peer, independently verifies repair and recognizes recurrence', async () => {
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: affected,
    userId })
    await complete(source.auditId)
    const originalReceipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: source.auditId,
      targetKey: 'module:search-presentation', pageUrl: affected } })
    const projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const later = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: peer,
    userId })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: later.auditId } })).executionSpec)
      .toMatchObject({ monitoringPages: [peer, affected] })
    const before = requests.filter(url => url === affected).length
    await complete(later.auditId)
    expect(requests.filter(url => url === affected).length).toBeGreaterThan(before)
    expect(await prisma.auditPage.findFirstOrThrow({ where: { auditId: later.auditId, url: affected } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.flag.findFirstOrThrow({ where: { auditId: later.auditId, checkId: 'title-missing' } })).toMatchObject({ pageUrl: affected })
    const watch = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'retained-watch' })
    await complete(watch.auditId!)
    const pages = await prisma.auditPage.findMany({ where: { auditId: watch.auditId! }, select: { url: true, status: true } })
    expect(pages).toEqual(expect.arrayContaining([origin + '/', peer, affected].map(url => ({ url, status: 'COMPLETED' }))))
    const browserTasks = await prisma.auditExecutionTask.findMany({ where: { auditId: watch.auditId!, workKind: 'browser' }, select: { pageUrl: true } })
    expect(browserTasks.map(task => task.pageUrl).sort()).toEqual([origin + '/', peer, affected].sort())
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: 'title-missing' } })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    expect(flag).toMatchObject({ pageUrl: affected })
    expect(await getOwnedRun(userId, watch.runId)).toMatchObject({ result: 'FLAG' })
    for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
      repaired = outcome === 'IMPROVED'
      const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId: flag.id, idempotencyKey: 'retained-fix-' + outcome,
        changeSummary: 'Restore the title on the retained pricing URL' })
      const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'retained-verify-' + outcome })
      if (!result.ok || !('verificationAuditId' in result)) throw new Error('Verification was not admitted')
      await complete(result.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
    }
    repaired = false
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'retained-recurrence' })
    await complete(recurring.auditId!)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing', pageUrl: affected } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: originalReceipt.id } })).toEqual(originalReceipt)
  }, 240_000)
  it('collects both admitted variants through progressive discovery with local private media', async () => {
    const peer = origin + '/legacy-pricing', affected = peer + '/'
    const admitted = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: peer,
    userId })
    await complete(admitted.auditId, 150_000)
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId } })
    expect(audit.executionSpec).toHaveProperty('engine', 'progressive-v1')
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, targetKey: { startsWith: 'task:' }, workKind: 'browser' } })).toBeGreaterThan(0)
    expect(await prisma.auditPage.findMany({ where: { auditId: audit.id }, select: { url: true, status: true } }))
      .toEqual(expect.arrayContaining([{ url: peer, status: 'COMPLETED' }, { url: affected, status: 'COMPLETED' }]))
    expect(await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'title-missing', pageUrl: affected } }))
      .toMatchObject({ pageUrl: affected })
    expect(requests).toContain(peer)
    expect(requests).toContain(affected)
  }, 180_000)
})
