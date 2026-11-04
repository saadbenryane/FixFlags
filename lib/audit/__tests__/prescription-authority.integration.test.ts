import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { enqueueAiReview, recoverPendingAiReviews } from '../enqueue-ai-review'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('prescription admission through current Site authority', () => {
  const owner = 'prescription-owner-' + randomUUID(), nextOwner = owner + '-next'
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.createMany({ data: [owner, nextOwner].map(id => ({ id, email: id + '@example.test' })) })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    const queue = getAuditTaskQueue('provider')
    const tasks = await prisma.auditExecutionTask.findMany({ where: { audit: { userId: owner } }, select: { id: true } })
    for (const task of tasks) await (await queue.getJob(task.id + '-g1'))?.remove()
    await prisma.audit.deleteMany({ where: { userId: owner } })
    await prisma.project.deleteMany({ where: { userId: { in: [owner, nextOwner] } } })
    await prisma.user.updateMany({ where: { id: { in: [owner, nextOwner] } }, data: { lifecycleStatus: 'ACTIVE' } })
  })
  afterAll(async () => {
    const queue = getAuditTaskQueue('provider'), client = await queue.client
    await queue.close(); client.disconnect()
    await prisma.user.deleteMany({ where: { id: { in: [owner, nextOwner] } } })
    await prisma.$disconnect()
  })
  async function source(projectId?: string | null, completedAt = new Date(), includeAi = false) {
    const project = projectId === undefined ? await prisma.project.create({ data: { userId: owner,
      name: 'Prescription authority fixture', canonicalHost: randomUUID() + '.example.test', url: 'https://example.com/' } }) : null
    const audit = await prisma.audit.create({ data: { userId: owner, projectId: project?.id ?? projectId,
      url: 'https://example.com/', status: 'COMPLETED', triageAt: completedAt, completedAt, includeAi } })
    await prisma.flag.create({ data: { auditId: audit.id, checkId: 'buttons-no-text', source: 'DETERMINISTIC',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'The recorded control has no accessible name',
      evidence: 'Native control-name observation', whyItMatters: 'The control purpose is unavailable',
      fix: 'Name the existing control', confidence: 1, position: 0 } })
    return audit
  }
  it.each(['transferred', 'removed', 'suspended'] as const)('does not admit guidance for a %s Site or rewrite its source', async state => {
    const audit = await source()
    if (state === 'transferred') await prisma.project.update({ where: { id: audit.projectId! }, data: { userId: nextOwner } })
    if (state === 'removed') await prisma.project.update({ where: { id: audit.projectId! }, data: { deletedAt: new Date() } })
    if (state === 'suspended') await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'SUSPENDED' } })
    await enqueueAiReview(audit.id)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id } })).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
  })
  it('selects eligible recovery after a full batch of retained former-owner reports', async () => {
    const first = await source(undefined, new Date('2026-10-01T00:00:00Z'), true)
    const second = await source(first.projectId, new Date('2026-10-02T00:00:00Z'), true)
    await prisma.project.update({ where: { id: first.projectId! }, data: { userId: nextOwner } })
    const eligible = await source(undefined, new Date('2026-10-03T00:00:00Z'), true)
    expect(await recoverPendingAiReviews(1)).toBe(1)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: eligible.id, workKind: 'prescription' } })).toBe(1)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: { in: [first.id, second.id] } } })).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: second.id } })).toEqual(second)
    expect(await recoverPendingAiReviews(1)).toBe(0)
  })
  it('retains legacy owned report admission and its recorded delay without a Site', async () => {
    const audit = await source(null), startedAt = Date.now()
    await enqueueAiReview(audit.id, 5000)
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
    expect(task.workRetryAt!.getTime()).toBeGreaterThanOrEqual(startedAt + 5000)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ includeAi: true })
    await enqueueAiReview(audit.id)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workKind: 'prescription' } })).toBe(1)
  })
  it('does not count a selected report as recovered when ownership changes before admission', async () => {
    const audit = await source(undefined, new Date(), true), read = prisma.$queryRaw.bind(prisma)
    let transferred = false
    vi.spyOn(prisma, '$queryRaw').mockImplementation(async (...args) => {
      const rows = await read(...args)
      if (!transferred && Array.isArray(rows) && rows.some(row => row?.id === audit.id)) {
        transferred = true
        await prisma.project.update({ where: { id: audit.projectId! }, data: { userId: nextOwner } })
      }
      return rows
    })
    expect(await recoverPendingAiReviews(1)).toBe(0)
    expect(transferred).toBe(true)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id } })).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
  })
  it('waits for an in-flight Site transfer before admitting guidance', async () => {
    const audit = await source()
    let announce!: () => void, release!: () => void, settled = false
    const acquired = new Promise<void>(resolve => { announce = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    const transfer = prisma.$transaction(async tx => {
      await tx.project.update({ where: { id: audit.projectId! }, data: { userId: nextOwner } })
      announce(); await held
    }, { timeout: 10_000 })
    await acquired
    const admission = enqueueAiReview(audit.id).finally(() => { settled = true })
    try {
      await expect.poll(async () => {
        const [state] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE '%FROM "projects" p%' AND query LIKE '%FOR SHARE%') AS waiting`
        return settled ? 'settled' : state.waiting ? 'waiting' : 'pending'
      }, { timeout: 3000 }).toBe('waiting')
      release(); await transfer; await admission
      expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id } })).toBe(0)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    } finally { release(); await transfer; await admission }
  })
})
