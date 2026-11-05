import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { Audit } from '@prisma/client'
import { Queue, Worker } from 'bullmq'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { dispatchReadyTasks, dispatchTask, executeTask, loadTaskGraph, persistTaskPlan, reconcileTasks, recoverProgressiveTasks, recoverInterruptedTaskDelivery } from '../engine'
import { dispatchAudit, dispatchPendingAudits } from '@/lib/audit/dispatch'
import { serializeArtifact, TaskFailure, TASK_CRASH_LIMIT, MAX_TASKS_PER_AUDIT, type TaskKind, type TaskPlan } from '../contracts'
import { claimExecution, executionWrite, executionTransaction, withExecutionOwnership, currentExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import type { TaskContext, TaskHandler } from '../registry'
import { lifecycleHandlers } from '../lifecycle'
import * as openChecks from '@/lib/audit/open-check'
import { initialTaskPlan } from '../graph'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'
import { collectionHandlers } from '../collectors'
import * as deliveryWindow from '../delivery-window'
import { taskDeliveryWindow, DELIVERY_RECHECK_MS } from '../queues'
import { safeFetchDocument } from '../../url'
import { publicHttpCapacity } from '../capacity'
import { commitObservation, nextObservationBatch, observationArtifact, observationBatchStart, OBSERVATION_TARGET, OBSERVATION_COHORT_TARGET } from '../observation-progress'
import { commitFindings, recordedTaskFindings } from '../results'
import { recordedPageEvidence } from '../lifecycle'
import { z } from 'zod'
import { projectCheckResults } from '@/lib/sites/check-results'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { JOURNEY_VERIFICATION_RULE } from '@/lib/audit/checks/journey-evidence'
import { capturePageKey } from '@/lib/audit/browser/observation-scope'
import { browserEvidence, evaluatorHandlers } from '../evaluators'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { browserArtifactSchema } from '../snapshots'
import { actionHandlers } from '../actions'
import { nextControlProgress } from '../control-progress'
import { JudgeProviderError } from '@/lib/audit/judge'

const dispatch = vi.hoisted(() => ({ queues: new Map<string, Queue>() }))
vi.mock('@/lib/queue/client', () => ({ getAuditTaskQueue: (resource: string) => dispatch.queues.get(resource)!,
  getAuditQueue: () => dispatch.queues.get('audit')! }))
vi.mock('@/lib/audit/screenshot', () => ({ getBrowserDiagnostics: () => ({ connected: true }) }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('durable task dispatch with real PostgreSQL, Redis and workers', () => {
  const auditIds: string[] = []
  const workers: Worker[] = []
  const connections: ReturnType<typeof createQueueRedis>[] = []
  const handlers = new Map<string, TaskHandler>([['http', {
    kind: 'http', replay: 'read_only', timeoutMs: 1000,
    evaluate: async () => serializeArtifact('http', { observed: true }), validateResult: () => {},
  }]])

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) ||
      !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Dispatch integration requires a disposable local execution database')
    const suffix = randomUUID()
    for (const resource of ['audit', ...Object.keys(TASK_QUEUES)]) {
      const connection = createQueueRedis()
      connections.push(connection)
      dispatch.queues.set(resource, new Queue('dispatch-' + resource + '-' + suffix, { connection }))
    }
    await dispatch.queues.get('browser')!.pause()
  })

  afterAll(async () => {
    await Promise.all(workers.map(worker => worker.close()))
    for (const queue of dispatch.queues.values()) {
      await queue.obliterate({ force: true })
      await queue.close()
    }
    connections.forEach(connection => connection.disconnect())
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    await prisma.$disconnect()
  })

  afterEach(async () => {
    // Each case owns its own reservation cohort, including paused deliveries.
    await vi.waitFor(async () => expect(await prisma.auditExecutionTask.count({ where: { auditId: { in: auditIds }, workState: 'RUNNING' } })).toBe(0))
    await prisma.audit.deleteMany({ where: { id: { in: auditIds.splice(0) } } })
  })

  async function admission(kinds: TaskKind[]) {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date() } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, kinds.map((kind, position) => ({ kind, key: 'p' + position + ':' + kind,
      scope: 'page:' + position, input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] })))
    // Ensure graph order and due times are explicit rather than relying on CUID ordering.
    const base = Date.now() - 10_000
    for (const [index, kind] of kinds.entries()) await prisma.auditExecutionTask.update({
      where: { auditId_targetKey_scopeKey: { auditId: audit.id, targetKey: 'task:p' + index + ':' + kind, scopeKey: 'page:' + index } },
      data: { createdAt: new Date(base + index), workRetryAt: new Date(base) },
    })
    return { audit, tasks: await loadTaskGraph(audit.id) }
  }

  async function startHttpWorker(selectedHandlers = handlers) {
    const connection = createWorkerRedis()
    connections.push(connection)
    const worker = new Worker(dispatch.queues.get('http')!.name, job => executeTask(job.data, selectedHandlers), { connection })
    workers.push(worker)
    await worker.waitUntilReady()
    return worker
  }

  it('delivers task metadata without repeatedly loading retained Audit evidence', async () => {
    const { audit } = await admission(['http', 'http', 'http', 'http'])
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: audit.url, scope: 'SITE', environment: 'production',
      checks: {}, outcomes: [], verificationTarget: null }
    const retained = { content: 'x'.repeat(2_000_000) }
    await prisma.audit.update({ where: { id: audit.id }, data: { executionSpec: spec, includeAi: false, reviewDepth: 3,
      htmlMetadata: retained, performanceData: retained, flowData: retained, consoleErrors: retained } })
    const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    const observed: Array<{ keys: string[]; bytes: number }> = []
    const observer: TaskHandler = { kind: 'http', replay: 'read_only', timeoutMs: 5000, validateResult: () => {},
      evaluate: async context => {
        observed.push({ keys: Object.keys(context.audit), bytes: Buffer.byteLength(JSON.stringify(context.audit)) })
        expect(context.audit).toMatchObject({ id: audit.id, url: audit.url, parentId: null, executionSpec: spec,
          userId: null, projectId: null, includeAi: false, reviewDepth: 3, scanAccessEncrypted: null,
          createdAt: audit.createdAt, startedAt: audit.startedAt })
        return serializeArtifact('http', { observed: true })
      } }
    const worker = await startHttpWorker(new Map([['http', observer]]))
    try {
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workState: 'COMPLETED' } }))
        .toBe(4), { timeout: 10_000, interval: 25 })
      expect(observed).toHaveLength(4)
      expect(observed.every(item => item.bytes < 10_000)).toBe(true)
      for (const item of observed) expect(item.keys).not.toEqual(expect.arrayContaining(['htmlMetadata', 'performanceData', 'flowData', 'consoleErrors']))
      expect(Buffer.byteLength(JSON.stringify(baseline))).toBeGreaterThan(8_000_000)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id }, select: { htmlMetadata: true, performanceData: true,
        flowData: true, consoleErrors: true } })).toEqual({ htmlMetadata: retained, performanceData: retained, flowData: retained, consoleErrors: retained })
      console.info('Local task Audit projection bytes', { fullAudit: Buffer.byteLength(JSON.stringify(baseline)),
        deliveries: observed.map(item => item.bytes) })
    } finally { await worker.close() }
  })

  it('keeps retained browser markup for Search without copying it into other dependency consumers', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date() } })
    auditIds.push(audit.id)
    const input = { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }
    await persistTaskPlan(audit.id, [
      { kind: 'browser', key: 'observed:browser', scope: 'page:0', input, dependencies: [] },
      { kind: 'check', key: 'consumer:check', scope: 'page:0', input: { ...input, module: 'auth-checkout' }, dependencies: ['observed:browser'] },
      { kind: 'search', key: 'consumer:search', scope: 'page:0', input: { ...input, module: 'search-canonical' }, dependencies: ['observed:browser'] },
    ])
    const html = '<title>Retained observation</title><script>' + 'x'.repeat(900_000) + '</script>'
    const artifact = serializeArtifact('browser', browserArtifactSchema.parse({ pageId: 'observed-page',
      metadata: parseMetadataFromHtml('<title>Retained observation</title>', audit.url),
      snapshot: { desktopUrl: null, mobileUrl: null, desktopBase64: null, mobileBase64: null, desktopHtml: html,
        consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'pending' }, captureFailures: [] } }))
    const source = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'browser' } })
    await prisma.auditExecutionTask.update({ where: { id: source.id }, data: { workState: 'COMPLETED', status: 'COMPLETED',
      workResult: artifact as never, detail: { retained: 'x'.repeat(900_000) }, evidenceReference: { retained: 'x'.repeat(900_000) } } })
    const received = new Map<string, { bytes: number; html: string | null }>()
    const observers = (['check', 'search'] as const).map(kind => ({ kind, replay: 'read_only' as const, timeoutMs: 5000,
      validateResult: () => {}, evaluate: async (context: Parameters<TaskHandler['evaluate']>[0]) => {
        const evidence = browserEvidence(context)!
        const dependency = context.dependencies.get('observed:browser')!
        expect(evidence.metadata?.title).toBe('Retained observation')
        expect(dependency).toMatchObject({ id: source.id, auditId: audit.id, targetKey: 'task:observed:browser', workState: 'COMPLETED' })
        received.set(kind, { bytes: Buffer.byteLength(JSON.stringify(dependency)), html: evidence.snapshot.desktopHtml })
        return serializeArtifact(kind, { observed: true })
      } }))
    const worker = await startHttpWorker(new Map(observers.map(handler => [handler.kind, handler])))
    try {
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workState: 'COMPLETED' } }))
        .toBe(3), { timeout: 10_000, interval: 25 })
      expect(received.get('check')?.html).toBeNull()
      expect(received.get('check')!.bytes).toBeLessThan(10_000)
      expect(received.get('search')?.html).toBe(html)
      expect(received.get('search')!.bytes).toBeLessThan(920_000)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: source.id }, select: { workResult: true } }))
        .toEqual({ workResult: artifact })
      console.info('Local dependency projection bytes', { check: received.get('check')!.bytes, search: received.get('search')!.bytes })
    } finally { await worker.close() }
  })

  it.each(['wrong-type', 'missing-field', 'null-result'] as const)('preserves invalid or unavailable dependency evidence for validation: %s', async shape => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date() } })
    auditIds.push(audit.id)
    const input = { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }
    await persistTaskPlan(audit.id, [
      { kind: 'browser', key: 'observed:browser', scope: 'page:0', input, dependencies: [] },
      { kind: 'check', key: 'consumer', scope: 'page:0', input, dependencies: ['observed:browser'] },
    ])
    const snapshot = { desktopUrl: null, mobileUrl: null, desktopBase64: null, mobileBase64: null,
      ...(shape === 'wrong-type' ? { desktopHtml: 42 } : {}), consoleErrors: [],
      captureStatus: { desktop: 'ok', mobile: 'pending' }, captureFailures: [] }
    const artifact = shape === 'null-result' ? null : serializeArtifact('browser', { pageId: 'observed', metadata: null, snapshot })
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'browser' }, data: {
      workState: 'COMPLETED', status: 'COMPLETED', ...(artifact ? { workResult: artifact as never } : {}),
    } })
    await reconcileTasks(audit.id)
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'check' } })
    let delivered: TaskContext | undefined
    const observer: TaskHandler = { kind: 'check', replay: 'read_only', timeoutMs: 5000, validateResult: () => {},
      evaluate: async context => { delivered = context; return serializeArtifact('check', { observed: true }) } }
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map([['check', observer]]))
    expect(delivered?.dependencies.get('observed:browser')?.workResult).toEqual(artifact)
    if (shape === 'null-result') expect(browserEvidence(delivered!)).toBeNull()
    else expect(() => browserEvidence(delivered!)).toThrow()
  })

  it('settles an unregistered historical check without stranding its task on failure publication', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date() } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, [{ kind: 'check', key: 'historical', scope: 'page:' + audit.url,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary', module: 'retired-check' }, dependencies: [] }])
    await reconcileTasks(audit.id)
    const task = (await loadTaskGraph(audit.id))[0]
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map(evaluatorHandlers.map(handler => [handler.kind, handler])))
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workState: 'BLOCKED', workErrorCode: 'CHECK_NOT_REGISTERED' })
    const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: audit.id } })
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toMatchObject({ targetKey: 'module:retired-check', status: 'FAILED', detail: { kind: 'unavailable-check', failed: true } })
    expect(projectCheckResults(audit.id, receipts)).toMatchObject([{ status: 'unknown', historical: true }])
  })

  it('publishes a terminal journey gap beside its committed observation through real queue delivery', async () => {
    const { audit, tasks } = await admission(['journeys']), task = tasks[0]
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: audit.url, scope: 'SITE', environment: 'production',
      checks: { 'journey-signup-no-form': 1 }, outcomes: [], verificationTarget: null }
    await prisma.audit.update({ where: { id: audit.id }, data: { executionSpec: spec } })
    const context = (selector: string) => `journey:signup:destination:${capturePageKey(audit.url)}:${'a'.repeat(64)}:${JSON.stringify([{ selector, label: 'Signup' }])}`
    let completedId: string | undefined
    const observer: TaskHandler = { kind: 'journeys', replay: 'read_only', continuation: true, timeoutMs: 1000,
      evaluate: async current => {
        if (current.task.workResult) throw new TaskFailure('CONTROLLED_REMAINING_ROUTE_UNAVAILABLE', false)
        return { ...serializeArtifact('journeys', { route: '#first' }), continuation: true }
      }, validateResult: () => {}, commit: async (current, _artifact, tx) => {
        const saved = await tx.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: current.task.id,
          targetKey: 'module:journeys', scopeKey: 'page:' + audit.url, pageUrl: audit.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'journeys', pageUrl: audit.url, applicable: true, complete: true, passed: true,
            assertions: [{ key: 'destination-form', name: 'Signup fields', expected: 'Editable fields on the original route',
              observed: 'Controlled first-route field observation', passed: true, complete: true, context: context('#first') }],
            execution: { auditId: audit.id, taskId: current.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
          } } })
        completedId = saved.id
      } }
    const connection = createWorkerRedis(); connections.push(connection)
    const worker = new Worker(dispatch.queues.get('browser')!.name, job => executeTask(job.data, new Map([['journeys', observer]])), { connection })
    workers.push(worker)
    try {
      await worker.waitUntilReady(); await dispatch.queues.get('browser')!.resume()
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'BLOCKED', workGeneration: 2, workErrorCode: 'CONTROLLED_REMAINING_ROUTE_UNAVAILABLE' }), { timeout: 10_000, interval: 25 })
      const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: audit.id, targetKey: 'module:journeys' } })
      expect(receipts).toHaveLength(2)
      expect(receipts.find(row => row.id === completedId)).toMatchObject({ status: 'COMPLETED', detail: { assertions: [{ passed: true }] } })
      expect(receipts.find(row => row.id !== completedId)).toMatchObject({ status: 'FAILED', scopeKey: expect.stringContaining(':unfinished:' + task.id),
        detail: { failed: true, assertions: [] } })
      const visible = projectCheckResults(audit.id, receipts)
      expect(visible.map(row => row.status)).toEqual(expect.arrayContaining(['passed', 'failed']))
      const recovered = (selector: string) => hasRecordedRecoveryEvidence({ auditId: audit.id, executionSpec: spec, executions: receipts,
        flag: { checkId: 'journey-signup-no-form', pageUrl: audit.url, verificationRule: JOURNEY_VERIFICATION_RULE,
          evidenceTargets: [{ context: context(selector) }] } })
      expect(recovered('#first')).toBe(true)
      expect(recovered('#remaining')).toBe(false)
      await reconcileTasks(audit.id)
      await executeTask({ auditId: audit.id, taskId: task.id, generation: 2 }, new Map([['journeys', observer]]))
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'module:journeys' } })).toBe(2)
    } finally { await dispatch.queues.get('browser')!.pause(); await worker.close() }
  })

  it('commits cohort evidence and progress atomically and retains an earlier failure after the final healthy batch', async () => {
    const { audit, tasks } = await admission(['slow-replay']), task = tasks[0]
    let failCommit = true, evaluations = 0
    const flag = { checkId: 'title-missing', source: 'DETERMINISTIC' as const, rubric: 'REACH', severity: 'IMPORTANT',
      problem: 'Controlled original failure', evidence: 'A controlled observation in the first batch failed.',
      fix: 'Restore the original condition.', confidence: 1, pageUrl: audit.url }
    const selected = new Map<string, TaskHandler>([['slow-replay', {
      kind: 'slow-replay', replay: 'read_only', continuation: true, timeoutMs: 5000, validateResult: () => {},
      async evaluate(context) {
        evaluations++
        const batch = await nextObservationBatch(context, 'slow-replay', z.object({ selector: z.string(), label: z.string() }),
          async () => [{ selector: '#first', label: 'First' }, { selector: '#second', label: 'Second' }], 1)
        return observationArtifact('slow-replay', { flags: batch.start === 0 ? [flag] : [] }, batch.progress)
      },
      async commit(context, artifact, tx) {
        const start = observationBatchStart(context, artifact, 1)!
        const committed = await commitObservation(context, artifact, tx, 'batch:' + start)
        await commitFindings(context, committed, tx)
        if (failCommit) throw new TaskFailure('CONTROLLED_COMMIT_INTERRUPTED', true)
        return committed
      },
    }]])
    await executeTask({ taskId: task.id, auditId: audit.id, generation: 1 }, selected)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workResult: null })
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET } })).toBe(0)
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: OBSERVATION_COHORT_TARGET } })).toBe(0)
    expect(await prisma.flag.count({ where: { auditId: audit.id } })).toBe(0)
    failCommit = false
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workState: 'READY', workRetryAt: new Date(0) } })
    await executeTask({ taskId: task.id, auditId: audit.id, generation: 2 }, selected)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'READY' })
    const committed = await prisma.auditVerificationReceipt.findMany({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET } })
    expect(committed).toHaveLength(1)
    const checkpoint = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
    const load = vi.fn(async () => [])
    await expect(nextObservationBatch({ audit: { ...audit, id: 'another-audit' }, task: checkpoint,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, deadline: Date.now() + 1000, dependencies: new Map() },
    'slow-replay', z.object({ selector: z.string(), label: z.string() }), load, 1)).rejects.toThrow('OBSERVATION_COHORT_UNAVAILABLE')
    expect(load).not.toHaveBeenCalled()
    await executeTask({ taskId: task.id, auditId: audit.id, generation: 2 }, selected)
    expect(evaluations).toBe(2)
    await executeTask({ taskId: task.id, auditId: audit.id, generation: 3 }, selected)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'COMPLETED' })
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET } })).toBe(2)
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: OBSERVATION_COHORT_TARGET } })).toBe(1)
    const completed = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
    expect((completed.workResult as { data: { observationProgress: object } }).data.observationProgress)
      .toEqual(expect.objectContaining({ cohortId: expect.any(String), total: 2, completed: 2 }))
    expect(JSON.stringify(completed.workResult)).not.toContain('"members"')
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: committed[0].id } })).toEqual(committed[0])
    expect(await recordedTaskFindings(audit.id, prisma)).toEqual([expect.objectContaining({ checkId: flag.checkId })])
    expect((await recordedPageEvidence(audit.id))[0].flags).toEqual([expect.objectContaining({ checkId: flag.checkId })])
  })

  it('retains independent primary, pricing and form discovery findings after every retained-control tail returns no findings', async () => {
    const { audit, tasks } = await admission(['flow', 'flow', 'flow'])
    const cases = [
      { module: undefined, checkId: 'flow-cta-404', prefix: 'flow:control:' },
      { module: 'pricing-navigation', checkId: 'flow-pricing-nav-broken', prefix: 'flow:pricing:v1:' },
      { module: 'form-validation', checkId: 'flow-form-no-validation', prefix: 'form:' },
    ]
    await prisma.audit.update({ where: { id: audit.id }, data: { executionSpec: { version: 1, engine: 'progressive-v1',
      scope: 'SITE', environment: 'production', targetUrl: audit.url, outcomes: [], verificationTarget: null,
      checks: Object.fromEntries(cases.map(item => [item.checkId, 1])) } } })
    for (const [index, task] of tasks.entries()) await prisma.auditExecutionTask.update({ where: { id: task.id },
      data: { workInput: { pageUrl: audit.url, position: 0, primary: true, role: 'primary',
        ...(cases[index].module ? { module: cases[index].module } : {}), verificationContexts: [cases[index].prefix + String(index).repeat(64)] } } })
    const flow = actionHandlers.find(handler => handler.kind === 'flow')!
    const observer: TaskHandler = { ...flow, async evaluate(context) {
      const original = cases.find(item => item.module === context.input.module)!, progress = nextControlProgress(context)!
      return { ...serializeArtifact('flow', { controlProgress: progress, flags: progress.context === null ? [{
        checkId: original.checkId, pageUrl: audit.url, source: 'DETERMINISTIC', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
        problem: 'Independent discovery failure', evidence: 'Controlled ' + (original.module ?? 'primary') + ' observation',
        fix: 'Restore the observed behavior.', confidence: 1,
      }] : [], result: { status: 'success', steps: [], finalUrl: audit.url, ctaText: null, ctaHref: null } }),
      ...(progress.completed < progress.total ? { continuation: true as const } : {}) }
    } }
    const selected = new Map([['flow', observer]])
    await Promise.all(tasks.map(task => executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, selected)))
    const discovery = await prisma.auditVerificationReceipt.findMany({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET }, orderBy: { id: 'asc' } })
    expect(discovery).toHaveLength(3)
    expect(new Set(discovery.map(receipt => receipt.taskId))).toEqual(new Set(tasks.map(task => task.id)))
    await Promise.all(tasks.map(task => executeTask({ auditId: audit.id, taskId: task.id, generation: 2 }, selected)))
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workState: 'COMPLETED' } })).toBe(3)
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET } })).toBe(6)
    expect(await prisma.auditVerificationReceipt.findMany({ where: { id: { in: discovery.map(receipt => receipt.id) } }, orderBy: { id: 'asc' } })).toEqual(discovery)
    expect((await recordedTaskFindings(audit.id, prisma)).map(flag => flag.checkId).sort()).toEqual(cases.map(item => item.checkId).sort())
    expect((await recordedPageEvidence(audit.id))[0].flags.map(flag => flag.checkId).sort()).toEqual(cases.map(item => item.checkId).sort())
  })

  it.each([true, false])('preserves a historical observation key without assigning it to another task (owner recorded: %s)', async owned => {
    const { audit, tasks } = await admission(['flow', 'flow']), [first, peer] = tasks
    const artifact = serializeArtifact('flow', { flags: [] })
    const scopeKey = 'flow:' + capturePageKey(audit.url) + ':discovery'
    const historical = await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id,
      taskId: owned ? first.id : null, targetKey: OBSERVATION_TARGET, scopeKey, source: 'EXECUTION',
      status: 'COMPLETED', pageUrl: audit.url, detail: artifact } })
    for (const task of [first, peer, first, peer]) await prisma.$transaction(tx => commitObservation({
      audit, task, input: { pageUrl: audit.url, primary: true, position: 0, role: 'primary' }, dependencies: new Map(), deadline: Date.now() + 1000,
    } as never, artifact, tx, 'discovery'))
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: historical.id } })).toEqual(historical)
    const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: audit.id, targetKey: OBSERVATION_TARGET } })
    expect(receipts).toHaveLength(owned ? 2 : 3)
    expect(receipts.filter(receipt => receipt.taskId === first.id)).toHaveLength(1)
    expect(receipts.filter(receipt => receipt.taskId === peer.id)).toHaveLength(1)
    expect(receipts.find(receipt => receipt.taskId === peer.id)!.id).not.toBe(historical.id)
    if (owned) expect(receipts.find(receipt => receipt.taskId === first.id)!.id).toBe(historical.id)
  })

  it('reads only the next bounded observation slice from a large frozen cohort', async () => {
    const { audit, tasks } = await admission(['slow-replay']), task = tasks[0]
    const members = Array.from({ length: 5000 }, (_, i) => ({ selector: '#control-' + i + 'x'.repeat(900), label: 'Get started ' + i }))
    const cohort = await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: task.id,
      targetKey: OBSERVATION_COHORT_TARGET, scopeKey: task.id, source: 'EXECUTION', status: 'COMPLETED', pageUrl: audit.url,
      detail: { version: 1, kind: 'observation-cohort', workKind: 'slow-replay', pageUrl: audit.url, batchSize: 20, members } } })
    const checkpoint = observationArtifact('slow-replay', {}, { version: 1, cohortId: cohort.id, batchSize: 20, total: members.length, completed: 20 })
    const load = vi.fn(async () => []), query = vi.spyOn(prisma, '$queryRaw')
    try {
      const next = await nextObservationBatch({ audit, task: { ...task, workResult: checkpoint as never },
        input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, deadline: Date.now() + 1000, dependencies: new Map() },
      'slow-replay', z.object({ selector: z.string(), label: z.string() }), load, 20)
      expect(next.members).toEqual(members.slice(20, 40))
      expect(load).not.toHaveBeenCalled()
      const rows = await query.mock.results[0].value as unknown[]
      expect(rows).toHaveLength(1)
      expect(Buffer.byteLength(JSON.stringify(rows))).toBeLessThan(Buffer.byteLength(JSON.stringify(members)) / 100)
    } finally { query.mockRestore() }
  })

  it('preserves the next delivery when a worker fails after committing a continuation', async () => {
    const { tasks } = await admission(['http']), task = tasks[0]
    const selected = new Map<string, TaskHandler>([['http', {
      kind: 'http', replay: 'read_only', continuation: true, timeoutMs: 1000,
      evaluate: async () => ({ ...serializeArtifact('http', { controlledObservation: 1 }), continuation: true }), validateResult: () => {},
    }]])
    const connection = createWorkerRedis(); connections.push(connection)
    let beforeFailure: Awaited<ReturnType<typeof prisma.auditExecutionTask.findUniqueOrThrow>> | undefined
    let recovered: boolean | undefined, recoveryError: unknown
    const queue = dispatch.queues.get('http')!
    const worker = new Worker(queue.name, async job => {
      await executeTask(job.data, selected)
      // The real ledger and producer already queued the next generation.
      // Stop this consumer before reproducing an interrupted acknowledgement.
      await worker.pause(true)
      beforeFailure = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
      throw new Error('Controlled interruption after committed continuation')
    }, { connection, concurrency: 1 })
    workers.push(worker)
    worker.on('failed', async job => {
      try { recovered = await recoverInterruptedTaskDelivery(job) }
      catch (error) { recoveryError = error }
    })
    try {
      await worker.waitUntilReady()
      await dispatchTask(task.id)
      await vi.waitFor(() => expect(recovered !== undefined || recoveryError !== undefined).toBe(true), { timeout: 10_000 })
      expect(recoveryError).toBeUndefined()
      expect(beforeFailure).toMatchObject({ workState: 'READY', workGeneration: 1, workDispatchState: 'SENT' })
      expect(recovered).toBe(false)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(beforeFailure)
      expect(await queue.getJob(task.id + '-g2')).toBeTruthy()
    } finally {
      await worker.close()
      await (await queue.getJob(task.id + '-g2'))?.remove()
    }
  })

  it('expedites only the matching unclaimed delivery after an interruption', async () => {
    const { audit, tasks } = await admission(['http']), task = tasks[0]
    await dispatchTask(task.id)
    try {
      const before = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
      const data = { auditId: audit.id, taskId: task.id, generation: 1 }
      for (const job of [undefined, { id: task.id + '-g1', data: null }, { id: task.id + '-g1', data: { taskId: task.id } },
        { id: task.id + '-g1', data: { ...data, auditId: 'another-audit' } },
        { id: task.id + '-g1', data: { ...data, generation: 2 } }, { id: 'another-delivery', data }]) {
        expect(await recoverInterruptedTaskDelivery(job)).toBe(false)
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(before)
      }
      expect(await recoverInterruptedTaskDelivery({ id: task.id + '-g1', data })).toBe(true)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'READY', workGeneration: 0, workDispatchState: 'PENDING', workAttempts: 0, workResult: null })
      expect(await recoverInterruptedTaskDelivery({ id: task.id + '-g1', data })).toBe(false)
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workDispatchState: 'SENT' } })
      for (const status of ['COMPLETED', 'FAILED'] as const) {
        await prisma.audit.update({ where: { id: audit.id }, data: { status } })
        const terminal = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
        expect(await recoverInterruptedTaskDelivery({ id: task.id + '-g1', data })).toBe(false)
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(terminal)
      }
      const completion = await admission(['prescription']), enrichment = completion.tasks[0]
      await prisma.audit.update({ where: { id: completion.audit.id }, data: { status: 'COMPLETED' } })
      await prisma.auditExecutionTask.update({ where: { id: enrichment.id }, data: { workDispatchState: 'SENT' } })
      expect(await recoverInterruptedTaskDelivery({ id: enrichment.id + '-g1', data: {
        auditId: completion.audit.id, taskId: enrichment.id, generation: 1,
      } })).toBe(true)
    } finally { await (await dispatch.queues.get('http')!.getJob(task.id + '-g1'))?.remove() }
  })

  it('retains a lost Redis acknowledgement inside the delivery window and recovers it once', async () => {
    const window = taskDeliveryWindow('http')
    const { audit, tasks } = await admission(Array<TaskKind>(window + 1).fill('http'))
    const queue = dispatch.queues.get('http')!, add = queue.add.bind(queue)
    const lost = vi.spyOn(queue, 'add').mockImplementation(async (...args) => {
      const id = args[2]!.jobId!.replace(/-g1$/, '')
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id } }))
        .toMatchObject({ workDispatchState: 'FAILED', workDispatchLeaseUntil: expect.any(Date) })
      const job = await add(...args)
      if (args[2]?.jobId === tasks[0].id + '-g1') throw new Error('Controlled lost Redis acknowledgement')
      return job
    })
    try {
      expect(await dispatchTask(tasks[0].id)).toBe(false)
      await Promise.all(tasks.slice(1).map(task => dispatchTask(task.id)))
    } finally { lost.mockRestore() }
    const reserved = await prisma.auditExecutionTask.findMany({ where: { auditId: audit.id,
      workDispatchState: { in: ['SENT', 'FAILED'] } } })
    expect(reserved).toHaveLength(window)
    expect(await queue.getJob(tasks[0].id + '-g1')).not.toBeNull()
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workDispatchState: 'FAILED', workGeneration: 0, workAttempts: 0 })
    const waiting = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workDispatchState: 'PENDING' } })
    expect(waiting).toMatchObject({ workState: 'READY', workAttempts: 0, workErrorCode: null, workDispatchLeaseUntil: null })
    await prisma.auditExecutionTask.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
    expect(await dispatchTask(tasks[0].id)).toBe(true)
    const counts = await queue.getJobCounts('waiting', 'prioritized')
    expect(counts.waiting + counts.prioritized).toBe(window)
    const worker = await startHttpWorker()
    try {
      for (const task of reserved) await completed(task.id)
      // Completion frees capacity and drains waiting work through the ordinary
      // engine handoff, without another timer or a manually admitted retry.
      await completed(waiting.id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'COMPLETED', workGeneration: 1, workAttempts: 1 })
    } finally { await worker.close() }
  })

  async function completed(id: string) {
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id } })).toMatchObject({
        workState: 'COMPLETED', workAttempts: 1, workGeneration: 1,
      })
    }, { timeout: 10_000, interval: 25 })
  }

  it('settles ready AI and HTTP work while independent PageSpeed and Google requests are still active', async () => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const calls: string[] = []
    const selected = new Map<string, TaskHandler>(['pagespeed', 'google', 'judge', 'http'].map(value => {
      const kind = value as TaskKind
      return [kind, { kind, replay: 'read_only', timeoutMs: 15_000, validateResult: () => {},
        async evaluate() { calls.push(kind); if (kind === 'pagespeed' || kind === 'google') await held
          return serializeArtifact(kind, { controlledExecution: true }) } }]
    }))
    const localWorkers: Worker[] = []
    try {
      const { audit, tasks } = await admission(['pagespeed', 'google', 'judge', 'http'])
      for (const resource of ['pagespeed', 'google', 'provider', 'http']) {
        const connection = createWorkerRedis(); connections.push(connection)
        const worker = new Worker(dispatch.queues.get(resource)!.name, job => executeTask(job.data, selected), { connection })
        workers.push(worker); localWorkers.push(worker); await worker.waitUntilReady()
      }
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => {
        for (const kind of ['pagespeed', 'google']) expect(await prisma.auditExecutionTask.findUniqueOrThrow({
          where: { id: tasks.find(task => task.workKind === kind)!.id } })).toMatchObject({ workState: 'RUNNING', workAttempts: 1 })
        for (const kind of ['judge', 'http']) expect(await prisma.auditExecutionTask.findUniqueOrThrow({
          where: { id: tasks.find(task => task.workKind === kind)!.id } })).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      }, { timeout: 10_000, interval: 25 })
      expect(calls.sort()).toEqual(['google', 'http', 'judge', 'pagespeed'])
      release()
      for (const task of tasks) await completed(task.id)
    } finally { release(); await Promise.all(localWorkers.map(worker => worker.close())) }
  })

  it('executes one task generation once when historical provider and canonical PageSpeed deliveries race', async () => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let evaluations = 0
    const selected = new Map<string, TaskHandler>([['pagespeed', { kind: 'pagespeed', replay: 'read_only', timeoutMs: 15_000,
      validateResult: () => {}, async evaluate() { evaluations++; await held; return serializeArtifact('pagespeed', { controlledExecution: true }) } }]])
    const localWorkers: Worker[] = []
    try {
      const { audit, tasks } = await admission(['pagespeed']), task = tasks[0]
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      const jobId = task.id + '-g1'
      const historical = await dispatch.queues.get('provider')!.add('historical-delivery', { auditId: audit.id, taskId: task.id, generation: 1 }, { jobId })
      const canonical = (await dispatch.queues.get('pagespeed')!.getJob(jobId))!
      for (const resource of ['provider', 'pagespeed']) {
        const connection = createWorkerRedis(); connections.push(connection)
        const worker = new Worker(dispatch.queues.get(resource)!.name, job => executeTask(job.data, selected), { connection })
        workers.push(worker); localWorkers.push(worker); await worker.waitUntilReady()
      }
      await vi.waitFor(async () => {
        expect(evaluations).toBe(1)
        const states = await Promise.all([historical.getState(), canonical.getState()])
        expect(states.sort()).toEqual(['active', 'completed'])
      }, { timeout: 10_000, interval: 25 })
      release(); await completed(task.id)
      await vi.waitFor(async () => expect(await Promise.all([historical.getState(), canonical.getState()])).toEqual(['completed', 'completed']))
      expect(evaluations).toBe(1)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
        createdAt: task.createdAt, workAttempts: 1, workGeneration: 1, workState: 'COMPLETED' })
    } finally { release(); await Promise.all(localWorkers.map(worker => worker.close())) }
  })

  it('commits a real delayed PageSpeed response after renewing the initial ownership lease', async () => {
    const { audit, tasks } = await admission(['pagespeed']), task = tasks[0]
    const observed = { lighthouseResult: { requestedUrl: audit.url, finalUrl: audit.url, lighthouseVersion: '13.5.0',
      configSettings: { formFactor: 'desktop' }, categories: { performance: { score: 0.85 } },
      audits: { 'largest-contentful-paint': { numericValue: 2500 }, 'cumulative-layout-shift': { numericValue: 0.01 } } } }
    let requests = 0
    const server = createServer((_request, response) => {
      requests++
      const timer = setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(observed))
      }, 95_000)
      response.on('close', () => clearTimeout(timer))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Controlled provider failed to bind')
    const realFetch = globalThis.fetch
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
      if (new URL(String(url)).origin !== 'https://www.googleapis.com') throw new Error('Unexpected provider transport')
      return realFetch('http://127.0.0.1:' + address.port, options)
    })
    const selected = new Map([['pagespeed', collectionHandlers.find(handler => handler.kind === 'pagespeed')!]])
    let execution: Promise<unknown> | undefined
    try {
      const startedAt = Date.now()
      execution = executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, selected)
      await vi.waitFor(async () => {
        const running = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
        expect(running.workState).toBe('RUNNING')
        expect(running.workLeaseUntil!.getTime()).toBeGreaterThan(startedAt + 110_000)
      }, { timeout: 45_000, interval: 1000 })
      await execution
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(95_000)
      expect(requests).toBe(1)
      const settled = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
      expect(settled).toMatchObject({ createdAt: task.createdAt, workAttempts: 1, workGeneration: 1, workState: 'COMPLETED',
        workResult: { data: { desktop: { score: 85, lcp: 2500, cls: 0.01 } } } })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        performanceData: { desktop: { score: 85, lcp: 2500, cls: 0.01 } } })
      expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed' } })).toBe(1)
    } finally {
      transport.mockRestore()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      await execution
    }
  }, 160_000)

  it('dispatches and executes untried linked PageSpeed work before an earlier primary retry', async () => {
    const { audit, tasks } = await admission(['pagespeed'])
    const primary = tasks[0]
    const sequence: string[] = []
    const selected = new Map<string, TaskHandler>([['pagespeed', { kind: 'pagespeed', replay: 'read_only', timeoutMs: 1000,
      validateResult: () => {}, async evaluate(context) {
        sequence.push(context.task.id)
        if (context.task.id === primary.id && context.task.workAttempts === 1) throw new TaskFailure('PROVIDER_UNAVAILABLE', true)
        return serializeArtifact('pagespeed', { controlledExecution: true })
      } }]])
    await executeTask({ auditId: audit.id, taskId: primary.id, generation: 1 }, selected)
    const retry = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: primary.id } })
    expect(retry).toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1 })
    await new Promise(resolve => setTimeout(resolve, Math.max(0, retry.workRetryAt!.getTime() - Date.now()) + 10))
    await persistTaskPlan(audit.id, [
      { kind: 'pagespeed', key: 'p0:pagespeed', scope: 'page:0', input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] },
      { kind: 'http', key: 'independent', scope: 'independent', input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] },
      { kind: 'pagespeed', key: 'linked', scope: 'linked', input: { pageUrl: 'https://example.com/linked', position: 1, primary: false, role: 'linked' }, dependencies: [] },
    ])
    const graph = await loadTaskGraph(audit.id)
    const independent = graph.find(task => task.workKind === 'http')!, linked = graph.find(task => task.targetKey === 'task:linked')!
    const ready = await reconcileTasks(audit.id)
    expect(ready).toEqual([linked.id, independent.id, primary.id])
    const queue = dispatch.queues.get('pagespeed')!
    await queue.pause()
    let worker: Worker | undefined
    try {
      // Queue publication order must not defeat the persisted attempt priority.
      await dispatchTask(primary.id)
      await dispatchTask(linked.id)
      const first = await queue.getJob(primary.id + '-g2'), fresh = await queue.getJob(linked.id + '-g1')
      expect(fresh!.opts.priority!).toBeLessThan(first!.opts.priority!)
      const connection = createWorkerRedis(); connections.push(connection)
      worker = new Worker(queue.name, job => executeTask(job.data, selected), { connection })
      workers.push(worker); await worker.waitUntilReady(); await queue.resume()
      await vi.waitFor(async () => {
        for (const id of [primary.id, linked.id]) expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id } }))
          .toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 10_000, interval: 25 })
      expect(sequence).toEqual([primary.id, linked.id, primary.id])
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: primary.id } })).toMatchObject({ workAttempts: 2, workGeneration: 2 })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: linked.id } })).toMatchObject({ workAttempts: 1, workGeneration: 1 })
    } finally { await queue.resume(); await worker?.close() }
  }, 25_000)

  it.each(['repaired', 'exhausted'] as const)('retains independent observations across failed retries without resetting custody: %s', async ending => {
    const { audit, tasks } = await admission(['http']), task = tasks[0]
    await persistTaskPlan(audit.id, [{ kind: 'http', key: task.targetKey.slice(5), scope: task.scopeKey,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] }, { kind: 'finalize', key: 'finalize', scope: 'site',
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [task.targetKey.slice(5)] }])
    const original = serializeArtifact('http', { field: 900, lab: null })
    const handler: TaskHandler = { kind: 'http', replay: 'read_only', timeoutMs: 1000,
      async evaluate(context) {
        if (context.task.workAttempts === 1) throw new TaskFailure('MEASUREMENT_INCOMPLETE', true, 25_000, false, original)
        if (context.task.workAttempts === 2) throw new TaskFailure('PROVIDER_UNAVAILABLE', true)
        return serializeArtifact('http', { field: 100, lab: 95 })
      }, validateResult: () => {},
      async commit(context, artifact, tx) {
        await tx.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: context.task.id,
          targetKey: 'fixture:independent-observation', scopeKey: String(context.task.workAttempts), source: 'DETERMINISTIC',
          status: 'COMPLETED', detail: artifact as never } })
      } }
    const registry = new Map([['http', handler]])
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, registry)
    const first = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(first).toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1, workResult: original, workErrorCode: 'MEASUREMENT_INCOMPLETE' })
    expect(first.workRetryAt!.getTime() - Date.now()).toBeGreaterThan(20_000)
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'finalize' } })).toMatchObject({ workState: 'WAITING' })
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, registry)
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    await reconcileTasks(audit.id)
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 2 }, registry)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      workState: 'RETRY_WAIT', workAttempts: 2, workRecoveryUntil: first.workRecoveryUntil, workResult: original })
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'fixture:independent-observation' } })).toBe(1)
    if (ending === 'exhausted') {
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRecoveryUntil: new Date(0) } })
      await reconcileTasks(audit.id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'EXHAUSTED', workAttempts: 2, workResult: original })
    } else {
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
      await reconcileTasks(audit.id)
      await executeTask({ auditId: audit.id, taskId: task.id, generation: 3 }, registry)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 3, workResult: { data: { field: 100, lab: 95 } } })
    }
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'finalize' } })).toMatchObject({ workState: 'READY' })
    const events = await prisma.auditPipelineEvent.findMany({ where: { auditId: audit.id, event: 'task_observation_committed' }, orderBy: { sequence: 'asc' } })
    expect(events.map(event => event.status)).toEqual(ending === 'exhausted' ? ['partial'] : ['partial', 'completed'])
  })

  it.each(['judge', 'prescription'] as const)('settles a funded limit once in the real %s queue without losing independent evidence', async kind => {
    const { audit, tasks } = await admission(['http', kind])
    const independent = tasks.find(task => task.workKind === 'http')!
    await executeTask({ auditId: audit.id, taskId: independent.id, generation: 1 }, handlers)
    const observed = (await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: independent.id } })).workResult
    expect(observed).toMatchObject({ kind: 'http', data: { observed: true } })
    if (kind === 'prescription') await prisma.audit.update({ where: { id: audit.id }, data: {
      status: 'COMPLETED', completedAt: new Date(), triageAt: new Date(), includeAi: true,
    } })
    const task = tasks.find(task => task.workKind === kind)!
    const attempts = vi.fn(async () => {
      throw new JudgeProviderError(Object.assign(new Error('Provider credit exhausted'), {
        status: 429, code: 'credit_balance_exhausted',
      }), false)
    })
    const observer: TaskHandler = { kind, replay: 'read_only', timeoutMs: 1000,
      evaluate: attempts, validateResult: () => {} }
    const connection = createWorkerRedis()
    connections.push(connection)
    const worker = new Worker(dispatch.queues.get('provider')!.name,
      job => executeTask(job.data, new Map([[kind, observer]])), { connection })
    workers.push(worker)
    try {
      await worker.waitUntilReady()
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => {
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
          .toMatchObject({ workState: 'BLOCKED', workAttempts: 1, workErrorCode: 'AI_PROVIDER_QUOTA_EXHAUSTED' })
      }, { timeout: 10_000, interval: 25 })
      await recoverProgressiveTasks()
      await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map([[kind, observer]]))
      expect(attempts).toHaveBeenCalledTimes(1)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: independent.id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1, workResult: observed })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'BLOCKED', workAttempts: 1, workResult: null })
      if (kind === 'prescription') expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }))
        .toMatchObject({ status: 'COMPLETED', aiReviewAt: null, failureCode: 'AI_REVIEW_FAILED',
          failureMetadata: { phase: 'prescription', reason: 'AI_PROVIDER_QUOTA_EXHAUSTED' } })
    } finally { await worker.close() }
  })

  it.each(['protected', 'idempotent', 'kind', 'continuation', 'invalid'] as const)('refuses invalid failed-task observations before publishing: %s', async mode => {
    const { audit, tasks } = await admission(['http']), task = tasks[0], commit = vi.fn()
    const observation = { ...serializeArtifact(mode === 'kind' ? 'browser' : 'http', { field: 900 }),
      ...(mode === 'continuation' ? { continuation: true as const } : {}) }
    const handler: TaskHandler = { kind: 'http', replay: mode === 'protected' || mode === 'idempotent' ? mode : 'read_only',
      timeoutMs: 1000, reconcile: async () => true, commit,
      evaluate: async () => { throw new TaskFailure('MEASUREMENT_INCOMPLETE', true, undefined, false, observation) },
      validateResult: () => { if (mode === 'invalid') throw new Error('Invalid provider data') } }
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map([['http', handler]]))
    expect(commit).not.toHaveBeenCalled()
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workState: 'BLOCKED', workErrorCode: 'OBSERVATION_CHECKPOINT_INVALID', workResult: null })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed' } })).toBe(0)
  })

  it('rolls back failed-task observations and projections together when persistence fails', async () => {
    const { audit, tasks } = await admission(['http']), task = tasks[0]
    const handler: TaskHandler = { kind: 'http', replay: 'read_only', timeoutMs: 1000,
      evaluate: async () => { throw new TaskFailure('MEASUREMENT_INCOMPLETE', true, undefined, false, serializeArtifact('http', { field: 900 })) },
      validateResult: () => {}, async commit(context, artifact, tx) {
        await tx.audit.update({ where: { id: context.audit.id }, data: { performanceData: artifact.data as never } })
        throw new Error('Controlled persistence refusal')
      } }
    await expect(executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map([['http', handler]])))
      .rejects.toThrow('Controlled persistence refusal')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ performanceData: null })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RUNNING', workResult: null })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed' } })).toBe(0)
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRecoveryUntil: new Date(0) } })
    await reconcileTasks(audit.id)
  })

  it('continues one durable task across bounded deliveries without completing dependents or consuming later retry allowance', async () => {
    const { audit } = await admission(['flow'])
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id } })
    await persistTaskPlan(audit.id, [{ kind: 'flow', key: task.targetKey.slice(5), scope: task.scopeKey,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] }, { kind: 'finalize', key: 'finalize', scope: 'site',
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [task.targetKey.slice(5)] }])
    let interrupted = false
    const observed: number[] = []
    const continuing: TaskHandler = { kind: 'flow', replay: 'read_only', continuation: true, timeoutMs: 1000,
      async evaluate(context) {
        const previous = context.task.workResult as { data?: { step?: number } } | null
        const step = (previous?.data?.step ?? 0) + 1
        observed.push(step)
        if (step === 3 && !interrupted) { interrupted = true; throw new TaskFailure('CONTROLLED_INTERRUPTION', true, 1, true) }
        return { ...serializeArtifact('flow', { step }), ...(step < 3 ? { continuation: true as const } : {}) }
      }, validateResult: () => {},
      async commit(context, artifact, tx) {
        await tx.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: context.task.id, targetKey: 'fixture:continued-observation',
          scopeKey: String(artifact.data.step), source: 'DETERMINISTIC', status: 'COMPLETED', detail: artifact as never } })
      } }
    const registry = new Map([['flow', continuing]])
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, registry)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'READY', status: 'PENDING',
      workGeneration: 1, workAttempts: 0, workResult: { data: { step: 1 }, continuation: true } })
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'finalize' } })).toMatchObject({ workState: 'WAITING' })
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, registry)
    expect(observed).toEqual([1])
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 2 }, registry)
    const queued = await dispatch.queues.get('browser')!.getJob(task.id + '-g3')
    expect(queued!.opts.priority).toBe(2)
    // A delivery retained from the old policy keeps its identity and evidence
    // when the normal producer recheck raises its queue priority.
    await queued!.changePriority({ priority: 4 })
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    expect(await dispatchTask(task.id)).toBe(true)
    expect((await dispatch.queues.get('browser')!.getJob(task.id + '-g3'))?.priority).toBe(2)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workGeneration: 2, workAttempts: 0, workResult: { data: { step: 2 } } })
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 3 }, registry)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1,
      workResult: { data: { step: 2 } } })
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    await reconcileTasks(audit.id)
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 4 }, registry)
    expect(observed).toEqual([1, 2, 3, 3])
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'COMPLETED', workGeneration: 4, workAttempts: 2 })
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'fixture:continued-observation' } })).toBe(3)
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'finalize' } })).toMatchObject({ workState: 'READY' })
  })

  it.each(['not-enabled', 'protected'] as const)('refuses continuation for a %s handler before committing an observation', async mode => {
    const { audit, tasks } = await admission(['http']), task = tasks[0], commit = vi.fn()
    const handler: TaskHandler = { kind: 'http', replay: mode === 'protected' ? 'protected' : 'read_only',
      continuation: mode === 'protected', timeoutMs: 1000, reconcile: async () => true,
      evaluate: async () => ({ ...serializeArtifact('http', { observed: true }), continuation: true }), validateResult: () => {}, commit }
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, new Map([['http', handler]]))
    expect(commit).not.toHaveBeenCalled()
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      workState: 'BLOCKED', workErrorCode: 'CONTINUATION_NOT_SUPPORTED', workResult: null })
  })

  it('rolls back an interrupted checkpoint and retries the same observation before advancing', async () => {
    const { audit, tasks } = await admission(['http']), task = tasks[0]
    let interrupted = false
    const steps: number[] = []
    const handler: TaskHandler = { kind: 'http', replay: 'read_only', continuation: true, timeoutMs: 1000,
      evaluate: async context => {
        const prior = context.task.workResult as { data?: { step?: number } } | null
        const step = (prior?.data?.step ?? 0) + 1; steps.push(step)
        return { ...serializeArtifact('http', { step }), continuation: true }
      }, validateResult: () => {},
      commit: async (context, artifact, tx) => {
        await tx.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: context.task.id, targetKey: 'fixture:checkpoint',
          scopeKey: String(artifact.data.step), source: 'DETERMINISTIC', status: 'COMPLETED' } })
        if (!interrupted) { interrupted = true; throw new TaskFailure('CONTROLLED_COMMIT_INTERRUPTION', true, 1) }
      } }
    const registry = new Map([['http', handler]])
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, registry)
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'fixture:checkpoint' } })).toBe(0)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT', workResult: null })
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    await reconcileTasks(audit.id)
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 2 }, registry)
    expect(steps).toEqual([1, 1])
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'fixture:checkpoint' } })).toBe(1)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'READY', workResult: { data: { step: 1 } } })
    await prisma.audit.update({ where: { id: audit.id }, data: { recoveryUntil: new Date(0) } })
    await reconcileTasks(audit.id)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'EXHAUSTED', workResult: { data: { step: 1 } } })
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId: audit.id, targetKey: 'fixture:checkpoint' } })).toBe(1)
  })

  it('gives an older queued observation a turn before later primary arrivals without rotating it again', async () => {
    const queue = dispatch.queues.get('browser')!
    await queue.drain()
    await queue.pause()
    const { audit, tasks } = await admission(['browser', 'browser', 'browser', 'browser'])
    const [older, young, firstPrimary, secondPrimary] = tasks
    for (const task of [older, young]) await prisma.auditExecutionTask.update({ where: { id: task.id }, data: {
      workInput: { pageUrl: audit.url, position: 1, primary: false, role: 'linked' },
    } })
    const add = queue.add.bind(queue)
    // Model an already queued minute, without freezing worker or lease clocks.
    const timestamp = Date.now() - 2 * DELIVERY_RECHECK_MS - 1000
    const published = vi.spyOn(queue, 'add').mockImplementationOnce((name, data, opts) => add(name, data, { ...opts, timestamp }))
    try { expect(await dispatchTask(older.id)).toBe(true) } finally { published.mockRestore() }
    expect(await dispatchTask(young.id)).toBe(true)
    const recheck = async () => {
      await prisma.auditExecutionTask.update({ where: { id: older.id }, data: { workRetryAt: new Date(0) } })
      expect(await dispatchTask(older.id)).toBe(true)
    }
    await recheck()
    expect(await dispatchTask(firstPrimary.id)).toBe(true)
    expect(await dispatchTask(secondPrimary.id)).toBe(true)
    // Rechecking a promotion must preserve its place among primary deliveries.
    await recheck()
    const queued = await queue.getJob(older.id + '-g1')
    const youngQueued = await queue.getJob(young.id + '-g1')
    for (const task of tasks) expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workAttempts: 0, workGeneration: 0, workState: 'READY', workResult: null })
    const sequence: string[] = []
    const selected = new Map<string, TaskHandler>([['browser', { kind: 'browser', replay: 'read_only', timeoutMs: 5000,
      validateResult: () => {}, evaluate: async context => {
        sequence.push(context.task.id)
        return serializeArtifact('browser', { controlledExecution: true })
      } }]])
    const connection = createWorkerRedis(); connections.push(connection)
    const worker = new Worker(queue.name, job => executeTask(job.data, selected), { connection, concurrency: 1 })
    try {
      await worker.waitUntilReady(); await queue.resume()
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id,
        workState: { not: 'COMPLETED' } } })).toBe(0), { timeout: 10_000, interval: 25 })
      expect(sequence).toEqual([older.id, firstPrimary.id, secondPrimary.id, young.id])
      expect(queued?.priority).toBe(1)
      expect(youngQueued?.priority).toBe(3)
      for (const task of tasks) expect(await (await queue.getJob(task.id + '-g1'))?.getState()).toBe('completed')
      for (const task of tasks) expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workAttempts: 1, workGeneration: 1 })
    } finally { await queue.pause(); await worker.close() }
  }, 20_000)

  it.each([false, true])('finishes primary observations before new linked work and admits aged linked work first (aged: %s)', async aged => {
    const queue = dispatch.queues.get('browser')!
    await queue.drain()
    const { audit, tasks } = await admission([...Array<TaskKind>(8).fill('flow'), 'browser'])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'flow' }, data: {
      workGeneration: 1, workAttempts: 0, workResult: { ...serializeArtifact('flow', { step: 1 }), continuation: true },
    } })
    const fresh = tasks[8]
    await prisma.auditExecutionTask.update({ where: { id: fresh.id }, data: {
      workInput: { pageUrl: audit.url, position: 1, primary: false, role: 'linked' },
      ...(aged ? { createdAt: new Date(Date.now() - 2 * DELIVERY_RECHECK_MS - 1000) } : {}),
    } })
    const ready = await reconcileTasks(audit.id)
    expect(ready[0] === fresh.id).toBe(aged)
    await dispatchReadyTasks(ready)
    if (aged) expect((await queue.getJob(fresh.id + '-g1'))?.opts.priority).toBe(1)
    else expect(await queue.getJob(fresh.id + '-g1')).toBeUndefined()
    const sequence: string[] = []
    const selected = new Map<string, TaskHandler>(['browser', 'flow'].map(value => {
      const kind = value as TaskKind
      return [kind, { kind, replay: 'read_only', timeoutMs: 15_000, validateResult: () => {},
        evaluate: async context => { sequence.push(context.task.id); return serializeArtifact(kind, { observed: true }) } }]
    }))
    const connection = createWorkerRedis(); connections.push(connection)
    const worker = new Worker(queue.name, job => executeTask(job.data, selected), { connection, concurrency: 1 })
    try {
      await worker.waitUntilReady(); await queue.resume()
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workState: { not: 'COMPLETED' } } })).toBe(0),
        { timeout: 20_000, interval: 50 })
      expect(aged ? sequence[0] : sequence.at(-1)).toBe(fresh.id)
      expect(new Set(sequence).size).toBe(9)
    } finally { await queue.pause(); await worker.close() }
  })

  it('rotates yielded continuations so independent HTTP work progresses while another Site awaits browser admission', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('flow'), 'http'])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'flow' }, data: {
      workGeneration: 1, workAttempts: 0, workResult: { ...serializeArtifact('flow', { step: 1 }), continuation: true },
    } })
    const http = tasks[16]
    await prisma.auditExecutionTask.update({ where: { id: http.id }, data: { workRetryAt: new Date(Date.now() - 5000) } })
    const waiting = await admission(['browser'])
    const original = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'flow' } })
    for (let pass = 0; pass < 3; pass++) await dispatchReadyTasks(await reconcileTasks(audit.id))
    expect(await dispatch.queues.get('http')!.getJob(http.id + '-g1')).toBeTruthy()
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 15_000,
      validateResult: () => {}, evaluate: async () => serializeArtifact('http', { observed: true }) }]])
    const worker = await startHttpWorker(selected)
    try { await completed(http.id) } finally { await worker.close() }
    const yielded = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: original.id } })
    expect(yielded).toMatchObject({ workState: 'READY', workGeneration: 1, workAttempts: 0, workErrorCode: null, workDispatchState: 'PENDING',
      workResult: original.workResult })
    expect(yielded.workRetryAt!.getTime()).toBeGreaterThan(original.workRetryAt!.getTime())
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: waiting.tasks[0].id } }))
      .toMatchObject({ workState: 'READY', workGeneration: 0, workAttempts: 0, workDispatchState: 'PENDING' })
  })

  it('releases a browser worker between control observations so another Site can execute first', async () => {
    const queue = dispatch.queues.get('browser')!
    await queue.drain()
    const first = await admission(Array.from({ length: taskDeliveryWindow('browser') }, () => 'flow' as const)), other = await admission(['flow'])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: first.audit.id, id: { not: first.tasks[0].id } },
      data: { workDispatchState: 'SENT', workRetryAt: new Date(Date.now() + 60_000) } })
    const sequence: string[] = []
    const handler: TaskHandler = { kind: 'flow', replay: 'read_only', continuation: true, timeoutMs: 1000,
      evaluate: async context => {
        const prior = context.task.workResult as { data?: { step?: number } } | null
        const step = (prior?.data?.step ?? 0) + 1
        sequence.push(context.audit.id === first.audit.id ? 'cohort:' + step : 'other-site')
        return { ...serializeArtifact('flow', { step }), ...(context.audit.id === first.audit.id && step < 2 ? { continuation: true as const } : {}) }
      }, validateResult: () => {} }
    const connection = createWorkerRedis(); connections.push(connection)
    const worker = new Worker(queue.name, job => executeTask(job.data, new Map([['flow', handler]])), { connection, concurrency: 1 })
    try {
      await worker.waitUntilReady()
      await dispatchTask(first.tasks[0].id)
      expect(await dispatchTask(other.tasks[0].id)).toBe(false)
      await queue.resume()
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: first.tasks[0].id } }))
        .toMatchObject({ workState: 'READY', workGeneration: 1 }), { timeout: 5000, interval: 20 })
      expect(await dispatchTask(other.tasks[0].id)).toBe(true)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(first.audit.id))
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: first.tasks[0].id } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 5000, interval: 20 })
      expect(sequence).toEqual(['cohort:1', 'other-site', 'cohort:2'])
    } finally { await queue.pause(); await worker.close() }
  })

  it('admits a maximum-sized graph in bulk and preserves completed execution on identical replay', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    auditIds.push(audit.id)
    const plans: TaskPlan[] = Array.from({ length: MAX_TASKS_PER_AUDIT }, (_, index) => ({
      kind: 'http', key: 'bounded:' + index, scope: 'page:' + index,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [],
    }))
    await persistTaskPlan(audit.id, plans)
    const before = await loadTaskGraph(audit.id)
    expect(before).toHaveLength(MAX_TASKS_PER_AUDIT)
    const completed = await prisma.auditExecutionTask.update({ where: { id: before[0].id }, data: {
      workState: 'COMPLETED', status: 'COMPLETED', workAttempts: 2, workGeneration: 3,
      workResult: serializeArtifact('http', { observed: 'original immutable evidence' }),
    } })
    await persistTaskPlan(audit.id, plans)
    const after = await loadTaskGraph(audit.id)
    expect(after.map(task => task.id).sort()).toEqual(before.map(task => task.id).sort())
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: completed.id } })).toEqual(completed)
  })

  it('retains both concurrent discoveries when a later admission carries an older summary graph', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    auditIds.push(audit.id)
    const task = (key: string, kind: TaskKind = 'http', dependencies: string[] = []): TaskPlan => ({ key, kind,
      scope: key, input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies })
    const graph = (key?: string): TaskPlan[] => [task('root'), ...(key ? [task(key)] : []),
      task('cross-page', 'cross-page', ['root', ...(key ? [key] : [])]),
      task('finalize', 'finalize', ['root', 'cross-page', ...(key ? [key] : [])])]
    await persistTaskPlan(audit.id, graph())
    const original = await loadTaskGraph(audit.id)
    await Promise.all([persistTaskPlan(audit.id, graph('discovered-a')), persistTaskPlan(audit.id, graph('discovered-b'))])
    await persistTaskPlan(audit.id, graph())
    const rows = await loadTaskGraph(audit.id)
    expect(rows).toHaveLength(5)
    for (const key of ['cross-page', 'finalize']) {
      const summary = rows.find(row => row.targetKey === 'task:' + key)!
      expect(summary.workDependencies).toEqual(expect.arrayContaining(['discovered-a', 'discovered-b']))
      expect(summary.id).toBe(original.find(row => row.targetKey === summary.targetKey)!.id)
    }
    const invalid = [task('root'), task('new-task'), task('cross-page', 'cross-page', ['finalize']),
      task('finalize', 'finalize', ['root'])]
    await expect(persistTaskPlan(audit.id, invalid)).rejects.toThrow('Cyclic task dependency')
    expect(await loadTaskGraph(audit.id)).toEqual(rows)
    await expect(persistTaskPlan(audit.id, [task('root', 'browser')])).rejects.toThrow('Execution task identity changed')
  })

  it('replays depth-three discovery after its expansion committed but collection was interrupted', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', reviewDepth: 3,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', reviewDepth: 3, checks: {}, outcomes: [], verificationTarget: null } } })
    auditIds.push(audit.id)
    const input = { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }
    await persistTaskPlan(audit.id, initialTaskPlan(executionSpecSchema.parse(audit.executionSpec)))
    const handler = lifecycleHandlers.find(handler => handler.kind === 'discovery')!
    const context = { audit, task: await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'discovery' } }),
      input, deadline: Date.now() + 45_000, dependencies: new Map() }
    const collect = vi.spyOn(openChecks, 'openCheckDestinations').mockRejectedValueOnce(new Error('Controlled interruption after graph admission'))
    try {
      await expect(handler.evaluate(context)).rejects.toThrow('Controlled interruption after graph admission')
      const expanded = await loadTaskGraph(audit.id)
      expect(expanded.filter(task => task.targetKey === 'task:discovery:second')).toHaveLength(1)
      const artifact = await handler.evaluate(context)
      handler.validateResult(artifact)
      expect((await loadTaskGraph(audit.id)).map(task => task.id)).toEqual(expanded.map(task => task.id))
    } finally { collect.mockRestore() }
  })

  it('discovers the full page allowance independently of the number of browser profiles and retains it on replay', async () => {
    const urls = ['https://example.com/', ...Array.from({ length: 23 }, (_, index) => 'https://example.com/page-' + (index + 1))]
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', browserCollection: 'per-profile-v1',
      scope: 'SITE', targetUrl: urls[0], environment: 'production', reviewDepth: 2, monitoringPages: urls.slice(0, 12),
      checks: { 'console-errors-some': 1 }, outcomes: [], verificationTarget: null })
    const audit = await prisma.audit.create({ data: { url: urls[0], reviewDepth: 2, executionSpec: spec } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, initialTaskPlan(spec))
    const page = await prisma.auditPage.create({ data: { auditId: audit.id, url: urls[0], normalizedUrl: urls[0], position: 0, role: 'primary' } })
    const metadata = parseMetadataFromHtml('<html><body>' + urls.slice(1).map(url => `<a href="${url}">Page</a>`).join('') + '</body></html>', urls[0])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, targetKey: 'task:p0:browser' }, data: {
      workState: 'COMPLETED', status: 'COMPLETED', workResult: serializeArtifact('browser', browserArtifactSchema.parse({
        pageId: page.id, metadata, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null,
          desktopBase64: null, mobileBase64: null, consoleErrors: [], captureFailures: [], captureStatus: { desktop: 'pending', mobile: 'pending' } },
      })),
    } })
    const handler = lifecycleHandlers.find(handler => handler.kind === 'discovery')!
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'discovery' } })
    const context = { audit, task, input: { pageUrl: urls[0], position: 0, primary: true, role: 'primary' }, deadline: Date.now() + 45_000, dependencies: new Map() }
    const collect = vi.spyOn(openChecks, 'openCheckDestinations').mockResolvedValue({ results: [], truncated: false })
    try {
      await handler.evaluate(context)
      const expanded = await loadTaskGraph(audit.id)
      const browsers = expanded.filter(task => task.workKind === 'browser')
      expect(browsers).toHaveLength(48)
      expect([...new Set(browsers.map(task => (task.workInput as { position: number }).position))].sort((a, b) => a - b))
        .toEqual(Array.from({ length: 24 }, (_, index) => index))
      expect(new Set(browsers.map(task => task.pageUrl))).toEqual(new Set(urls))
      await handler.evaluate(context)
      expect((await loadTaskGraph(audit.id)).map(task => task.id)).toEqual(expanded.map(task => task.id))
    } finally { collect.mockRestore() }
  })

  it('retries prescription delivery from completed triage without repeating observations or losing the report', async () => {
    const { audit, tasks } = await admission(['finalize'])
    const userId = 'prescription-delivery-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const timestamp = new Date()
    await prisma.audit.update({ where: { id: audit.id }, data: { userId, status: 'COMPLETED', includeAi: true,
      triageAt: timestamp, completedAt: timestamp, verdict: 'Recorded triage assessment', score: 72,
      evidenceCoverage: { metadata: true, aiAssessment: true },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: audit.url,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    const finalizer = lifecycleHandlers.find(handler => handler.kind === 'finalize')!
    const selected = new Map<string, TaskHandler>([['finalize', finalizer]])
    const queue = dispatch.queues.get('provider')!, add = queue.add.bind(queue)
    const unavailable = vi.spyOn(queue, 'add').mockRejectedValueOnce(Object.assign(new Error('Controlled prescription queue interruption'), { code: 'ECONNRESET' }))
      .mockImplementation(add)
    try {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      const pending = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
      expect(pending).toMatchObject({ workState: 'READY', workDispatchState: 'FAILED', workAttempts: 0 })
      expect(await queue.getJob(pending.id + '-g1')).toBeUndefined()
      for (let pass = 0; pass < 2; pass++) {
        await prisma.auditExecutionTask.update({ where: { id: pending.id }, data: { workRetryAt: new Date(0) } })
        await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
        expect(await recoverProgressiveTasks()).toBeGreaterThan(0)
        const delivery = (await queue.getJob(pending.id + '-g1'))!
        expect(delivery).toMatchObject({ name: 'audit-task', data: { auditId: audit.id, taskId: pending.id, generation: 1 } })
        if (pass === 0) await delivery.remove()
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED',
        completedAt: original.completedAt, triageAt: original.triageAt, verdict: original.verdict, score: original.score,
        aiReviewAt: null, evidenceCoverage: original.evidenceCoverage })
      expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workKind: 'prescription' } })).toBe(1)
    } finally { unavailable.mockRestore(); await prisma.user.delete({ where: { id: userId } }) }
  })

  it('executes independent HTTP work while sixteen earlier browser tasks await delivery or execution', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('browser'), 'http'])
    for (let pass = 0; pass < 3; pass++) await dispatchReadyTasks(await reconcileTasks(audit.id))
    const browser = await loadTaskGraph(audit.id)
    expect(browser.slice(0, 16).every(task => task.workState === 'READY' && task.workAttempts === 0)).toBe(true)
    expect(browser.slice(0, 16).filter(task => task.workDispatchState === 'SENT')).toHaveLength(taskDeliveryWindow('browser'))
    const worker = await startHttpWorker()
    try { await completed(tasks[16].id) } finally { await worker.close() }
  })

  it('releases a worker after a handler exceeds its budget and preserves the incomplete task', async () => {
    const { audit, tasks } = await admission(['http', 'http'])
    let release!: () => void
    const stalled = new Promise<void>(resolve => { release = resolve })
    let started!: () => void
    const running = new Promise<void>(resolve => { started = resolve })
    const denied: unknown[] = []
    let lateFinished!: () => void
    const late = new Promise<void>(resolve => { lateFinished = resolve })
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 100,
      validateResult: () => {}, evaluate: async context => {
        if (context.task.id === tasks[0].id) {
          started()
          await stalled
          try { await executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Late write' } })) }
          catch (error) { denied.push(error) }
          try {
            await withExecutionOwnership({ ...currentExecutionOwnership()!, signal: new AbortController().signal }, () =>
              executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Detached late write' } })))
          } catch (error) { denied.push(error) }
          lateFinished()
        }
        return serializeArtifact('http', { observed: true })
      } }]])
    await dispatchTask(tasks[0].id)
    const worker = await startHttpWorker(selected)
    try {
      await running
      await dispatchTask(tasks[1].id)
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[1].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1 }), { timeout: 2000, interval: 25 })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1, workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
    } finally { release(); await late; await worker.close() }
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workResult: null })
    expect(denied).toHaveLength(2)
    expect(denied.every(error => error instanceof ExecutionOwnershipLost)).toBe(true)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null })
  })

  it.each(['deadline', 'replacement'] as const)('cancels native HTTP on task %s and admits independent work', async mode => {
    const { tasks } = await admission(['http', 'http'])
    let closed = false
    const requested: string[] = []
    const server = createServer((request, response) => {
      requested.push(request.url!)
      response.setHeader('content-type', 'text/html')
      if (request.url === '/current') response.end('<html>Current observation</html>')
      else { response.write('<html>Incomplete observation'); response.on('close', () => { closed = true }) }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const releases: Array<() => void> = []
    for (let index = 1; index < publicHttpCapacity.capacity; index++) releases.push(await publicHttpCapacity.acquire())
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only',
      timeoutMs: (_audit, input) => input.module === 'obsolete' && mode === 'deadline' ? 500 : 5000,
      validateResult: () => {}, evaluate: async context => {
        const document = await safeFetchDocument(origin + (context.task.id === tasks[0].id ? '/obsolete' : '/current'), { timeoutMs: 4000 })
        return serializeArtifact('http', { observed: document.complete })
      } }]])
    await prisma.auditExecutionTask.update({ where: { id: tasks[0].id },
      data: { workInput: { ...(tasks[0].workInput as object), module: 'obsolete' } } })
    const worker = await startHttpWorker(selected)
    try {
      await dispatchTask(tasks[0].id)
      await vi.waitFor(() => expect(requested).toEqual(['/obsolete']), { timeout: 3000, interval: 10 })
      if (mode === 'replacement') await prisma.auditExecutionTask.update({ where: { id: tasks[0].id },
        data: { workState: 'EXHAUSTED', status: 'FAILED', workGeneration: { increment: 1 }, workToken: 'replacement', workLeaseUntil: null } })
      await dispatchTask(tasks[1].id)
      await vi.waitFor(() => expect(closed).toBe(true), { timeout: 2000, interval: 20 })
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[1].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1, workResult: { data: { observed: true } } }), { timeout: 2000, interval: 20 })
      expect(requested).toEqual(['/obsolete', '/current'])
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject(mode === 'deadline'
          ? { workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null }
          : { workState: 'EXHAUSTED', workGeneration: 2, workToken: 'replacement', workResult: null })
      expect(publicHttpCapacity.running).toBe(releases.length)
    } finally {
      server.closeAllConnections()
      releases.forEach(release => release())
      await worker.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
      vi.unstubAllEnvs()
    }
  })

  it('cancels an expired native PageSpeed request before the next worker observation', async () => {
    const { audit, tasks } = await admission(['pagespeed', 'pagespeed'])
    let closed = false
    const requested: string[] = []
    const server = createServer((request, response) => {
      requested.push(request.url!)
      if (request.url === '/obsolete') { response.on('close', () => { closed = true }); return }
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ lighthouseResult: { requestedUrl: audit.url, finalUrl: audit.url, lighthouseVersion: '13.5.0',
        configSettings: { formFactor: 'desktop' }, categories: { performance: { score: 0.85 } },
        audits: { 'largest-contentful-paint': { numericValue: 2500 }, 'cumulative-layout-shift': { numericValue: 0.01 } } } }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    const nativeFetch = globalThis.fetch
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
      const target = new URL(String(url))
      if (target.origin !== 'https://www.googleapis.com') throw new Error('External transport unavailable in this fixture')
      return nativeFetch(origin + (target.searchParams.get('url')?.endsWith('/obsolete') ? '/obsolete' : '/current'), options)
    })
    await prisma.auditExecutionTask.update({ where: { id: tasks[0].id },
      data: { workInput: { ...(tasks[0].workInput as object), pageUrl: audit.url + 'obsolete' } } })
    const handler = collectionHandlers.find(handler => handler.kind === 'pagespeed')!
    const selected = new Map<string, TaskHandler>([['pagespeed', { ...handler,
      timeoutMs: (_audit, input) => input.pageUrl.endsWith('/obsolete') ? 500 : 5000 }]])
    const connection = createWorkerRedis()
    connections.push(connection)
    const worker = new Worker(dispatch.queues.get('pagespeed')!.name, job => executeTask(job.data, selected), { connection })
    workers.push(worker)
    try {
      await worker.waitUntilReady()
      await dispatchTask(tasks[0].id)
      await vi.waitFor(() => expect(requested).toEqual(['/obsolete']), { timeout: 3000, interval: 10 })
      await dispatchTask(tasks[1].id)
      await vi.waitFor(() => expect(closed).toBe(true), { timeout: 2000, interval: 20 })
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[1].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1, workResult: { data: { desktop: { score: 85 } } } }), { timeout: 3000, interval: 20 })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
      expect(requested).toEqual(['/obsolete', '/current'])
    } finally {
      server.closeAllConnections()
      await worker.close()
      transport.mockRestore()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it('rolls back a commit that crosses the task deadline before releasing later work', async () => {
    const { audit, tasks } = await admission(['http'])
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 150,
      evaluate: async () => serializeArtifact('http', { observed: true }), validateResult: () => {},
      commit: async (context, _artifact, tx) => {
        await tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Uncommitted observation' } })
        await new Promise<void>(resolve => context.signal!.addEventListener('abort', () => resolve(), { once: true }))
        await tx.audit.update({ where: { id: audit.id }, data: { score: 99 } })
      },
    }]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null, score: null })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed' } })).toBe(0)
  })

  it.each(['write', 'transaction'] as const)('rolls back an in-flight %s when its handler is cancelled', async mode => {
    const { audit, tasks } = await admission(['http'])
    const write = mode === 'write' ? executionWrite : executionTransaction
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 150,
      validateResult: () => {}, evaluate: async context => {
        await write(async tx => {
          await tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Uncommitted handler write' } })
          await new Promise<void>(resolve => context.signal!.addEventListener('abort', () => resolve(), { once: true }))
          await tx.audit.update({ where: { id: audit.id }, data: { score: 99 } })
        })
        return serializeArtifact('http', { observed: true })
      },
    }]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null, score: null })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
  })

  it('bounds repeated task deadline failures with the existing crash limit', async () => {
    const { audit, tasks } = await admission(['http'])
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 50,
      evaluate: async () => new Promise(() => {}), validateResult: () => {},
    }]])
    for (let generation = 1; generation <= TASK_CRASH_LIMIT; generation++) {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation }, selected)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({
        workAttempts: generation, workState: generation < TASK_CRASH_LIMIT ? 'RETRY_WAIT' : 'EXHAUSTED', workResult: null,
        workErrorCode: 'TASK_DEADLINE_EXCEEDED',
      })
      if (generation < TASK_CRASH_LIMIT) {
        await prisma.auditExecutionTask.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
        expect(await reconcileTasks(audit.id)).toContain(tasks[0].id)
      }
    }
    expect(await reconcileTasks(audit.id)).toEqual([])
  })

  it.each(['refused', 'late-reconciliation'] as const)('preserves protected-effect reconciliation after timeout: %s', async phase => {
    const { audit, tasks } = await admission(['fixture-setup'])
    let effects = 0, release!: () => void, reconcile!: () => void
    const effect = new Promise<void>(resolve => { release = resolve })
    const reconciliation = new Promise<void>(resolve => { reconcile = resolve })
    const selected = new Map<string, TaskHandler>([['fixture-setup', { kind: 'fixture-setup', replay: 'protected', timeoutMs: 75,
      validateResult: () => {}, reconcile: async () => {
        if (phase === 'refused') return false
        await reconciliation
        return true
      }, evaluate: async () => { effects++; await effect; return serializeArtifact('fixture-setup', { observed: true }) },
    }]])
    try {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
      await prisma.auditExecutionTask.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
      await reconcileTasks(audit.id)
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 2 }, selected)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({
        workState: phase === 'refused' ? 'BLOCKED' : 'RETRY_WAIT',
        workErrorCode: phase === 'refused' ? 'PROTECTED_EFFECT_UNRESOLVED' : 'TASK_DEADLINE_EXCEEDED', workResult: null,
      })
      reconcile()
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(effects).toBe(1)
    } finally { release(); reconcile() }
  })

  it('defers prescription behind a live legacy writer and restores recorded completion only after its lease expires', async () => {
    const { audit, tasks } = await admission(['prescription'])
    const completedAt = new Date(), lease = new Date(Date.now() + 60_000)
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'JUDGING', progress: 70,
      completedAt, triageAt: completedAt, executionLeaseUntil: lease, executionToken: 'legacy-writer' } })
    let calls = 0
    const handler: TaskHandler = { kind: 'prescription', replay: 'idempotent', timeoutMs: 1000, validateResult: () => {},
      evaluate: async () => { calls++; return serializeArtifact('prescription', { completed: true }) } }
    const selected = new Map([['prescription', handler]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(calls).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'JUDGING', progress: 70 })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 0, workErrorCode: 'EXECUTION_BUSY' })
    await prisma.audit.update({ where: { id: audit.id }, data: { executionLeaseUntil: new Date(0) } })
    await prisma.auditExecutionTask.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
    expect(await reconcileTasks(audit.id)).toContain(tasks[0].id)
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(calls).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED', progress: 100, completedAt })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
  })

  it('prioritizes unsent work and rotates due delivery checks without graph-order starvation', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('browser'), 'http'])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchState: 'SENT', workRetryAt: new Date(Date.now() - 1000) } })
    expect((await reconcileTasks(audit.id))[0]).toBe(tasks[16].id)
    const checked = new Set<string>()
    for (let pass = 0; pass < 3; pass++) {
      const due = await reconcileTasks(audit.id)
      due.slice(0, 8).forEach(id => checked.add(id))
      await dispatchReadyTasks(due)
    }
    expect(checked.size).toBe(17)
  })

  it('skips active dispatch leases and resumes their delivery after expiration', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(8).fill('browser'), 'http'])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchLeaseUntil: new Date(Date.now() + 30_000) } })
    expect(await reconcileTasks(audit.id)).toEqual([tasks[8].id])
    await dispatchReadyTasks(await reconcileTasks(audit.id))
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchLeaseUntil: new Date(0) } })
    expect(await dispatchReadyTasks(await reconcileTasks(audit.id))).toBe(8)
  })

  it('reconstructs a lost Redis delivery while preserving one execution generation', async () => {
    const { audit, tasks } = await admission(['http'])
    const task = tasks[0], queue = dispatch.queues.get('http')!
    expect(await dispatchTask(task.id)).toBe(true)
    expect(await reconcileTasks(audit.id)).toEqual([])
    await (await queue.getJob(task.id + '-g1'))!.remove()
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    expect(await dispatchReadyTasks(await reconcileTasks(audit.id))).toBe(1)
    const worker = await startHttpWorker()
    try { await completed(task.id) } finally { await worker.close() }
  })

  it('claims a concurrent dispatch once, including a legacy null due time', async () => {
    const { tasks } = await admission(['http'])
    await prisma.auditExecutionTask.update({ where: { id: tasks[0].id }, data: { workRetryAt: null } })
    expect((await Promise.all(Array.from({ length: 8 }, () => dispatchTask(tasks[0].id)))).filter(Boolean)).toHaveLength(1)
    expect(await dispatch.queues.get('http')!.getJob(tasks[0].id + '-g1')).not.toBeNull()
  })

  it('finishes independent task batches after a failed claim and retries the retained task', async () => {
    const { tasks } = await admission(Array<TaskKind>(8).fill('http'))
    const original = deliveryWindow.claimTaskDelivery
    const claim = vi.spyOn(deliveryWindow, 'claimTaskDelivery').mockImplementation(id => {
      if (id === tasks[0].id) throw new Error('Controlled task claim failure')
      return original(id)
    })
    const worker = await startHttpWorker()
    try {
      expect(await dispatchReadyTasks(tasks.map(task => task.id))).toBe(7)
      for (const task of tasks.slice(1)) await completed(task.id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'READY', workAttempts: 0, workDispatchState: 'PENDING' })
      claim.mockRestore()
      expect(await dispatchTask(tasks[0].id)).toBe(true)
      await completed(tasks[0].id)
    } finally { claim.mockRestore(); await worker.close() }
  })

  it('recovers another Audit after one graph read fails without losing the failed graph', async () => {
    const broken = await admission(['http']), healthy = await admission(['http'])
    for (const audit of [broken.audit, healthy.audit]) await prisma.audit.update({ where: { id: audit.id },
      data: { executionSpec: { engine: 'progressive-v1' }, dispatchNextAt: new Date(0) } })
    const read = prisma.audit.findUnique.bind(prisma.audit)
    const failure = vi.spyOn(prisma.audit, 'findUnique').mockImplementation(args => {
      if (args.where.id === broken.audit.id) throw new Error('Controlled graph read failure')
      return read(args)
    })
    const worker = await startHttpWorker()
    try {
      expect(await recoverProgressiveTasks(2)).toBe(1)
      await completed(healthy.tasks[0].id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: broken.tasks[0].id } }))
        .toMatchObject({ workState: 'READY', workAttempts: 0 })
      failure.mockRestore()
      await prisma.audit.update({ where: { id: broken.audit.id }, data: { dispatchNextAt: new Date(0) } })
      expect(await recoverProgressiveTasks(1)).toBe(1)
      await completed(broken.tasks[0].id)
    } finally { failure.mockRestore(); await worker.close() }
  })

  it('keeps active Audit leases out of the bounded batch and continues after a metadata read fails', async () => {
    const audits: Audit[] = []
    for (let index = 0; index < 3; index++) {
      const audit = await prisma.audit.create({ data: { url: 'https://example.com/', dispatchNextAt: new Date(index),
        ...(index === 0 ? { dispatchLeaseUntil: new Date(Date.now() + 30_000) } : {}) } })
      auditIds.push(audit.id); audits.push(audit)
    }
    const read = prisma.audit.findUniqueOrThrow.bind(prisma.audit)
    const failure = vi.spyOn(prisma.audit, 'findUniqueOrThrow').mockImplementation(args => {
      if (args.where.id === audits[1].id) throw new Error('Controlled Audit metadata read failure')
      return read(args)
    })
    try {
      expect(await dispatchPendingAudits(2)).toBe(1)
      expect(await dispatch.queues.get('audit')!.getJob(audits[0].id)).toBeUndefined()
      expect(await dispatch.queues.get('audit')!.getJob(audits[2].id)).toMatchObject({ data: { auditId: audits[2].id } })
      expect(await prisma.audit.findUnique({ where: { id: audits[1].id } })).toMatchObject({ status: 'QUEUED', dispatchState: 'PENDING', dispatchAttempts: 1 })
      failure.mockRestore()
      await prisma.audit.update({ where: { id: audits[1].id }, data: { dispatchLeaseUntil: new Date(0) } })
      expect(await dispatchPendingAudits(1)).toBe(1)
      expect(await dispatch.queues.get('audit')!.getJob(audits[1].id)).toMatchObject({ data: { auditId: audits[1].id } })
    } finally { failure.mockRestore() }
  })

  it.each(['not-delivered', 'started', 'superseded'] as const)('settles expired Audit dispatch only while it still owns admission: %s', async phase => {
    const userId = 'dispatch-owner-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Dispatch ownership fixture', url: 'https://example.com/', canonicalHost: 'example.com' } })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: project.url,
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
    const audit = await prisma.audit.create({ data: { projectId: project.id, userId, url: project.url,
      recoveryUntil: new Date(0), dispatchNextAt: new Date(0), executionSpec: spec } })
    auditIds.push(audit.id)
    const run = await prisma.runRequest.create({ data: { projectId: project.id, auditId: audit.id, source: 'WATCH',
      idempotencyKey: randomUUID(), executionSpec: spec, leaseUntil: new Date(Date.now() + 60_000) } })
    const queue = dispatch.queues.get('audit')!, add = queue.add.bind(queue)
    let worker: Worker | undefined
    let claimedAudit: Audit | null = null
    if (phase === 'started') {
      const connection = createWorkerRedis(); connections.push(connection)
      worker = new Worker(queue.name, async job => {
        if (job.data.auditId !== audit.id) return
        // Exercise the real execution claim and fenced commit. This consumer
        // stops after admission, before physical website collection.
        const owner = await claimExecution(audit.id, { resume: true })
        if (!owner) throw new Error('Controlled worker could not claim its Audit')
        await withExecutionOwnership(owner, () => executionWrite(tx => tx.audit.update({ where: { id: audit.id },
          data: { status: 'CAPTURING', startedAt: new Date() } })))
        claimedAudit = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      }, { connection })
      workers.push(worker)
      await worker.waitUntilReady()
    }
    const response = vi.spyOn(queue, 'add').mockImplementation(async (...args) => {
      if (phase === 'started') {
        await add(...args)
        await vi.waitFor(() => expect(claimedAudit).not.toBeNull(), { timeout: 10_000, interval: 25 })
      } else if (phase === 'superseded') {
        await prisma.audit.update({ where: { id: audit.id }, data: { dispatchLeaseUntil: new Date(Date.now() + 120_000) } })
      }
      throw new Error('Controlled producer acknowledgement unavailable')
    })
    try {
      expect(await dispatchAudit(audit.id)).toBe(false)
      const saved = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      const request = await prisma.runRequest.findUniqueOrThrow({ where: { id: run.id } })
      if (phase === 'not-delivered') {
        expect(saved).toMatchObject({ status: 'FAILED', dispatchState: 'FAILED', failureCode: 'QUEUE_ENQUEUE_FAILED' })
        expect(request).toMatchObject({ status: 'FAILED', errorCode: 'QUEUE_ENQUEUE_FAILED' })
      } else {
        expect(saved).toMatchObject({ status: phase === 'started' ? 'CAPTURING' : 'QUEUED', failureCode: null, dispatchState: 'PENDING' })
        expect(request).toEqual(run)
        if (phase === 'started') expect(saved).toEqual(claimedAudit)
      }
      expect(await prisma.outcomeAssessment.count({ where: { runRequestId: run.id } })).toBe(0)
    } finally {
      response.mockRestore()
      await worker?.close()
      await prisma.audit.deleteMany({ where: { id: audit.id } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  it.each(['expired', 'crashed', 'retryable-crash'] as const)('reconciles %s dependencies before releasing a dependent that precedes them in stored order', async phase => {
    const { audit, tasks } = await admission(['http', 'finalize'])
    const source = tasks.find(task => task.workKind === 'http')!, dependent = tasks.find(task => task.workKind === 'finalize')!
    await prisma.auditExecutionTask.update({ where: { id: dependent.id }, data: {
      workState: 'WAITING', workDependencies: [source.targetKey.slice(5)], createdAt: new Date(0),
    } })
    await prisma.auditExecutionTask.update({ where: { id: source.id }, data: phase === 'expired'
      ? { workRecoveryUntil: new Date(0) }
      : { workState: 'RUNNING', workToken: 'lost-worker', workGeneration: 1, workAttempts: phase === 'crashed' ? 3 : 1, workLeaseUntil: new Date(0) } })
    const ready = await reconcileTasks(audit.id)
    if (phase === 'retryable-crash') {
      expect(ready).not.toContain(dependent.id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: source.id } }))
        .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'WORKER_INTERRUPTED' })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: dependent.id } })).toMatchObject({ workState: 'WAITING' })
    } else {
      expect(ready).toContain(dependent.id)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: source.id } }))
        .toMatchObject({ workState: 'EXHAUSTED', workErrorCode: phase === 'expired' ? 'RECOVERY_EXHAUSTED' : 'WORKER_INTERRUPTED' })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: dependent.id } })).toMatchObject({ workState: 'READY' })
    }
  })

  it.each(['acknowledged', 'uncertain'] as const)('preserves a fast worker retry after an %s producer response', async response => {
    const { tasks } = await admission(['http'])
    const task = tasks[0], queue = dispatch.queues.get('http')!
    const retryHandlers = new Map(handlers)
    retryHandlers.set('http', { ...handlers.get('http')!, evaluate: async () => { throw new TaskFailure('PROVIDER_QUOTA', true, 120_000) } })
    const worker = await startHttpWorker(retryHandlers)
    const add = queue.add.bind(queue)
    const delayedResponse = vi.spyOn(queue, 'add').mockImplementation(async (...args) => {
      const job = await add(...args)
      await vi.waitFor(async () => {
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT' })
      }, { timeout: 10_000, interval: 25 })
      if (response === 'uncertain') throw new Error('Redis acknowledgement lost')
      return job
    })
    try {
      expect(await dispatchTask(task.id)).toBe(response === 'acknowledged')
      const saved = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })
      expect(saved).toMatchObject({ workState: 'RETRY_WAIT', workGeneration: 1, workAttempts: 1,
        workDispatchState: 'PENDING', workDispatchLeaseUntil: null, workErrorCode: 'PROVIDER_QUOTA' })
      expect(saved.workRetryAt!.getTime()).toBeGreaterThan(Date.now() + 100_000)
    } finally { delayedResponse.mockRestore(); await worker.close() }
  })
})
