import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createServer } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { coordinateProgressiveAudit, recoverProgressiveAudits, startProgressiveWorkers } from '../runtime'
import { loadTaskGraph, loadTasks } from '../engine'
import { httpArtifactSchema } from '../snapshots'
import { readArtifact, taskKindSchema } from '../contracts'
import { TASK_QUEUES, taskDeliveryWindow, queueForTask, deliveryResourceSql } from '../queues'
import { reservedDeliveryQuery } from '../delivery-window'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('bounded progressive graph admission across independent resource queues', () => {
  const audits: string[] = []
  const origin = 'https://example.com'
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url!)
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Admission fixture</title></head><body><main>Public page</main></body></html>')
  })
  let workers: ReturnType<typeof startProgressiveWorkers> | undefined

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch
    const transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    // Replace transport only. Collection, parsing, evaluation, ownership and queues are real.
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External provider unavailable in this fixture')
      return nativeFetch(transport + url.pathname, options)
    })
    await getAuditTaskQueue('pagespeed').pause()
    await getAuditTaskQueue('browser').pause()
    workers = startProgressiveWorkers()
  })

  afterEach(async () => {
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: { in: audits }, workState: 'RUNNING' } })).toBe(0)
    })
    await prisma.audit.deleteMany({ where: { id: { in: audits.splice(0) } } })
  })

  afterAll(async () => {
    await workers?.close()
    const queues = (Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)
    const clients = await Promise.all(queues.map(queue => queue.client))
    await Promise.all(queues.map(queue => queue.close()))
    new Set(clients).forEach(client => client.disconnect())
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  async function createAudit(checkId = 'lcp-critical') {
    const pageUrl = origin + '/' + randomUUID()
    const spec: ExecutionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'DIAGNOSTIC', checks: { [checkId]: CHECK_REGISTRY[checkId].version }, outcomes: [],
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId, attemptId: 'fixture-attempt', parentAuditId: 'fixture-source' } }
    const audit = await prisma.audit.create({ data: { url: pageUrl, executionSpec: JSON.parse(JSON.stringify(spec)), dispatchNextAt: new Date(0) } })
    audits.push(audit.id)
    return audit
  }

  it('routes delivery accounting and actual execution through the same resource rules', async () => {
    const variants = taskKindSchema.options.flatMap(kind => [undefined, 'HTTP_AVAILABILITY', 'search-canonical',
      'og-image', 'auth-checkout', 'seo', 'search-indexing', 'unrecognized'].map(module => ({ kind,
      input: { pageUrl: origin, position: 0, primary: true, role: 'primary', ...(module ? { module } : {}) } })))
    const rows = await prisma.$queryRaw<Array<{ kind: string; input: typeof variants[number]['input']; resource: string }>>(Prisma.sql`
      SELECT delivery."workKind" AS kind, delivery."workInput" AS input, (${deliveryResourceSql}) AS resource FROM
      (VALUES ${Prisma.join(variants.map(item => Prisma.sql`(${item.kind}, ${JSON.stringify(item.input)}::jsonb)`))})
      AS delivery("workKind", "workInput")`)
    expect(rows.map(row => row.resource)).toEqual(variants.map(item => queueForTask(item.kind, item.input)))
  })

  it('keeps reservation lookup independent of a large unclaimed and historical task backlog', async () => {
    const audit = await createAudit()
    await prisma.$executeRaw`INSERT INTO audit_verifier_executions
      (id, "auditId", "targetKey", source, status, "workKind", "workState", "workDispatchState", "updatedAt")
      SELECT ${audit.id} || '-work-' || n, ${audit.id}, 'task:work-' || n, 'EXECUTION', 'COMPLETED', 'http',
        CASE WHEN n <= 8 THEN 'READY'::"AuditWorkState" WHEN n <= 8008 THEN 'READY'::"AuditWorkState" ELSE 'COMPLETED'::"AuditWorkState" END,
        CASE WHEN n <= 8 THEN 'SENT'::"AuditDispatchState" ELSE 'PENDING'::"AuditDispatchState" END, now()
      FROM generate_series(1, 24008) n`
    await prisma.$executeRaw`ANALYZE audit_verifier_executions`
    const query = reservedDeliveryQuery('http', 'excluded-task', new Date())
    expect(await prisma.$queryRaw(query)).toHaveLength(8)
    const [plan] = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>(Prisma.sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)
    const serialized = JSON.stringify(plan)
    expect(serialized).toContain('audit_verifier_delivery_window_idx')
    expect(serialized).not.toContain('"Node Type":"Seq Scan","Parallel Aware":false,"Async Capable":false,"Relation Name":"audit_verifier_executions"')
  })

  it('collects and evaluates another Site while earlier provider work still owns the legacy audit capacity', async () => {
    const cohort = await Promise.all(Array.from({ length: 8 }, () => createAudit()))
    for (const held of cohort) await coordinateProgressiveAudit(held.id)
    const blocked = cohort[0]
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: blocked.id } })).toMatchObject({ startedAt: expect.any(Date) })
    expect((await loadTaskGraph(blocked.id)).find(task => task.workKind === 'pagespeed'))
      .toMatchObject({ workState: 'READY', workDispatchState: 'SENT', workAttempts: 0 })

    const independent = await createAudit('security-headers-missing')
    await coordinateProgressiveAudit(independent.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: independent.id } })).toMatchObject({ startedAt: expect.any(Date) })
    await vi.waitFor(async () => {
      const task = (await loadTasks(independent.id)).find(task => task.workKind === 'http')
      expect(task).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      const document = httpArtifactSchema.parse(readArtifact(task!.workResult, 'http').data).document
      expect(document).toMatchObject({ url: independent.url, status: 200, complete: true })
      expect(await prisma.flag.findFirst({ where: { auditId: independent.id, checkId: 'security-headers-missing' } })).not.toBeNull()
      expect((await loadTaskGraph(independent.id)).find(task => task.workKind === 'finalize')).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 50 })
    expect(requests).toContain(new URL(independent.url).pathname)
    expect((await loadTaskGraph(blocked.id)).find(task => task.workKind === 'pagespeed'))
      .toMatchObject({ workState: 'READY', workAttempts: 0 })
    expect(await getAuditTaskQueue('pagespeed').isPaused()).toBe(true)
  })

  it('bounds concurrent resource deliveries while admitting independent graphs and recovering waiting work', async () => {
    const window = taskDeliveryWindow('pagespeed')
    const pending = await Promise.all(Array.from({ length: window + 2 }, () => createAudit()))
    await Promise.all(pending.map(audit => coordinateProgressiveAudit(audit.id)))
    const started = await prisma.audit.findMany({ where: { id: { in: audits }, startedAt: { not: null } } })
    expect(started).toHaveLength(pending.length)
    const delivered = await prisma.auditVerifierExecution.findMany({ where: { auditId: { in: audits }, workKind: 'pagespeed', workDispatchState: 'SENT' } })
    expect(delivered).toHaveLength(window)
    const waiting = pending.filter(audit => !delivered.some(task => task.auditId === audit.id))
    expect(waiting).toHaveLength(2)
    for (const audit of waiting) expect((await loadTaskGraph(audit.id)).find(task => task.workKind === 'pagespeed'))
      .toMatchObject({ workState: 'READY', workDispatchState: 'PENDING', workAttempts: 0 })

    // Replaying a coordinator preserves its admitted task identities.
    const before = await loadTaskGraph(started[0].id)
    await coordinateProgressiveAudit(started[0].id)
    expect((await loadTaskGraph(started[0].id)).map(task => task.id)).toEqual(before.map(task => task.id))

    await prisma.audit.update({ where: { id: delivered[0].auditId }, data: { status: 'FAILED' } })
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: { in: waiting.map(audit => audit.id) }, workKind: 'pagespeed' }, data: { workRetryAt: new Date(0) } })
    await recoverProgressiveAudits(window + 2)
    expect(await prisma.auditVerifierExecution.count({ where: { auditId: { in: waiting.map(audit => audit.id) }, workKind: 'pagespeed', workDispatchState: 'SENT' } })).toBe(1)
  })

  it('keeps availability independent when another resource delivery window is full', async () => {
    for (let index = 0; index < taskDeliveryWindow('pagespeed'); index++) await coordinateProgressiveAudit((await createAudit()).id)
    const available = await createAudit()
    const spec: ExecutionSpec = { version: 1, engine: 'progressive-v1', targetUrl: available.url,
      environment: 'production', scope: 'OUTCOMES', checks: {}, verificationTarget: null,
      outcomes: [{ id: 'availability', kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
        bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', required: true, config: {} }] }] }
    await prisma.audit.update({ where: { id: available.id }, data: { executionSpec: JSON.parse(JSON.stringify(spec)) } })
    await getAuditTaskQueue('availability').pause()
    await coordinateProgressiveAudit(available.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: available.id } })).toMatchObject({ startedAt: expect.any(Date) })
    expect((await loadTaskGraph(available.id)).find(task => task.workKind === 'bindings'))
      .toMatchObject({ workState: 'READY', workDispatchState: 'SENT', workAttempts: 0 })
  })
})
