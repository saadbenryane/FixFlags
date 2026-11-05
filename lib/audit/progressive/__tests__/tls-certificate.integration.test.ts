import { randomUUID } from 'node:crypto'
import { createServer as httpServer } from 'node:http'
import { createServer as httpsServer } from 'node:https'
import { Agent } from 'undici'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import { createTestTlsCertificates } from '@/lib/audit/__tests__/tls-certificates'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { readArtifact } from '../contracts'
import { httpArtifactSchema } from '../snapshots'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('public certificate findings through URL admission and installed workers', () => {
  const userId = 'certificate-' + randomUUID(), pageUrl = 'http://example.com/?creator=PRIVATE_VALUE'
  const secureUrl = 'https://example.com/secure?session=PRIVATE_TLS_VALUE'
  let phase = 'expired', projectId: string
  let tls: ReturnType<typeof createTestTlsCertificates>, worker: ReturnType<typeof startWorker> | undefined
  let plain: ReturnType<typeof httpServer>, secure: ReturnType<typeof httpsServer>
  let trusted: Agent, unknownTrust: Agent
  const refusals: string[] = []
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    tls = createTestTlsCertificates()
    const body = '<!doctype html><html lang="en"><head><title>Useful public service</title></head><body><main><h1>Useful public service</h1><p>The requested service is available.</p></main></body></html>'
    plain = httpServer((_request, response) => {
      response.setHeader('connection', 'close')
      if (phase !== 'downgrade') { response.writeHead(302, { location: secureUrl }); response.end(); return }
      response.setHeader('content-type', 'text/html'); response.end(body)
    })
    secure = httpsServer({ key: tls.key, cert: tls.certificates.expired }, (_request, response) => {
      response.setHeader('connection', 'close'); response.setHeader('content-type', 'text/html')
      response.end(phase === 'surface-missing' ? '<!doctype html><html lang="en"><head><title>Useful public service</title></head><body></body></html>' : body)
    })
    await Promise.all([new Promise<void>(resolve => plain.listen(0, '127.0.0.1', resolve)),
      new Promise<void>(resolve => secure.listen(0, '127.0.0.1', resolve))])
    trusted = new Agent({ connect: { ca: tls.ca, servername: 'example.com' }, pipelining: 0 })
    unknownTrust = new Agent({ connect: { servername: 'example.com' }, pipelining: 0 })
    const nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname !== 'example.com') throw new Error('External transport unavailable in this fixture')
      const transport = url.protocol + '//127.0.0.1:' + ((url.protocol === 'https:' ? secure : plain).address() as { port: number }).port
      try {
        return await nativeFetch(transport + url.pathname + url.search, { ...options,
          dispatcher: phase === 'unknown' ? unknownTrust : trusted } as RequestInit)
      } catch (error) { refusals.push((error as Error & { cause?: { code?: string } }).cause?.code ?? 'unknown'); throw error }
    })
    await prisma.user.createMany({ data: [userId, userId + '-availability'].map(id => ({ id, email: id + '@example.test', role: 'admin', auditsLimit: 100 })) })
    // Browser and provider collection are deliberately unavailable. Their
    // missing facts must not prevent the independent HTTP finding or imply health.
    await getAuditTaskQueue('browser').pause()
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId + '-availability'] } } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    await trusted?.close(); await unknownTrust?.close()
    for (const server of [plain, secure]) if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
    tls?.dispose(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    try { await vi.waitFor(async () => {
      await prisma.auditVerifierExecution.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'check', 'finalize', 'search', 'search-resources', 'discovery', 'bindings'] } }, data: { workRecoveryUntil: new Date(0) } })
      if (phase === 'unknown' && refusals.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE'))
        await prisma.auditVerifierExecution.updateMany({ where: { auditId, workKind: { in: ['http', 'bindings'] }, workState: { not: 'COMPLETED' } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 45_000, interval: 100 }) }
    catch (error) {
      console.info('Controlled certificate execution state', await prisma.auditVerifierExecution.findMany({ where: { auditId, workKind: { not: null } },
        select: { workKind: true, workState: true, workAttempts: true, workErrorCode: true } }))
      console.info('Controlled binding interruptions', await prisma.auditPipelineEvent.findMany({ where: { auditId, event: 'binding_attempt_interrupted' },
        select: { detail: true }, take: 3 }))
      throw error
    }
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED', scope = 'certificate', ownerId = userId) {
    phase = next; refusals.length = 0
    secure.setSecureContext({ key: tls.key, cert: tls.certificates[next === 'expired' ? 'expired' : 'valid'] })
    const fix = await recordSiteFlagFix({ siteId: projectId, userId: ownerId, flagId, idempotencyKey: scope + '-fix-' + next,
      changeSummary: 'Restore a valid public HTTPS connection' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId: ownerId, flagId,
      attemptId: fix.attemptId, idempotencyKey: scope + '-verify-' + next })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Certificate verification was not admitted')
    await complete(check.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
      .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(ownerId, run.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR'
      : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
  }
  it('preserves the failed redirect hop, refuses uncertain and downgraded repairs, then verifies HTTPS and recurrence', async () => {
    const source = await createAndEnqueueAudit({ url: pageUrl, userId })
    await complete(source.auditId)
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } }); projectId = audit.projectId!
    const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId, workKind: 'http', pageUrl } })
    const collected = httpArtifactSchema.parse(readArtifact(task.workResult, 'http').data).document
    expect(collected).toMatchObject({ url: pageUrl, finalUrl: secureUrl, redirects: [pageUrl], status: null, body: null, complete: false,
      transportFailure: { kind: 'tls-certificate', code: 'CERT_HAS_EXPIRED' } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'security-certificate-invalid' } })
    expect(flag.evidence).toContain('https://example.com/secure')
    expect(flag.evidence).not.toMatch(/PRIVATE_TLS_VALUE|PRIVATE_VALUE/)
    expect(await prisma.flag.count({ where: { auditId: source.auditId, checkId: { startsWith: 'security-headers' } } })).toBe(0)
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    const handoff = await loadSiteFlagCopyTask(projectId, flag.id)
    expect(handoff.prompt).toMatch(/renew/i)
    expect(handoff.prompt).not.toContain('PRIVATE_TLS_VALUE')
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    await verify(flag.id, 'expired', 'UNCHANGED')
    await verify(flag.id, 'unknown', 'INCONCLUSIVE')
    await verify(flag.id, 'downgrade', 'INCONCLUSIVE')
    await verify(flag.id, 'valid', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'expired'; secure.setSecureContext({ key: tls.key, cert: tls.certificates.expired })
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'certificate-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
  }, 180_000)

  it('confirms certificate refusal for the default availability Outcome and independently verifies rendered recovery', async () => {
    const ownerId = userId + '-availability'
    const project = await prisma.project.create({ data: { userId: ownerId, name: 'Certificate availability fixture',
      canonicalHost: 'example.com', url: 'https://example.com/' } })
    projectId = project.id
    expect(await prisma.$transaction(tx => ensureDefaultMonitoring(tx, projectId, ownerId))).toBe(true)
    const outcome = await prisma.siteOutcome.findUniqueOrThrow({ where: { projectId_slug: { projectId, slug: 'page-loads' } } })
    const original = pageSessions.createAuditPage
    const browser = vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((instance, url, options) => original(instance, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.hostname !== 'example.com') { await route.abort('blockedbyclient'); return }
          // The logical URL and normal TLS verification remain intact. Only
          // socket routing and Chromium response delivery are local fixtures.
          const response = await fetch(resource, { redirect: 'manual' })
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    try {
      phase = 'expired'; refusals.length = 0
      secure.setSecureContext({ key: tls.key, cert: tls.certificates.expired })
      const source = await requestSiteRun({ projectId, userId: ownerId, outcomeIds: [outcome.id], source: 'WEB', scope: 'OUTCOMES', idempotencyKey: 'availability-certificate-source' })
      await complete(source.auditId!)
      expect(await getOwnedRun(ownerId, source.runId)).toMatchObject({ result: 'FLAG' })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'outcome-availability-failed' } })
      expect(flag.problem).toContain('expired')
      expect(flag.fix).toMatch(/renew/i)
      expect((await loadSiteFlagCopyTask(projectId, flag.id)).prompt).toMatch(/renew/i)
      expect(await prisma.outcomeBindingAttempt.findMany({ where: { auditId: source.auditId! }, orderBy: { attempt: 'asc' } }))
        .toMatchObject([{ disposition: 'FAILED', reason: 'certificate_expired' }, { disposition: 'FAILED', reason: 'certificate_expired' }])
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'bindings' } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      const incident = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      const assessment = await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: source.runId, outcomeId: outcome.id } })
      expect((await loadSiteHome(projectId))?.outcomes.find(item => item.id === outcome.id)?.state).toBe('FLAG')
      await verify(flag.id, 'expired', 'UNCHANGED', 'availability-certificate', ownerId)
      await verify(flag.id, 'surface-missing', 'UNCHANGED', 'availability-certificate', ownerId)
      const missingSurface = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { outcomeId: outcome.id, reason: 'expected_surface_missing' } })
      expect(missingSurface).toMatchObject({ disposition: 'FAILED', detail: { status: 200, rendered: false } })
      expect(await prisma.flag.findFirstOrThrow({ where: { auditId: missingSurface.auditId, checkId: flag.checkId } }))
        .toMatchObject({ problem: 'A required page did not show its configured content in the browser.' })
      await verify(flag.id, 'unknown', 'INCONCLUSIVE', 'availability-certificate', ownerId)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).not.toMatchObject({ status: 'FIXED' })
      await verify(flag.id, 'valid', 'IMPROVED', 'availability-certificate', ownerId)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
      expect((await loadSiteHome(projectId))?.outcomes.find(item => item.id === outcome.id)?.state).toBe('CLEAR')
      phase = 'expired'; secure.setSecureContext({ key: tls.key, cert: tls.certificates.expired })
      const recurring = await requestSiteRun({ projectId, userId: ownerId, outcomeIds: [outcome.id], source: 'WATCH', scope: 'OUTCOMES', idempotencyKey: 'availability-certificate-recurrence' })
      await complete(recurring.auditId!)
      expect(await getOwnedRun(ownerId, recurring.runId)).toMatchObject({ result: 'FLAG' })
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: incident.improvementId })
      expect(await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: recurring.runId, outcomeId: outcome.id } }))
        .toMatchObject({ state: 'FLAG', evidence: { incident: { transition: 'regression' } } })
      expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
    } finally { browser.mockRestore() }
  }, 180_000)
})
