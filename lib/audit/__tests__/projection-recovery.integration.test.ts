import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as finalization from '@/lib/audit/finalize'
import { recoverCompletedImprovementProjections } from '@/lib/audit/recover-audit-job'
import { randomUUID } from 'node:crypto'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { runAudit } from '@/lib/audit/runner'
import * as usage from '@/lib/audit/usage'
import { claimExecution, withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { executeTask, reconcileTasks } from '@/lib/audit/progressive/engine'
import { lifecycleHandlers } from '@/lib/audit/progressive/lifecycle'
import { recoverPendingAiReviews } from '@/lib/audit/enqueue-ai-review'
import * as prescriptionPlan from '@/lib/audit/prescription-plan'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('fair completed projection recovery in PostgreSQL', () => {
  let oldest: string, later: string
  let additionalAudit: string | undefined, userId: string | undefined, replacementUserId: string | undefined
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    const now = Date.now()
    const create = (age: number) => prisma.audit.create({ data: { url: 'https://example.com/', status: 'COMPLETED',
      completedAt: new Date(now - age), updatedAt: new Date(now - age) } })
    oldest = (await create(2 * 86400_000)).id
    later = (await create(86400_000)).id
    additionalAudit = undefined; userId = undefined; replacementUserId = undefined
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { id: { in: [oldest, later, ...(additionalAudit ? [additionalAudit] : [])] } } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    if (replacementUserId) await prisma.user.deleteMany({ where: { id: replacementUserId } })
  })

  async function ownedSite(host: string) {
    if (!userId) {
      userId = 'projection-owner-' + randomUUID()
      await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    }
    return prisma.project.create({ data: { userId, canonicalHost: host, url: 'https://' + host + '/', name: 'Projection fixture' } })
  }

  it('moves a failed projection behind untouched work, then recovers it through the same projector', async () => {
    const project = finalization.persistImprovementCycle
    vi.spyOn(finalization, 'persistImprovementCycle').mockImplementation(async (id, parentId, options) => {
      if (id === oldest) throw new Error('Controlled interrupted legacy projection')
      return project(id, parentId, options)
    })
    const before = await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 0, failed: 1 })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: later } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({
      status: 'COMPLETED', completedAt: before.completedAt, improvementProjectedAt: null,
    })
    vi.restoreAllMocks()
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({
      completedAt: before.completedAt, improvementProjectedAt: expect.any(Date),
    })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 0, projected: 0, failed: 0 })
  })

  it('does not let an actively held projection claim occupy the bounded batch', async () => {
    const leaseUntil = new Date(Date.now() + 600_000)
    await prisma.audit.update({ where: { id: oldest }, data: { executionLeaseUntil: leaseUntil, executionToken: 'held', updatedAt: new Date(0) } })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({
      executionLeaseUntil: leaseUntil, executionToken: 'held', improvementProjectedAt: null,
    })
  })

  it.each(['removed', 'suspended', 'transferred'] as const)('selects eligible work ahead of a %s Site that can no longer publish', async change => {
    const site = await ownedSite('previous.example.test')
    await prisma.audit.update({ where: { id: oldest }, data: { projectId: site.id, userId, updatedAt: new Date(0) } })
    if (change === 'removed') await prisma.project.update({ where: { id: site.id }, data: { deletedAt: new Date() } })
    if (change === 'suspended') await prisma.user.update({ where: { id: site.userId }, data: { lifecycleStatus: 'SUSPENDED' } })
    if (change === 'transferred') {
      replacementUserId = 'projection-next-' + randomUUID()
      await prisma.user.create({ data: { id: replacementUserId, email: replacementUserId + '@example.test' } })
      await prisma.project.update({ where: { id: site.id }, data: { userId: replacementUserId } })
    }
    const prior = await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: later } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 0, projected: 0, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toEqual(prior)
  })

  it.each(['Audit', 'Site'] as const)('releases other work while the oldest %s row is locked', async resource => {
    const site = await ownedSite('locked.example.test')
    await prisma.audit.update({ where: { id: oldest }, data: { projectId: site.id, userId, updatedAt: new Date(0) } })
    let ready!: () => void, release!: () => void
    const locked = new Promise<void>(resolve => { ready = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    const blocker = prisma.$transaction(async tx => {
      if (resource === 'Audit') await tx.$queryRaw`SELECT id FROM audits WHERE id = ${oldest} FOR UPDATE`
      else await tx.$queryRaw`SELECT id FROM projects WHERE id = ${site.id} FOR UPDATE`
      ready()
      await held
    })
    await Promise.race([locked, blocker])
    const limit = resource === 'Audit' ? 1 : 2
    const sweep = recoverCompletedImprovementProjections(limit)
    try {
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: later } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }))
      expect(await sweep).toEqual({ checked: limit, projected: 1, failed: 0 })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({
        improvementProjectedAt: null, executionGeneration: 0,
      })
    } finally { release(); await Promise.allSettled([blocker, sweep]) }
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
  })

  it('publishes an independent Site Flag while keeping the stalled Site in its original order', async () => {
    const stalled = await ownedSite('stalled.example.test')
    const peer = await ownedSite('peer.example.test')
    await prisma.audit.update({ where: { id: oldest }, data: { projectId: stalled.id, userId, skipUsageCount: true, updatedAt: new Date(0) } })
    await prisma.audit.update({ where: { id: later }, data: { projectId: stalled.id, userId, skipUsageCount: true, updatedAt: new Date(1) } })
    const audit = await prisma.audit.create({ data: { projectId: peer.id, userId, url: peer.url, status: 'COMPLETED',
      completedAt: new Date(), skipUsageCount: true } })
    additionalAudit = audit.id
    const flag = await prisma.flag.create({ data: { auditId: audit.id, checkId: 'no-https', source: 'DETERMINISTIC',
      rubric: 'REACH', impactTag: 'TRUST', severity: 'IMPORTANT', confidence: 1, position: 0,
      problem: 'The public page uses HTTP', evidence: 'Observed an HTTP response', whyItMatters: 'The page is unencrypted',
      fix: 'Serve the page over HTTPS', pageUrl: peer.url } })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const project = finalization.persistImprovementCycle
    const projection = vi.spyOn(finalization, 'persistImprovementCycle').mockImplementation(async (id, parentId, options) => {
      if (id === oldest) await held
      return project(id, parentId, options)
    })
    const sweep = recoverCompletedImprovementProjections()
    try {
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }))
      expect(await prisma.improvementOccurrence.findUnique({ where: { flagId: flag.id },
        include: { improvement: { select: { projectId: true } } } })).toMatchObject({ improvement: { projectId: peer.id } })
      expect(projection.mock.calls.some(([id]) => id === oldest)).toBe(true)
      expect(projection.mock.calls.some(([id]) => id === later)).toBe(false)
    } finally { release(); await sweep }
    expect(await sweep).toEqual({ checked: 3, projected: 3, failed: 0 })
  })

  it('leaves publication with the active finalization task when a duplicate Audit job arrives', async () => {
    const task = await prisma.auditExecutionTask.create({ data: { auditId: oldest, targetKey: 'task:finalize', source: 'EXECUTION',
      workKind: 'finalize', workState: 'RUNNING', status: 'RUNNING', workToken: 'finalizer', workGeneration: 1,
      workLeaseUntil: new Date(Date.now() + 60_000), workInput: { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' } } })
    await runAudit(oldest)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({ improvementProjectedAt: null, executionGeneration: 0 })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(task)
    expect(await recoverCompletedImprovementProjections(1)).toEqual({ checked: 1, projected: 1, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: later } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workLeaseUntil: new Date(0) } })
    await runAudit(oldest)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({ improvementProjectedAt: expect.any(Date), executionGeneration: 1 })
  })

  it('defers a finalization task while completed publication is owned by Audit recovery', async () => {
    const recovery = await claimExecution(oldest, { projectionOnly: true })
    if (!recovery) throw new Error('Recovery claim was not admitted')
    const task = await prisma.auditExecutionTask.create({ data: { auditId: oldest, targetKey: 'task:finalize', source: 'EXECUTION',
      workKind: 'finalize', workState: 'READY', status: 'PENDING', workInput: { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' } } })
    const handler = lifecycleHandlers.find(item => item.kind === 'finalize')!
    const evaluate = vi.fn(handler.evaluate)
    const handlers = new Map([['finalize', { ...handler, evaluate }]])
    const delivery = { auditId: oldest, taskId: task.id, generation: 1 }
    try {
      await executeTask(delivery, handlers)
      expect(evaluate).not.toHaveBeenCalled()
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
        workState: 'RETRY_WAIT', workAttempts: 0, workGeneration: 0, workErrorCode: 'EXECUTION_BUSY', workRetryAt: expect.any(Date),
      })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({ improvementProjectedAt: null, executionToken: recovery.token })
    } finally { await withExecutionOwnership(recovery, async () => undefined) }
    await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    expect(await reconcileTasks(oldest)).toContain(task.id)
    await executeTask(delivery, handlers)
    expect(evaluate).toHaveBeenCalledOnce()
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
  })

  it.each(['Audit replay', 'finalization task'] as const)('publishes recorded results when optional guidance admission fails during %s', async path => {
    userId = 'interrupted-guidance-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    await prisma.audit.update({ where: { id: oldest }, data: { userId, includeAi: true, triageAt: new Date() } })
    const admission = vi.spyOn(prescriptionPlan, 'prescriptionTaskPlans').mockImplementationOnce(() => { throw new Error('Controlled guidance admission failure') })
    try {
      if (path === 'Audit replay') await runAudit(oldest)
      else {
        const task = await prisma.auditExecutionTask.create({ data: { auditId: oldest, targetKey: 'task:finalize', source: 'EXECUTION',
          workKind: 'finalize', workState: 'READY', status: 'PENDING', workInput: { pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary' } } })
        const handler = lifecycleHandlers.find(item => item.kind === 'finalize')!
        await executeTask({ auditId: oldest, taskId: task.id, generation: 1 }, new Map([['finalize', handler]]))
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
          status: 'COMPLETED', workState: 'COMPLETED', workAttempts: 1,
        })
      }
      expect(admission).toHaveBeenCalledOnce()
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest } })).toMatchObject({
        status: 'COMPLETED', improvementProjectedAt: expect.any(Date), aiReviewAt: null,
      })
      expect(await prisma.auditExecutionTask.count({ where: { auditId: oldest, workKind: 'prescription' } })).toBe(0)
    } finally { admission.mockRestore() }
    expect(await recoverPendingAiReviews()).toBe(1)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: oldest, workKind: 'prescription' } })).toBe(1)
  })

  it.each([
    { recovery: 'worker', included: false },
    { recovery: 'scheduler', included: false },
    { recovery: 'worker', included: true },
  ])('settles interrupted completion through $recovery recovery exactly once (included=$included)', async ({ recovery, included }) => {
    userId = 'interrupted-usage-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const site = await prisma.project.create({ data: { userId, name: 'Interrupted usage', url: 'https://example.com/', canonicalHost: 'example.com' } })
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, status: 'FINALIZING', skipUsageCount: included,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: site.url, environment: 'production',
        checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null } } })
    additionalAudit = audit.id
    const interruption = vi.spyOn(usage, 'incrementUsageOnCompleteForAudit').mockRejectedValueOnce(new Error('Controlled usage write interruption'))
    try {
      await expect(finalization.finalizeTriageDegraded({ auditId: audit.id, durationMs: 100, pagespeedCalls: 0,
        evidence: { desktopScreenshot: false, mobileScreenshot: false, metadata: false, desktopPageSpeed: false, mobilePageSpeed: false },
        reason: 'unknown', errorMsg: 'Controlled incomplete collection' })).rejects.toThrow('Controlled usage write interruption')
    } finally { interruption.mockRestore() }
    const interrupted = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(interrupted).toMatchObject({ status: 'COMPLETED', completedAt: expect.any(Date), usageCountedAt: null, improvementProjectedAt: null })
    if (recovery === 'worker') await runAudit(audit.id)
    else expect(await recoverCompletedImprovementProjections()).toEqual({ checked: 3, projected: 3, failed: 0 })
    const settled = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(settled).toMatchObject({ completedAt: interrupted.completedAt, usageCountedAt: expect.any(Date), improvementProjectedAt: expect.any(Date) })
    await runAudit(audit.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      usageCountedAt: settled.usageCountedAt, improvementProjectedAt: settled.improvementProjectedAt,
    })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).auditsUsed).toBe(included ? 0 : 1)
  })

  it('publishes owned progressive findings without turning missing observations into a healthy Site', async () => {
    userId = 'projection-recovery-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const site = await prisma.project.create({ data: { userId, name: 'Interrupted projection', url: 'https://example.com/', canonicalHost: 'example.com' } })
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, status: 'COMPLETED', completedAt: new Date(),
      reportCompleteness: 'PARTIAL', evidenceCoverage: {}, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
        targetUrl: site.url, environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null } } })
    additionalAudit = audit.id
    expect(await recoverCompletedImprovementProjections()).toEqual({ checked: 3, projected: 3, failed: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      completedAt: audit.completedAt, reportCompleteness: 'PARTIAL', evidenceCoverage: {}, improvementProjectedAt: expect.any(Date),
    })
    expect(await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'projection:flag-comparison' } }))
      .toMatchObject({ status: 'COMPLETED' })
    expect((await loadSiteHome(site.id))?.presentation.result.state).toBe('could_not_verify')
    expect(await prisma.flag.count({ where: { auditId: audit.id } })).toBe(0)
  })
})
