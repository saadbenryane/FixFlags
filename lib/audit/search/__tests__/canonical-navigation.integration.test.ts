import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { readArtifact } from '@/lib/audit/progressive/contracts'
import { browserArtifactSchema } from '@/lib/audit/progressive/snapshots'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { dispatchReadyTasks, reconcileTasks } from '@/lib/audit/progressive/engine'
import { searchReceiptSchema } from '../contracts'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('canonical HTTP authority through client navigation and installed workers', () => {
  const userId = 'canonical-navigation-' + randomUUID(), origin = 'https://example.com'
  const pageUrl = origin + '/', target = origin + '/article?view=full&lang=en'
  let phase = 'missing', targetRequests = 0, projectId: string
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.statusCode = 404; response.end('No sitemap'); return }
    response.setHeader('content-type', 'text/html')
    if (request.url === '/article?view=full&lang=en') {
      targetRequests++
      if (phase === 'missing') { response.statusCode = 404; response.end('Missing canonical target'); return }
      if (phase === 'interrupted') {
        response.write('<html><body>Incomplete canonical target'); setTimeout(() => response.destroy(), 20); return
      }
      response.end('<html><head><title>Canonical article</title></head><body><h1>Canonical article</h1></body></html>'); return
    }
    response.end('<!doctype html><html lang="en"><head><title>Useful application page</title><meta name="description" content="Read useful information for your team.">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="' + target + '"></head><body><main>' +
      '<h1>Useful application page</h1><p>Read useful information before choosing your next step.</p></main>' +
      '<script>history.replaceState(null,"",' + JSON.stringify(target) + ')</script></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External provider unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const create = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => create(browser, url, { ...options,
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
      // These optional collection paths are deliberately unavailable. The
      // HTTP, browser and Search collectors below execute against the fixture.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'search', 'search-resources', 'discovery', 'cross-page'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED') {
    phase = next
    const before = targetRequests
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'canonical-fix-' + next,
      changeSummary: 'Restore the original canonical target response' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'canonical-verify-' + next })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Canonical verification was not admitted')
    await complete(check.verificationAuditId!)
    expect(targetRequests).toBeGreaterThan(before)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
      .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, run.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR'
      : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
  }
  it('refuses borrowed rendered success, independently observes the canonical target, verifies repair and preserves recurrence', async () => {
    const source = await createAndEnqueueAudit({ url: pageUrl, userId })
    await complete(source.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const browser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId, workKind: 'browser', pageUrl } })
    expect(browserArtifactSchema.parse(readArtifact(browser.workResult, 'browser').data).snapshot)
      .toMatchObject({ desktopFinalUrl: target, desktopHttpStatus: 200 })
    const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId, targetKey: 'module:search-canonical' } })
    expect(searchReceiptSchema.parse(receipt.detail).observations).toContainEqual(expect.objectContaining({
      checkId: 'search-canonical-target', disposition: 'failed', observed: target + ': HTTP 404' }))
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'search-canonical-target' } })
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).toMatchObject({ url: pageUrl })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ url: origin })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'missing', 'UNCHANGED')
    await verify(flag.id, 'interrupted', 'INCONCLUSIVE')
    await verify(flag.id, 'healthy', 'IMPROVED')
    phase = 'missing'
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'canonical-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
  }, 180_000)
})
