import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { Agent } from 'undici'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { readArtifact } from '../contracts'
import { httpArtifactSchema } from '../snapshots'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'
import { recordedPageEvidence } from '../lifecycle'

vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] })))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('interrupted body evidence through URL admission and installed workers', () => {
  const userId = 'http-body-' + randomUUID(), pageUrl = 'http://example.com/'
  let phase = 'unsafe', requests = 0, projectId: string, dispatcher: Agent
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    requests++
    if (phase === 'missing') { response.destroy(); return }
    for (const [key, value] of Object.entries({
      'content-security-policy': "default-src 'self'; script-src 'self'" + (['safe', 'challenge'].includes(phase) ? '' : " 'unsafe-inline'") + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
      'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'x-permitted-cross-domain-policies': 'none',
      'content-type': 'text/html',
    })) response.setHeader(key, value)
    if (phase === 'navigation') {
      if (request.url === '/navigation') response.end('<!doctype html><base href="/services/">' +
        '<a href="pricing">Pricing</a><a href="missing">Missing page</a>' +
        '<script type="application/ld+json">{"@type":"Product"}</script>'.repeat(51))
      else { response.statusCode = request.url === '/services/missing' ? 404 : 200
        response.end('<!doctype html><title>Service page</title><h1>' + (response.statusCode === 404 ? 'Page not found' : 'Service pricing') + '</h1>') }
      return
    }
    if (phase === 'response-ok') { response.end('<!doctype html><title>Restored public page</title><h1>Useful service</h1>'); return }
    if (phase === 'response-error') response.statusCode = 503
    if (phase === 'challenge') {
      response.statusCode = 503
      response.write('<html><head><title>Just a moment...</title></head><body>Checking your browser')
    } else response.write('<!doctype html><html><head><title>Partial service page</title></head><body>')
    setTimeout(() => response.destroy(), 20)
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    dispatcher = new Agent()
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'http://example.com') throw new Error('External transport unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, { ...options, dispatcher } as RequestInit)
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    // This scenario proves independent public response interpretation. Browser
    // and provider collection remain unavailable, never passing fixture evidence.
    await getAuditTaskQueue('browser').pause()
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
    await dispatcher?.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => {
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'check', 'finalize', 'search', 'search-resources', 'discovery'] } }, data: { workRecoveryUntil: new Date(0) } })
      if (phase === 'missing' && requests > 0)
        await prisma.auditExecutionTask.updateMany({ where: { auditId, workKind: 'http', workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 })
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED') {
    phase = next; requests = 0
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'body-fix-' + next,
      changeSummary: 'Restrict inline script execution in the recorded public response' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'body-verify-' + next })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Header verification was not admitted')
    await complete(check.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
      .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, run.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR'
      : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
  }
  it('flags actual header evidence without certifying incomplete content, verifies repair and preserves recurrence', async () => {
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: pageUrl,
    userId })
    await complete(source.auditId)
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } }); projectId = audit.projectId!
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId, workKind: 'http', pageUrl } })
    expect(task).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
    expect(httpArtifactSchema.parse(readArtifact(task.workResult, 'http').data)).toMatchObject({ metadata: null,
      document: { status: 200, complete: false, reason: 'response_body_unavailable', body: expect.stringContaining('Partial service page') } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'security-csp-unsafe-inline' } })
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    expect(await prisma.flag.count({ where: { auditId: source.auditId, checkId: 'page-http-error' } })).toBe(0)
    const page = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: source.auditId, targetKey: 'module:page-response' } })
    expect(page.detail).toMatchObject({ complete: false, passed: false })
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'unsafe', 'UNCHANGED')
    await verify(flag.id, 'missing', 'INCONCLUSIVE')
    await verify(flag.id, 'challenge', 'INCONCLUSIVE')
    await verify(flag.id, 'safe', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'unsafe'
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'body-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
  }, 180_000)

  it('discovers pages and flags an actual missing destination despite unavailable whole-page metadata', async () => {
    phase = 'navigation'; requests = 0
    const target = pageUrl + 'navigation'
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' }, url: target, userId })
    await complete(source.auditId)
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId, workKind: 'http', pageUrl: target } })
    expect(task).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
    expect(httpArtifactSchema.parse(readArtifact(task.workResult, 'http').data)).toMatchObject({ metadata: null,
      navigation: { documentUrl: target, linkBaseUrl: pageUrl + 'services/', complete: true } })
    const pages = await recordedPageEvidence(source.auditId)
    expect(pages.find(page => page.url === target)?.navigation).toMatchObject({ complete: true,
      links: [{ href: 'pricing', text: 'Pricing' }, { href: 'missing', text: 'Missing page' }] })
    expect(pages.map(page => page.url)).toContain(pageUrl + 'services/pricing')
    expect(await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'broken-internal-links', pageUrl: target } }))
      .toMatchObject({ evidence: expect.stringContaining('/services/missing') })
  }, 90_000)

  it('retains a received server error through interrupted content, refuses partial recovery and independently verifies repair and recurrence', async () => {
    phase = 'response-error'; requests = 0
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' }, url: pageUrl, userId })
    await complete(source.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'page-http-error' } })
    expect(flag.evidence).toContain('HTTP 503')
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    for (const [next, outcome] of [['response-error', 'UNCHANGED'], ['unsafe', 'INCONCLUSIVE'],
      ['challenge', 'INCONCLUSIVE'], ['response-ok', 'IMPROVED']] as const) {
      phase = next; requests = 0
      const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId: flag.id, idempotencyKey: 'page-body-fix-' + next,
        changeSummary: 'Restore the original public page response' })
      const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'page-body-verify-' + next })
      if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Page response verification was not admitted')
      await complete(verified.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
        .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
      const request = await prisma.runRequest.findFirstOrThrow({ where: { auditId: verified.verificationAuditId! } })
      expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR'
        : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
    }
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'response-error'; requests = 0
    const recurring = await requestSiteRun({ projectId, userId, scope: 'SITE', source: 'WATCH', outcomeIds: [], idempotencyKey: 'page-body-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'page-http-error' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
  }, 180_000)
})
