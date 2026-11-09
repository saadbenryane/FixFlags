import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '../../screenshot'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteNotificationSummaries } from '@/lib/sites/application/list-sites'
import { executionPageCoverage } from '@/lib/sites/page-coverage'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'

vi.mock('../cpu', async original => ({ ...await original<typeof import('../cpu')>(),
  parseMetadataIsolated: async () => {
    const { TaskFailure } = await import('../contracts')
    throw new TaskFailure('PARSER_CRASH', true, undefined, true)
  },
}))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('native page collection without metadata parsing', () => {
  const userId = 'native-collection-' + randomUUID(), projectId = userId + '-site'
  let url = '', repaired = false, publicResponseUnavailable = false
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (publicResponseUnavailable && request.headers['user-agent']?.startsWith('FixFlags/')) response.statusCode = 429
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Native page evidence</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>body{font:18px Arial;color:#111;background:#fff}button{width:100px;height:50px;background:#111;color:white}</style>' +
      '</head><body><main><h1>Choose an action</h1><button id="action"' + (repaired ? ' aria-label="Continue"' : '') + '></button></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, canonicalHost: '127.0.0.1', url, name: 'Native evidence fixture' } })
    // This baseline supplies only a frozen URL inventory, not an inspection result.
    await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    await getAuditBrowser()
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
  async function settled(auditId: string, pageResponseOnly = false) {
    await vi.waitFor(async () => {
      if (pageResponseOnly) {
        await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] },
          OR: [{ workKind: { notIn: ['browser', 'http', 'check', 'discovery', 'finalize'] } },
            { workKind: 'check', targetKey: { not: { endsWith: ':page-response' } } }] }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(auditId))
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 40_000, interval: 100 })
  }
  async function complete(auditId: string) {
    await settled(auditId)
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { pages: true } })
    expect(executionPageCoverage(audit)).toMatchObject({ pagesReached: 1, pagesExpected: 1, complete: true })
    expect(audit.pages).toMatchObject([{ status: 'COMPLETED' }])
    const browser = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId, workKind: 'browser',
      workInput: { path: ['device'], equals: 'desktop' } } })
    expect(browser.workResult).toMatchObject({ data: { metadata: null, metadataFailure: { code: 'PARSER_CRASH', attempts: 2 },
      snapshot: { desktopHttpStatus: 200, desktopLoadExperience: { observation: { ready: true, restricted: false } } } } })
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: 'accessibility',
      source: 'WEB', outcomeIds: [], idempotencyKey: key })
    await complete(result.auditId!); return result.auditId!
  }
  it('retains real Accessibility failure, independent repair and recurrence while the parser stays unavailable', async () => {
    const source = await category('unparsed-source')
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source, checkId: 'buttons-no-text' } })
    repaired = true
    const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'unparsed-fix',
      changeSummary: 'Give the original button an accessible name' })
    const verification = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'unparsed-verification',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: url, checkId: 'buttons-no-text', parentAuditId: source, attemptId: fix.attemptId } })
    await complete(verification.auditId!)
    const proven = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
    expect(proven).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    repaired = false
    const recurring = await category('unparsed-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring, checkId: 'buttons-no-text' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: proven.improvementId })
  }, 120_000)

  it('keeps a reached page partial until the public response is conclusive across Site readers', async () => {
    repaired = true
    try {
      for (const unavailable of [true, false]) {
        publicResponseUnavailable = unavailable
        const run = await requestSiteRun({ projectId, userId, scope: 'SITE', source: 'WEB', outcomeIds: [],
          idempotencyKey: unavailable ? 'page-response-unavailable' : 'page-response-recovered' })
        await settled(run.auditId!, true)
        const [audit, home, summaries] = await Promise.all([
          prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! }, include: { pages: true,
            verifierExecutions: { where: { targetKey: { in: ['module:page-response', 'projection:flag-comparison'] } } } } }),
          loadSiteHome(projectId), loadSiteNotificationSummaries(userId),
        ])
        expect(audit.pages).toMatchObject([{ url, status: 'COMPLETED' }])
        const receipt = audit.verifierExecutions.find(item => item.targetKey === 'module:page-response')
        expect(receipt).toMatchObject({ pageUrl: url, status: 'COMPLETED', detail: { complete: !unavailable, passed: !unavailable,
          assertions: [{ observed: expect.stringContaining(unavailable ? 'HTTP 429' : 'HTTP 200') }] } })
        const coverage = { pagesReached: 1, pagesExpected: 1, complete: !unavailable }
        expect(home?.presentation.coverage).toMatchObject(coverage)
        expect(summaries.find(summary => summary.id === projectId)?.presentation.coverage).toMatchObject(coverage)
        const projection = audit.verifierExecutions.find(item => item.targetKey === 'projection:flag-comparison')?.detail as
          { siteAssessment?: { assessment: { gaps: Array<{ area: string | null; reason: string }> } } } | null
        expect(projection?.siteAssessment?.assessment.gaps.some(gap => gap.area === 'site' && gap.reason === 'pages')).toBe(unavailable)
      }
    } finally { repaired = false; publicResponseUnavailable = false }
  }, 120_000)
})
