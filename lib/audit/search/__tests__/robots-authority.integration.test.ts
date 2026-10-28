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
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { dispatchReadyTasks, reconcileTasks } from '@/lib/audit/progressive/engine'
import { readArtifact } from '@/lib/audit/progressive/contracts'
import { resourceArtifactSchema } from '@/lib/audit/progressive/snapshots'
import { searchReceiptSchema } from '../contracts'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('redirected robots authority through URL admission and installed workers', () => {
  const userId = 'robots-authority-' + randomUUID(), pageUrl = 'https://example.com/'
  const rulesUrl = 'https://example.net/shared-rules.txt?site=example.com'
  const requests: string[] = []
  let phase = 'baseline', projectId: string, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') {
      if (phase === 'baseline') { response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return }
      response.writeHead(302, { location: rulesUrl }); response.end(); return
    }
    if (request.url?.startsWith('/shared-rules.txt')) {
      response.setHeader('content-type', 'text/plain')
      response.statusCode = phase === 'unavailable' ? 503 : 200
      response.end(phase === 'unavailable' ? 'Resource unavailable' : 'User-agent: *\n' + (phase === 'allowed' ? 'Allow: /' : 'Disallow: /')); return
    }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset><url><loc>' + pageUrl + '</loc></url></urlset>'); return
    }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Useful public service</title>' +
      '<meta name="description" content="Explore a useful public service for your business."></head>' +
      '<body><main><h1>Useful public service</h1><p>The public service is available.</p></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (![new URL(pageUrl).origin, new URL(rulesUrl).origin].includes(url.origin)) throw new Error('External transport unavailable in this fixture')
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
      // Unrelated providers, media and actions remain explicitly unavailable.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'search', 'search-resources', 'discovery'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
  }
  async function crawl(auditId: string) {
    const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'module:search-crawl' } })
    return { row, receipt: searchReceiptSchema.parse(row.detail) }
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY', categoryArea: 'search', idempotencyKey: key })
    await complete(result.auditId!); return result
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED') {
    phase = next
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'robots-fix-' + next,
      changeSummary: 'Restore the intended public crawl policy' })
    const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'robots-verify-' + next })
    if (!result.ok || !('verificationAuditId' in result)) throw new Error('Robots verification was not admitted')
    await complete(result.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { auditId: result.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR' : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
  }
  it('detects redirected crawl regression, refuses unchanged and unavailable rules, verifies repair and retains recurrence', async () => {
    const baseline = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: pageUrl,
    userId })
    await complete(baseline.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: baseline.auditId } })).projectId!
    expect((await crawl(baseline.auditId)).receipt.observations).toContainEqual(expect.objectContaining({ reason: 'crawl_allowed', disposition: 'passed' }))
    phase = 'blocked'
    const source = await category('robots-redirected-source')
    const recorded = await crawl(source.auditId!)
    expect(recorded.receipt.observations).toContainEqual(expect.objectContaining({ checkId: 'search-crawl-access', reason: 'crawl_policy_regressed',
      disposition: 'failed', evidence: [expect.objectContaining({ url: rulesUrl })] }))
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'search-resources', workInput: { path: ['module'], equals: 'robots' } } })
    expect(resourceArtifactSchema.parse(readArtifact(task.workResult, 'search-resources').data).robots)
      .toMatchObject({ url: pageUrl + 'robots.txt', finalUrl: rulesUrl, redirects: [pageUrl + 'robots.txt'], status: 200, complete: true })
    expect(requests).toContain(rulesUrl)
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'search-crawl-access' } })
    expect(flag.fix).toMatch(/crawl|robots/i)
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'blocked', 'UNCHANGED')
    await verify(flag.id, 'unavailable', 'INCONCLUSIVE')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).not.toMatchObject({ status: 'FIXED' })
    await verify(flag.id, 'allowed', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'blocked'
    const recurring = await category('robots-redirected-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    expect(await getOwnedRun(userId, recurring.runId)).toMatchObject({ result: 'FLAG' })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: recorded.row.id } })).toEqual(recorded.row)
  }, 180_000)
})
