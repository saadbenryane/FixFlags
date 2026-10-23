import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import * as transactions from '@/lib/billing/product-transaction'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { requestSiteRun } from '../run-requests'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { commitScheduledRun, reconcileScheduledCompletions } from '../scheduled-completion'
import { markOutcomeRunsCouldNotVerify } from '../run-reconciliation'
import { dispatchAudit } from '@/lib/audit/dispatch'
import { Prisma } from '@prisma/client'
import { interruptedAnalysisWorkSql, interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => queue }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit: async () => false }))
const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('scheduled completion after cadence advancement', () => {
  let userId: string, projectId: string
  let otherOwners: string[] = []
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    otherOwners = []
    userId = 'scheduled-completion-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const site = await prisma.project.create({ data: { userId, name: 'Scheduled completion', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000),
      accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = site.id
    queue.add.mockReset().mockResolvedValue({ id: 'queued' })
  })
  afterEach(async () => {
    vi.useRealTimers(); vi.restoreAllMocks()
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, ...otherOwners] } } })
  })
  async function admit(failures = 0, interval: 'weekly' | 'hourly' = 'weekly') {
    if (failures) await prisma.project.update({ where: { id: projectId }, data: { watchConsecutiveFailures: failures, watchLastError: 'Earlier failure' } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    expect(request.context).toMatchObject({ scheduled: { version: 1, interval, failures } })
    expect(JSON.stringify(request.context)).not.toContain('https://')
    return request
  }
  async function fail(auditId: string) {
    // Controlled terminal state exercises schedule projection only. This is not
    // invented webpage collection or a positive website conclusion.
    await prisma.audit.update({ where: { id: auditId }, data: { status: 'FAILED', completedAt: new Date() } })
    await markOutcomeRunsCouldNotVerify(auditId, 'CONTROLLED_EXECUTION_FAILURE', 'Controlled execution failure')
  }

  it.each(['SITE', 'OUTCOMES'] as const)('retries exhausted %s work even when the containing execution completed', async scope => {
    // An older complete receipt must not hide the newest interruption when the
    // next admission decides whether broad collection is still needed.
    const createOlder = () => prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      reportCompleteness: 'FULL', createdAt: new Date(Date.now() - 60 * 60_000), completedAt: new Date(Date.now() - 59 * 60_000),
      executionSpec: { version: 1, scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production',
        outcomes: [], checks: {}, verificationTarget: null } } })
    let older = scope === 'OUTCOMES' ? await createOlder() : undefined
    const request = await admit()
    expect(request.executionSpec).toMatchObject({ scope })
    older ??= await createOlder()
    const kind = scope === 'SITE' ? 'browser' : 'bindings'
    await prisma.auditVerifierExecution.create({ data: { auditId: request.auditId!, targetKey: 'task:p0:' + kind, source: 'EXECUTION',
      workKind: kind, workState: 'EXHAUSTED', status: 'FAILED', workErrorCode: 'RECOVERY_EXHAUSTED' } })
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(1)
    expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(site.watchNextRunAt!.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    const next = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: request.id } } })
    expect(next.executionSpec).toMatchObject({ scope })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: request.auditId! } }))
      .toMatchObject({ workState: 'EXHAUSTED', status: 'FAILED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
  })

  it.each([
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:browser', interrupted: true },
    { workKind: null, workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:legacy', interrupted: true },
    { workKind: 'prescription', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:prescription', interrupted: false },
    { workKind: 'pagespeed', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:pagespeed', interrupted: false },
    { workKind: 'google', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:google', interrupted: false },
    { workKind: 'judge', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:judge', interrupted: false },
    { workKind: 'browser', workState: 'BLOCKED', status: 'FAILED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'COMPLETED', status: 'COMPLETED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'NOT_APPLICABLE', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'module:browser', interrupted: false },
  ] as const)('preserves interruption meaning across SQL selection and conditional settlement: %j', async ({ interrupted, ...task }) => {
    const request = await admit(2)
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt
    await prisma.auditVerifierExecution.create({ data: { ...task, auditId: request.auditId!, source: 'EXECUTION' } })
    const [sql] = await prisma.$queryRaw<Array<{ interrupted: boolean }>>(Prisma.sql`SELECT ${interruptedAnalysisWorkSql} AS interrupted
      FROM audits "source" WHERE "source".id = ${request.auditId!}`)
    expect(sql.interrupted).toBe(interrupted)
    expect(Boolean(await prisma.auditVerifierExecution.count({ where: { auditId: request.auditId!, ...interruptedAnalysisWorkWhere } }))).toBe(interrupted)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(interrupted ? 3 : 0)
    if (!interrupted) expect(site.watchNextRunAt).toEqual(due)
    else expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 361 * 60_000)
  })

  it.each(['pause', 'cadence', 'target', 'owner', 'suspend', 'remove', 'attempt', 'due', 'lease', 'failure-count'] as const)(
    'preserves a newer %s decision when an earlier scheduled execution fails', async change => {
      const request = await admit()
      const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      if (change === 'owner') {
        const next = 'next-' + randomUUID(); otherOwners.push(next)
        await prisma.user.create({ data: { id: next, email: next + '@example.test' } })
        await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
      } else if (change === 'suspend') await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
      else await prisma.project.update({ where: { id: projectId }, data: {
        ...(change === 'pause' ? { watchNextRunAt: null, watchLastError: 'Paused' } : {}),
        ...(change === 'cadence' ? { watchInterval: 'DAILY' } : {}),
        ...(change === 'target' ? { url: 'http://example.com:8080/' } : {}),
        ...(change === 'remove' ? { deletedAt: new Date() } : {}),
        ...(change === 'attempt' ? { watchLastAttemptAt: new Date(site.watchLastAttemptAt!.getTime() + 1) } : {}),
        ...(change === 'due' ? { watchNextRunAt: new Date(site.watchNextRunAt!.getTime() + 1) } : {}),
        ...(change === 'lease' ? { watchLeaseUntil: new Date(Date.now() + 600_000) } : {}),
        ...(change === 'failure-count' ? { watchConsecutiveFailures: 1 } : {}),
      } })
      const edited = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      await fail(request.auditId!)
      expect(await reconcileScheduledCompletions(20)).toBe(0)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(edited)
    })

  it('preserves a target change committed between recovery selection and its guarded write', async () => {
    const request = await admit()
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const target = 'http://example.com:8080/changed'
    const concurrent = prisma.$extends({ query: { project: { async updateMany({ args, query }) {
      await prisma.project.update({ where: { id: projectId }, data: { url: target } })
      return query(args)
    } } } })
    const write = vi.spyOn(prisma.project, 'updateMany').mockImplementationOnce(args => concurrent.project.updateMany(args))
    try {
      await fail(request.auditId!)
      expect(write).toHaveBeenCalledTimes(1)
    } finally { write.mockRestore() }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ url: target,
      watchNextRunAt: before.watchNextRunAt, watchConsecutiveFailures: 0, watchLastError: null })
    expect(await reconcileScheduledCompletions()).toBe(0)
  })

  it('recovers an interrupted completion once when workers reconcile concurrently', async () => {
    const request = await admit()
    const write = vi.spyOn(prisma.project, 'updateMany').mockRejectedValueOnce(new Error('Controlled completion write interruption'))
    try { await fail(request.auditId!) } finally { write.mockRestore() }
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchConsecutiveFailures).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED' })
    const results = await Promise.all([reconcileScheduledCompletions(), reconcileScheduledCompletions()])
    expect(results.reduce((sum, count) => sum + count, 0)).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(1)
    expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
  })

  it('retains an execution failure streak until a matching run actually completes', async () => {
    const request = await admit(2)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchConsecutiveFailures).toBe(2)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null })
  })

  it('uses six-hour backoff for repeated execution failures without forgetting the streak', async () => {
    const request = await admit(2)
    await fail(request.auditId!)
    const retry = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(retry.watchConsecutiveFailures).toBe(3)
    expect(retry.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now() + 359 * 60_000)
    expect(retry.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 361 * 60_000)
  })

  it('caps a long retry backoff at an earlier normal cadence', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'HOURLY' } })
    const request = await admit(2, 'hourly')
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt
    await fail(request.auditId!)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 3, watchNextRunAt: due })
  })

  it('rolls back receipt context and clock together, then commits idempotently without reviving a pause', async () => {
    const now = new Date(), until = new Date(now.getTime() + 600_000)
    const site = await prisma.project.update({ where: { id: projectId }, data: { watchLastAttemptAt: now, watchLeaseUntil: until } })
    const admitted = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: site.watchNextRunAt!, now })
    const original = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const input = { projectId, userId, runId: admitted.runId, admittedAt: now, claim: { targetUrl: site.url, interval: 'weekly' as const,
      everyMinutes: null, scheduledAt: site.watchNextRunAt!, attemptedAt: now, leaseUntil: until } }
    const transact = transactions.productTransaction
    const interrupted = vi.spyOn(transactions, 'productTransaction').mockImplementationOnce(operation => transact(async tx => {
      await operation(tx)
      throw new Error('Controlled clock commit interruption')
    }))
    try { await expect(commitScheduledRun(input)).rejects.toThrow('Controlled clock commit interruption') }
    finally { interrupted.mockRestore() }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toEqual(original)
    await commitScheduledRun(input)
    const committed = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    const paused = await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt: null, watchLastError: 'Paused' } })
    await commitScheduledRun(input)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(paused)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toEqual(committed)
  })

  it('serves due care with a compatible manual execution and records completion without duplicating work', async () => {
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    const manual = await requestSiteRun({ projectId, userId, source: 'WEB', scope: 'SITE', outcomeIds: [], idempotencyKey: 'compatible-manual' })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: manual.runId } })).toMatchObject({ source: 'WEB', context: { scheduled: { version: 1 } } })
    await fail(manual.auditId!)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
  })

  it('retries an exhausted dispatch after the scheduler has already advanced its weekly clock', async () => {
    queue.add.mockRejectedValueOnce(new Error('Controlled queue outage'))
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    const advanced = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(advanced.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { recoveryUntil: new Date(0), dispatchNextAt: new Date(0) } })
    queue.add.mockRejectedValueOnce(new Error('Controlled outage persists'))
    expect(await dispatchAudit(request.auditId!)).toBe(false)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: request.auditId! } })
    expect(failed).toMatchObject({ status: 'FAILED', startedAt: null, failureCode: 'QUEUE_ENQUEUE_FAILED' })
    await processDueProjectWatches(1, { onlyProjectId: projectId })
    const retry = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(retry.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    expect(retry.watchConsecutiveFailures).toBe(1)
    expect(queue.add).toHaveBeenCalledTimes(2)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(retry.watchNextRunAt!.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    expect(queue.add).toHaveBeenCalledTimes(3)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: failed.id } })).toEqual(failed)
    expect(await prisma.flag.count({ where: { audit: { projectId } } })).toBe(0)
  })
})
