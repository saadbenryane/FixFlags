import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser } from '@/lib/audit/screenshot'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { readArtifact } from '../contracts'
import { httpArtifactSchema } from '../snapshots'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'
import { SEARCH_DOCUMENT_LIMIT } from '@/lib/audit/search/collect'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('public redirect loop through URL admission and installed workers', () => {
  const userId = 'redirect-loop-' + randomUUID(), pageUrl = 'http://example.com/?token=PRIVATE_VALUE'
  let phase = 'loop', projectId: string, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    const path = new URL(request.url!, pageUrl)
    if (path.pathname === '/' && phase.startsWith('bounded-')) {
      response.setHeader('content-type', 'text/html')
      const start = '<!doctype html><title>Useful service</title><body>'
      if (phase === 'bounded-heading') {
        const prefix = start + '<h1><!--', suffix = '-->Page not found'
        response.end(prefix + 'x'.repeat(SEARCH_DOCUMENT_LIMIT - Buffer.byteLength(prefix + suffix)) + suffix + ' in the troubleshooting guide</h1>')
      } else {
        const heading = '<h1>Page not found</h1>', padding = '<!--' + 'x'.repeat(SEARCH_DOCUMENT_LIMIT) + '-->'
        response.end(start + (phase === 'bounded-closed' ? heading + padding : padding + heading))
      }
      return
    }
    if (phase === 'repaired' || ['/robots.txt', '/sitemap.xml', '/healthy'].includes(path.pathname)) {
      response.setHeader('content-type', path.pathname === '/robots.txt' ? 'text/plain' : 'text/html')
      const padding = path.pathname === '/' ? '<!--' + 'x'.repeat(1_020_000) + '-->' : ''
      response.end(path.pathname === '/robots.txt' ? 'User-agent: *\nAllow: /' : '<!doctype html><html lang="en"><head><title>Useful service</title></head><body><h1>Useful service</h1>' + padding + '</body></html>'); return
    }
    if (phase === 'nonautomatic') { response.writeHead(300, { location: '/healthy' }).end(); return }
    if (phase === 'partial' || phase === 'interrupted') {
      response.setHeader('content-type', 'text/html')
      if (phase === 'partial') {
        response.writeHead(206, { 'content-range': 'bytes 0-16/100' })
        response.end('Partial document.'); return
      }
      response.write('<html><body>Waiting for the rest of the page')
      setTimeout(() => response.destroy(), 20); return
    }
    if (phase === 'cookie') response.setHeader('set-cookie', 'visitor=allowed; Path=/')
    response.writeHead(302, { location: phase === 'chain' ? '/chain/' + (Number(path.pathname.split('/').at(-1)) + 1 || 1)
      : path.pathname === '/again' ? pageUrl : '/again?token=PRIVATE_REDIRECT' })
    response.end()
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== new URL(pageUrl).origin) throw new Error('External transport unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    // HTTP findings remain independent of unavailable browser and media evidence.
    await getAuditTaskQueue('browser').pause()
    worker = startWorker(); await worker.waitUntilReady()
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: userId } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => {
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'check', 'finalize', 'bindings', 'search', 'search-resources', 'discovery'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 40_000, interval: 100 })
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED') {
    phase = next
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'redirect-fix-' + next,
      changeSummary: 'Restore routing to the original public page' })
    const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'redirect-verify-' + next })
    if (!result.ok || !('verificationAuditId' in result)) throw new Error('Verification was not admitted')
    await complete(result.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    expect(await prisma.auditExecutionTask.count({ where: { auditId: result.verificationAuditId!, workKind: 'browser' } })).toBe(0)
    const request = await prisma.runRequest.findFirstOrThrow({ where: { auditId: result.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR' : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
    return result.verificationAuditId!
  }
  it('flags a recorded loop, refuses uncertain endings, independently verifies repair and retains recurrence', async () => {
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: pageUrl,
    userId })
    await complete(source.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const recorded = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId, workKind: 'http', pageUrl } })
    expect(httpArtifactSchema.parse(readArtifact(recorded.workResult, 'http').data).document).toMatchObject({ url: pageUrl,
      status: 302, complete: false, body: null, reason: 'redirect_loop', redirects: expect.any(Array) })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'page-redirect-loop' } })
    expect(flag.fix).toMatch(/redirect/i)
    expect(flag.evidence).not.toContain('PRIVATE_')
    expect(await prisma.flag.count({ where: { auditId: source.auditId, checkId: { startsWith: 'security-' } } })).toBe(0)
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'loop', 'UNCHANGED')
    await verify(flag.id, 'chain', 'INCONCLUSIVE')
    await verify(flag.id, 'cookie', 'INCONCLUSIVE')
    await verify(flag.id, 'partial', 'INCONCLUSIVE')
    await verify(flag.id, 'interrupted', 'INCONCLUSIVE')
    for (const sample of ['bounded-unread', 'bounded-heading', 'bounded-closed'] as const) {
      const explicitFailure = sample === 'bounded-closed'
      const auditId = await verify(flag.id, sample, explicitFailure ? 'UNCHANGED' : 'INCONCLUSIVE')
      const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId, workKind: 'http', pageUrl } })
      expect(httpArtifactSchema.parse(readArtifact(task.workResult, 'http').data).document)
        .toMatchObject({ status: 200, complete: false, reason: 'document_truncated' })
      const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'module:page-response' } })
      expect(receipt.detail).toMatchObject({ passed: false, complete: explicitFailure, assertions: [
        expect.objectContaining({ passed: false, complete: explicitFailure,
          observed: expect.stringContaining(explicitFailure ? 'identifies a missing page' : 'before the page title and headings') }),
      ] })
    }
    const nonautomatic = await verify(flag.id, 'nonautomatic', 'INCONCLUSIVE')
    const stopped = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: nonautomatic, workKind: 'http', pageUrl } })
    expect(httpArtifactSchema.parse(readArtifact(stopped.workResult, 'http').data).document)
      .toMatchObject({ status: 300, finalUrl: pageUrl, redirects: [], reason: 'redirect_unresolved' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).not.toMatchObject({ status: 'FIXED' })
    const repaired = await verify(flag.id, 'repaired', 'IMPROVED')
    const repairedTask = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: repaired, workKind: 'http', pageUrl } })
    expect(httpArtifactSchema.parse(readArtifact(repairedTask.workResult, 'http').data).document)
      .toMatchObject({ status: 200, complete: false, reason: 'document_truncated' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'loop'
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WATCH', scope: 'SITE', url: pageUrl, idempotencyKey: 'redirect-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await getOwnedRun(userId, recurring.runId)).toMatchObject({ result: 'FLAG' })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: recorded.id } })).toEqual(recorded)
  }, 150_000)
})
