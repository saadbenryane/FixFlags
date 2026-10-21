import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as transactions from '@/lib/billing/product-transaction'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { setProjectWatch } from '../monitoring-settings'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { requestSiteRun } from '../run-requests'
import { dispatchAudit } from '@/lib/audit/dispatch'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => queue }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit: async () => false }))

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('scheduled admission against the current monitoring claim', () => {
  let userId: string, projectId: string, now: Date, scheduledAt: Date, leaseUntil: Date
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    queue.add.mockReset().mockResolvedValue({ id: 'queued' })
    now = new Date(); scheduledAt = new Date(now.getTime() - 60_000); leaseUntil = new Date(now.getTime() + 600_000)
    userId = 'scheduled-admission-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Scheduled admission', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'WEEKLY', watchNextRunAt: scheduledAt,
      watchLastAttemptAt: now, watchLeaseUntil: leaseUntil, accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = project.id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  const input = () => ({ projectId, userId, interval: 'weekly' as const, scheduledAt, now,
    claim: { attemptedAt: now, leaseUntil } })

  async function retainLegacyTick(runId: string) {
    const run = await prisma.runRequest.findUniqueOrThrow({ where: { id: runId } })
    const context = { ...(run.context as Prisma.JsonObject) }
    delete context.scheduled
    // Emulate an unadvanced receipt from before atomic schedule commits.
    await prisma.runRequest.update({ where: { id: runId }, data: { context } })
    await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt: scheduledAt, watchLeaseUntil: null } })
  }

  it('retries an actually exhausted dispatch receipt without certifying a website result', async () => {
    queue.add.mockRejectedValueOnce(new Error('Controlled queue outage'))
    const admitted = await requestScheduledSiteRun(input())
    await retainLegacyTick(admitted.runId)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } }))
      .toMatchObject({ status: 'QUEUED', dispatchState: 'PENDING', startedAt: null })
    // End the real dispatch recovery budget locally. No website observation is
    // invented, and the normal dispatcher owns the FAILED transition.
    await prisma.audit.update({ where: { id: admitted.auditId! }, data: { recoveryUntil: new Date(0), dispatchNextAt: new Date(0) } })
    queue.add.mockRejectedValueOnce(new Error('Controlled queue outage persists'))
    expect(await dispatchAudit(admitted.auditId!)).toBe(false)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })
    expect(failed).toMatchObject({ status: 'FAILED', dispatchState: 'FAILED', failureCode: 'QUEUE_ENQUEUE_FAILED', startedAt: null })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } }))
      .toMatchObject({ status: 'FAILED', errorCode: 'QUEUE_ENQUEUE_FAILED', leaseUntil: null })
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
      .toEqual({ processed: 1, enqueued: 0, errors: 1 })
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!
    expect(due.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(due.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
        .toEqual({ processed: 1, enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    const retry = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: admitted.runId } } })
    expect(retry).toMatchObject({ source: 'WATCH', status: 'QUEUED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: retry.auditId! } }))
      .toMatchObject({ status: 'QUEUED', dispatchState: 'SENT', startedAt: null })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: failed.id } })).toEqual(failed)
    expect(await prisma.flag.count({ where: { auditId: { in: [failed.id, retry.auditId!] } } })).toBe(0)
    expect(queue.add).toHaveBeenCalledTimes(3)
  })

  it.each(['request-failed', 'audit-failed', 'missing-audit'] as const)(
    'backs off a %s saved receipt instead of advancing care for a week', async failure => {
      const admitted = await requestScheduledSiteRun(input())
      await retainLegacyTick(admitted.runId)
      const original = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })
      // This queued admission never visited a website. Model interruption after
      // the failed execution was saved but before the scheduler advanced its tick.
      if (failure === 'audit-failed') await prisma.audit.update({ where: { id: original.id }, data: {
        status: 'FAILED', completedAt: new Date(), failureCode: 'QUEUE_ENQUEUE_FAILED',
      } })
      else await prisma.runRequest.update({ where: { id: admitted.runId }, data: {
        status: 'FAILED', completedAt: new Date(), leaseUntil: null,
        ...(failure === 'missing-audit' ? { auditId: null } : {}),
      } })
      if (failure !== 'audit-failed') await prisma.audit.update({ where: { id: original.id }, data: {
        status: 'FAILED', completedAt: new Date(), failureCode: 'QUEUE_ENQUEUE_FAILED',
      } })
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
      const saved = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
      const savedAudit = await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
        .toEqual({ processed: 1, enqueued: 0, errors: 1 })
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(project).toMatchObject({ watchConsecutiveFailures: 1, watchLeaseUntil: null })
      expect(project.watchNextRunAt!.getTime()).toBeGreaterThan(now.getTime() + 14 * 60_000)
      expect(project.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toEqual(saved)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toEqual(savedAudit)
      expect(queue.add).toHaveBeenCalledTimes(1)
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        // Controlled cadence, without a wall-clock wait or a real provider call.
        vi.setSystemTime(project.watchNextRunAt!.getTime() + 1000)
        expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
          .toEqual({ processed: 1, enqueued: 1, errors: 0 })
      } finally { vi.useRealTimers() }
      expect(queue.add).toHaveBeenCalledTimes(2)
      expect(await prisma.runRequest.count({ where: { projectId, auditId: { not: original.id }, status: 'QUEUED' } })).toBe(1)
    })

  it('recovers the saved scheduler receipt while its physical execution is still in flight', async () => {
    const admitted = await requestScheduledSiteRun(input())
    await retainLegacyTick(admitted.runId)
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })
    const request = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    expect(queue.add).toHaveBeenCalledTimes(1)
    // Admission committed, but this scheduler died before advancing its Site.
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.audit.findMany({ where: { projectId } })).toEqual([original])
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toMatchObject({ ...request,
      context: { ...(request.context as Prisma.JsonObject), scheduled: expect.any(Object) }, updatedAt: expect.any(Date) })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
      .toMatchObject({ watchLeaseUntil: null, watchConsecutiveFailures: 0 })
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!.getTime())
      .toBeGreaterThan(now.getTime() + 6 * 86400_000)
  })

  it.each(['legacy', 'failed-request', 'failed-progressive'] as const)('admits due care past an abandoned %s Audit status without rewriting its history', async previous => {
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    const old = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'CHECKING',
      recheckTrigger: 'WATCH', createdAt: new Date(now.getTime() - 86400_000), updatedAt: new Date(now.getTime() - 86400_000),
      ...(previous === 'failed-progressive' ? { executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
        targetUrl: 'https://example.com/', environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
        recoveryUntil: new Date(now.getTime() - 3600_000) } : {}),
    } })
    const request = previous !== 'legacy' ? await prisma.runRequest.create({ data: { projectId, auditId: old.id, source: 'WATCH',
      status: 'FAILED', environment: 'production', idempotencyKey: 'abandoned-watch', completedAt: new Date(now.getTime() - 3600_000) } }) : null
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.runRequest.count({ where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } } })).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old)
    if (request) expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
  })

  it.each(['request-lease', 'request-recovery', 'physical-lease', 'physical-recovery', 'physical-after-failed-request', 'legacy-request-physical'] as const)(
    'preserves live %s ownership and defers due care without reporting a failure', async authority => {
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null,
        watchConsecutiveFailures: 3, watchLastError: 'An earlier admission failed' } })
      const spec = { version: 1, engine: 'progressive-v1', targetUrl: 'https://example.com/', environment: 'production',
        scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null }
      const old = await prisma.audit.create({ data: { projectId, userId, url: spec.targetUrl, status: 'CHECKING',
        recheckTrigger: 'WATCH', executionSpec: authority === 'legacy-request-physical' ? Prisma.DbNull : spec, createdAt: new Date(now.getTime() - 3600_000),
        ...(authority.endsWith('recovery') ? { recoveryUntil: new Date(now.getTime() + 600_000) } : {}),
        ...(['physical-lease', 'physical-after-failed-request', 'legacy-request-physical'].includes(authority) ? { executionLeaseUntil: new Date(now.getTime() + 90_000) } : {}),
      } })
      const request = authority.startsWith('request-') || ['physical-after-failed-request', 'legacy-request-physical'].includes(authority) ? await prisma.runRequest.create({ data: { projectId, auditId: old.id,
        status: authority === 'physical-after-failed-request' ? 'FAILED' : 'RUNNING', source: 'WATCH', idempotencyKey: 'owned-watch', executionSpec: authority === 'legacy-request-physical' ? Prisma.DbNull : spec,
        leaseUntil: new Date(now.getTime() + (authority === 'request-lease' ? 600_000 : -60_000)) } }) : null
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId }))
        .toEqual({ processed: 1, enqueued: 0, errors: 0 })
      expect(queue.add).not.toHaveBeenCalled()
      expect(await prisma.audit.findMany({ where: { projectId } })).toEqual([old])
      if (request) expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(project).toMatchObject({ watchLeaseUntil: null, watchConsecutiveFailures: 3, watchLastError: 'An earlier admission failed' })
      expect(project.watchNextRunAt!.getTime()).toBeGreaterThan(now.getTime() + 14 * 60_000)
      expect(project.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    })

  it.each(['pause', 'remove', 'cadence', 'lease', 'attempt', 'target'] as const)('refuses a claim after a committed %s change during preparation', async change => {
    const transact = transactions.productTransaction
    let changed = false
    vi.spyOn(transactions, 'productTransaction').mockImplementation(async operation => {
      if (!changed) {
        changed = true
        if (change === 'pause') expect(await setProjectWatch({ projectId, userId, action: 'pause' })).toMatchObject({ ok: true })
        else await prisma.project.update({ where: { id: projectId }, data: {
          ...(change === 'remove' ? { deletedAt: new Date() } : {}),
          ...(change === 'cadence' ? { watchInterval: 'DAILY' as const } : {}),
          ...(change === 'lease' ? { watchLeaseUntil: new Date(leaseUntil.getTime() + 60_000) } : {}),
          ...(change === 'attempt' ? { watchLastAttemptAt: new Date(now.getTime() + 1000) } : {}),
          ...(change === 'target' ? { url: 'http://example.com:8080/' } : {}),
        } })
      }
      return transact(operation)
    })
    await expect(requestScheduledSiteRun(input())).rejects.toMatchObject({ code: 'WATCH_CLAIM_CHANGED' })
    expect(changed).toBe(true)
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    if (change === 'pause') expect(project).toMatchObject({ watchNextRunAt: null, watchLeaseUntil: null })
    if (change === 'remove') expect(project.deletedAt).not.toBeNull()
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('refuses an expired claim even when every saved claim field still matches', async () => {
    leaseUntil = new Date(Date.now() - 1000)
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: leaseUntil } })
    await expect(requestScheduledSiteRun(input())).rejects.toMatchObject({ code: 'WATCH_CLAIM_CHANGED' })
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('rechecks a pause committed after the admission transaction acquired its snapshot', async () => {
    const transact = transactions.productTransaction
    let changed = false, attempts = 0
    vi.spyOn(transactions, 'productTransaction').mockImplementation(operation => transact(async tx => {
      attempts += 1
      if (!changed) {
        await tx.project.findUniqueOrThrow({ where: { id: projectId } })
        changed = true
        expect(await setProjectWatch({ projectId, userId, action: 'pause' })).toMatchObject({ ok: true })
      }
      return operation(tx)
    }))
    await expect(requestScheduledSiteRun(input())).rejects.toMatchObject({ code: 'WATCH_CLAIM_CHANGED' })
    expect(attempts).toBeGreaterThan(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchNextRunAt: null, watchLeaseUntil: null })
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('admits a current claim through the scheduler and replays its receipt after a pause without new work', async () => {
    const replay = input()
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    const receipt = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: receipt.auditId! } })).toMatchObject({
      projectId, userId, recheckTrigger: 'WATCH', status: 'QUEUED', isPublic: false, skipUsageCount: true })
    expect(await setProjectWatch({ projectId, userId, action: 'pause' })).toMatchObject({ ok: true })
    expect(await requestScheduledSiteRun(replay)).toMatchObject({ runId: receipt.id, auditId: receipt.auditId, reused: true })
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({
      watchNextRunAt: null, watchLeaseUntil: null, watchConsecutiveFailures: 0 })
  })

  it('treats a customer pause before scheduled admission as cancellation without a failure or retry', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    const transact = transactions.productTransaction
    let calls = 0
    vi.spyOn(transactions, 'productTransaction').mockImplementation(async operation => {
      calls += 1
      // Default binding setup precedes the run admission transaction.
      if (calls === 2) expect(await setProjectWatch({ projectId, userId, action: 'pause' })).toMatchObject({ ok: true })
      return transact(operation)
    })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({
      watchNextRunAt: null, watchLeaseUntil: null, watchConsecutiveFailures: 0,
      watchLastError: 'Paused. This Site is not on a check schedule.' })
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('keeps a first scheduled run on its selected Site when its executable URL retains www and a port', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { url: 'http://www.example.com:8080/' } })
    const result = await requestScheduledSiteRun(input())
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: result.auditId! } })).toMatchObject({
      projectId, userId, url: 'http://www.example.com:8080/' })
    expect(await prisma.project.count({ where: { userId } })).toBe(1)
    expect(queue.add).toHaveBeenCalledTimes(1)
  })

  it('refuses an interactive Site run removed after selection instead of restoring it from the URL', async () => {
    const transact = transactions.productTransaction
    let removed = false
    vi.spyOn(transactions, 'productTransaction').mockImplementation(async operation => {
      if (!removed) {
        removed = true
        await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
      }
      return transact(operation)
    })
    await expect(requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
      idempotencyKey: 'removed-during-selection' })).rejects.toMatchObject({ status: 404 })
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).deletedAt).not.toBeNull()
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('refuses a selected Site command targeting another hostname without creating another Site', async () => {
    await expect(requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
      url: 'https://example.org/', idempotencyKey: 'different-host' })).rejects.toMatchObject({ status: 400 })
    expect(await prisma.project.count({ where: { userId } })).toBe(1)
    expect(await prisma.audit.count({ where: { userId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })
})
