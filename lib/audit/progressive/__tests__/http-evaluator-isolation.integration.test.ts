import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)
import { prisma } from '@/lib/db'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { parseMetadataFromHtml } from '../../metadata'
import { startProgressiveWorkers } from '../runtime'
import { dispatchReadyTasks, loadTasks, persistTaskPlan, reconcileTasks } from '../engine'
import { readArtifact, serializeArtifact, type TaskPlan } from '../contracts'
import { queueForTask, TASK_QUEUES } from '../queues'
import { checkArtifactSchema } from '../results'
import { CHECK_REGISTRY } from '../../check-registry'
import { readResourceAudits } from '../../pagespeed-opportunities'
import { readTapTargetAudits } from '../../pagespeed-tap-targets'
import { performanceMeasurement } from '../../performance-measurement'

const input = { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' }
describe('resource ownership for destination checks', () => {
  it.each(['og-image', 'auth-checkout', 'seo'])('routes %s HTTP observation away from the evaluation queue', module => {
    expect(queueForTask('check', { ...input, module })).toBe('http')
  })
  it.each(['security-headers', 'metadata', 'accessibility', 'measurement', 'mobile-ux-quality'])('keeps %s evaluation independent of HTTP work', module => {
    expect(queueForTask('check', { ...input, module })).toBe('evaluate')
  })
})

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('independent evaluation through the installed workers', () => {
  let workers: ReturnType<typeof startProgressiveWorkers> | undefined
  const auditIds: string[] = []
  const waiting: Array<() => void> = []
  const fetch = vi.fn()
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    dns.resolve4.mockResolvedValue(['93.184.216.34']); dns.resolve6.mockResolvedValue([])
    fetch.mockImplementation(() => new Promise<Response>(resolve => {
      waiting.push(() => resolve(new Response('Service unavailable', { status: 503 })))
    }))
    vi.stubGlobal('fetch', fetch)
    workers = startProgressiveWorkers()
  })
  afterAll(async () => {
    waiting.splice(0).forEach(release => release())
    await workers?.close()
    const queues = (Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)
    const clients = await Promise.all(queues.map(queue => queue.client))
    await Promise.all(queues.map(queue => queue.close()))
    new Set(clients).forEach(client => client.disconnect())
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('commits Security evidence while destination observations occupy every former evaluation slot', async () => {
    const count = TASK_QUEUES.evaluate.concurrency
    const audit = await prisma.audit.create({ data: { url: input.pageUrl, startedAt: new Date(),
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: input.pageUrl,
        environment: 'production', checks: { 'auth-page-broken': 1, 'security-headers-missing': 1 }, outcomes: [], verificationTarget: null },
    } })
    auditIds.push(audit.id)
    const plans: TaskPlan[] = []
    for (let index = 0; index < count; index++) {
      const page = { ...input, pageUrl: input.pageUrl + 'page-' + index, position: index }
      plans.push({ key: 'browser-' + index, kind: 'browser', scope: page.pageUrl, input: page, dependencies: [] },
        { key: 'destination-' + index, kind: 'check', scope: page.pageUrl, input: { ...page, module: 'auth-checkout' }, dependencies: ['browser-' + index] })
    }
    plans.push({ key: 'http', kind: 'http', scope: input.pageUrl, input, dependencies: [] },
      { key: 'security', kind: 'check', scope: input.pageUrl, input: { ...input, module: 'security-headers' }, dependencies: ['http'] })
    await persistTaskPlan(audit.id, plans)
    // Supply recorded collection fixtures. Execution, HTTP observations,
    // evaluator commits and queue resource ownership remain the real path.
    for (let index = 0; index < count; index++) {
      const pageUrl = input.pageUrl + 'page-' + index
      const html = '<html><a href="/login-' + index + '">Sign in</a></html>'
      const result = serializeArtifact('browser', { pageId: randomUUID(), metadata: parseMetadataFromHtml(html, pageUrl),
        snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: html, desktopFinalUrl: pageUrl,
          desktopBase64: null, mobileBase64: null, consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'pending' }, captureFailures: [] } })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, targetKey: 'task:browser-' + index },
        data: { workState: 'COMPLETED', status: 'COMPLETED', workResult: result } })
    }
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, targetKey: 'task:http' },
      data: { workState: 'COMPLETED', status: 'COMPLETED', workResult: serializeArtifact('http', { metadata: null, document: {
        url: input.pageUrl, finalUrl: input.pageUrl, status: 200, headers: {}, body: '', complete: true,
        reason: null, collectedAt: new Date().toISOString(), redirects: [],
      } }) } })
    await reconcileTasks(audit.id)
    const tasks = await loadTasks(audit.id)
    const destinations = tasks.filter(task => task.targetKey.startsWith('task:destination-'))
    await dispatchReadyTasks(destinations.map(task => task.id))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(count), { timeout: 3000, interval: 10 })
    try {
      await dispatchReadyTasks([tasks.find(task => task.targetKey === 'task:security')!.id])
      await vi.waitFor(async () => {
        expect((await loadTasks(audit.id)).find(task => task.targetKey === 'task:security'))
          .toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 2000, interval: 20 })
      expect(await prisma.flag.findFirst({ where: { auditId: audit.id, checkId: 'security-headers-missing' } })).not.toBeNull()
      expect((await loadTasks(audit.id)).filter(task => destinations.some(destination => destination.id === task.id))
        .every(task => task.workState === 'RUNNING')).toBe(true)
    } finally { waiting.splice(0).forEach(release => release()) }
    await vi.waitFor(async () => {
      const completed = (await loadTasks(audit.id)).filter(task => destinations.some(destination => destination.id === task.id))
      expect(completed.every(task => task.workState === 'COMPLETED')).toBe(true)
      for (const task of completed) {
        const result = checkArtifactSchema.parse(readArtifact(task.workResult, 'check').data)
        expect(result.receipt).toMatchObject({ passed: false, complete: true })
        expect(result.flags[0]).toMatchObject({ checkId: 'auth-page-broken' })
      }
    }, { timeout: 3000, interval: 20 })
  }, 15_000)

  it.each(['performance', 'conversion', 'conversion-failure'] as const)('commits only admitted %s evidence through the actual evaluation worker', async scenario => {
    const area = scenario === 'performance' ? 'performance' : 'conversion'
    const checks = Object.fromEntries(Object.entries(CHECK_REGISTRY)
      .filter(([, definition]) => definition.module === 'mobile' && definition.area === area)
      .map(([id, definition]) => [id, definition.version]))
    const spec = { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', targetUrl: input.pageUrl,
      environment: 'production', category: { area, sourceAuditId: 'controlled-original', pages: [input.pageUrl] },
      checks, outcomes: [], verificationTarget: null }
    const audit = await prisma.audit.create({ data: { url: input.pageUrl, startedAt: new Date(), executionSpec: spec } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, [
      { key: 'speed', kind: 'pagespeed', scope: input.pageUrl, input: { ...input, device: 'mobile' }, dependencies: [] },
      { key: 'mobile', kind: 'check', scope: input.pageUrl, input: { ...input, module: 'mobile' }, dependencies: ['speed'] },
    ])
    const measurement = { strategy: 'mobile', score: area === 'performance' ? 95 : null, lcp: area === 'performance' ? 1000 : null,
      cls: area === 'performance' ? 0 : null, fcp: 500, tbt: 0, inp: null, opportunities: [],
      resourceAudits: readResourceAudits({
        'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } },
        'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
        'unused-css-rules': { score: 1, details: { overallSavingsBytes: 0 } },
        'image-delivery-insight': { score: 1, details: { debugData: { wastedBytes: 0 } } },
      }), tapTargetAudits: area === 'performance' ? [] : readTapTargetAudits({ 'target-size': { score: scenario === 'conversion-failure' ? 0 : 1 } }),
      failedAccessibilityAudits: [], diagnostics: { measurement: performanceMeasurement({ requestedUrl: input.pageUrl,
        finalUrl: input.pageUrl, lighthouseVersion: '13.0.0', configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate' } }, 'mobile') },
      raw: {}, crux: null }
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, targetKey: 'task:speed' },
      data: { workState: 'COMPLETED', status: 'COMPLETED', workResult: serializeArtifact('pagespeed', { desktop: null, mobile: measurement }) } })
    const ready = await reconcileTasks(audit.id)
    await dispatchReadyTasks(ready)
    await vi.waitFor(async () => {
      expect((await loadTasks(audit.id)).find(task => task.targetKey === 'task:mobile')).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 3000, interval: 20 })
    const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'module:mobile' } })
    expect(receipt.detail).toMatchObject({ complete: true, passed: scenario !== 'conversion-failure', execution: { checkVersions: checks } })
    const assertions = (receipt.detail as { assertions: Array<{ key: string }> }).assertions.map(assertion => assertion.key)
    if (area === 'performance') expect(assertions).not.toContain('tap-targets')
    else expect(assertions).toEqual(['tap-targets'])
    expect((await prisma.flag.findMany({ where: { auditId: audit.id } })).map(flag => flag.checkId))
      .toEqual(scenario === 'conversion-failure' ? ['tap-targets-small'] : [])
  })
})
