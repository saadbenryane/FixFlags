import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { AxeBuilder } from '@axe-core/playwright'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '../../screenshot'
import { createAuditPage } from '../../browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { TASK_QUEUES } from '../queues'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('mobile Accessibility through native collection and workers', () => {
  const userId = 'mobile-accessibility-' + randomUUID(), projectId = userId + '-site'
  let url = '', phase: 'broken' | 'desktop-only' | 'unavailable' | 'repaired' = 'broken'
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'text/html')
    if (phase === 'unavailable' && request.headers['user-agent']?.includes('iPhone')) {
      response.writeHead(503); response.end('<html><body>Mobile document unavailable</body></html>'); return
    }
    response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Mobile controls</title><style>body{font-family:Arial;color:#111;background:#fff}button{border:0;padding:0;' +
      'vertical-align:top;width:' + (phase === 'desktop-only' ? 96 : 64) + 'px;height:44px;background:#222;color:#fff}' +
      '@media(max-width:600px){button{font-size:9px;width:' + (phase === 'repaired' ? 40 : 14) +
      'px;height:' + (phase === 'repaired' ? 40 : 14) + 'px}}</style></head><body><main><h1>Choose an action</h1>' +
      '<button id="first" aria-label="First action">A</button><button id="second" aria-label="Second action">B</button>' +
      '</main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Mobile control fixture', canonicalHost: '127.0.0.1', url } })
    // The seed supplies the known URL, without asserting a successful inspection.
    await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    const browser = await getAuditBrowser()
    const control = await createAuditPage(browser, url, { profile: MOBILE_CAPTURE_PROFILE, allowLocalhost: true, settle: false, deadline: Date.now() + 10_000 })
    try {
      const observed = await new AxeBuilder({ page: control.page }).withRules(['target-size']).setLegacyMode(true).analyze()
      expect(observed.violations.map(rule => rule.id)).toContain('target-size')
    } finally { await control.page.context().close() }
    worker = startWorker(); await worker.waitUntilReady()
    await touchWorkerHeartbeat({ browserOk: getBrowserDiagnostics().connected, activeBrowserContexts: 0, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(resource => getAuditTaskQueue(resource as keyof typeof TASK_QUEUES))]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect(); vi.unstubAllEnvs()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
      .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 40_000, interval: 100 })
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: 'accessibility',
      source: 'WEB', outcomeIds: [], idempotencyKey: key })
    await complete(result.auditId!); return result.auditId!
  }
  it('finds mobile-only target failures, refuses desktop-only repair, verifies mobile repair and preserves recurrence', async () => {
    const source = await category('mobile-target-source')
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source, checkId: 'axe-target-size' } })
    expect(flag.evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ device: 'mobile',
      context: expect.stringContaining('accessibility:axe:mobile:') })]))
    async function verify(key: string) {
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'fix:' + key,
        changeSummary: 'Change the mobile control dimensions' })
      const started = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'verify:' + key,
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: url, checkId: 'axe-target-size', parentAuditId: source, attemptId: fix.attemptId } })
      await complete(started.auditId!)
      return prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
    }
    phase = 'desktop-only'
    expect(await verify('desktop-only')).toMatchObject({ outcome: 'UNCHANGED', comparable: true })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
    phase = 'unavailable'
    expect(await verify('unavailable')).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
    phase = 'repaired'
    const repaired = await verify('mobile')
    expect(repaired).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'broken'
    const recurring = await category('mobile-target-recurring')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring, checkId: 'axe-target-size' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: repaired.improvementId })
  }, 120_000)
})
