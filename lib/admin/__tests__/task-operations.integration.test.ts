import { randomUUID } from 'node:crypto'
import type { AuditVerifierExecution } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadOperations } from '../operations'
import { loadSiteOperations } from '../site-operations'

vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: async () => null }))
const run = process.env.ACCOUNT_OPERATIONS_DB_REQUIRED === 'true' ? describe : describe.skip
run('persistent operator execution history in PostgreSQL', () => {
  const ownerId = 'task-history-' + randomUUID(), inactiveId = ownerId + '-inactive'
  const sessionId = randomUUID(), old = new Date(Date.now() - 3 * 86400_000)
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.createMany({ data: [
      { id: ownerId, email: ownerId + '@example.test', role: 'admin' },
      { id: inactiveId, email: inactiveId + '@example.test', lifecycleStatus: 'SUSPENDED' },
    ] })
    await prisma.session.create({ data: { id: sessionId, userId: ownerId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
  })
  afterAll(async () => {
    await prisma.project.deleteMany({ where: { userId: { in: [ownerId, inactiveId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, inactiveId] } } })
    await prisma.$disconnect()
  })
  it('keeps old and partial failures inspectable without misclassifying inapplicability or rewriting history', async () => {
    const expected: string[] = [], snapshots: AuditVerifierExecution[] = []
    const samples = [
      { name: 'old-failure', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: true },
      { name: 'partial-completed', state: 'BLOCKED' as const, status: 'FAILED' as const, auditStatus: 'COMPLETED' as const, keep: true },
      { name: 'intentional-inapplicability', state: 'BLOCKED' as const, status: 'NOT_APPLICABLE' as const, auditStatus: 'COMPLETED' as const, keep: false },
      { name: 'inactive-owner', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: false },
      { name: 'removed-site', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: false },
      { name: 'later-success', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'COMPLETED' as const, keep: true },
    ]
    for (const sample of samples) {
      const project = await prisma.project.create({ data: { userId: sample.name === 'inactive-owner' ? inactiveId : ownerId,
        name: sample.name, canonicalHost: sample.name + '.test', url: 'https://' + sample.name + '.test/',
        deletedAt: sample.name === 'removed-site' ? new Date() : null, watchInterval: null } })
      const audit = await prisma.audit.create({ data: { userId: project.userId, projectId: project.id,
        url: project.url, status: sample.auditStatus, createdAt: old, completedAt: old,
        reportCompleteness: sample.auditStatus === 'COMPLETED' ? 'PARTIAL' : 'UNKNOWN' } })
      const task = await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:controlled',
        source: 'DETERMINISTIC', workKind: 'http', workState: sample.state, status: sample.status,
        workErrorCode: sample.keep ? 'CONTROLLED_INCOMPLETE' : null, updatedAt: old } })
      if (sample.keep) expected.push(task.id)
      snapshots.push(task)
      if (sample.name === 'later-success') await prisma.audit.create({ data: { userId: ownerId, projectId: project.id,
        url: project.url, status: 'COMPLETED', reportCompleteness: 'FULL', completedAt: new Date() } })
    }
    const actor = { id: ownerId, sessionId, role: 'admin', email: ownerId + '@example.test', authenticatedAt: new Date() }
    const history = await loadOperations(actor, { queue: 'tasks' }), summary = await loadSiteOperations()
    expect(history.total).toBe(expected.length)
    expect(history.counts[1]).toBe(expected.length)
    expect(summary.find(item => item.label === 'Incomplete execution history')?.value).toBe(expected.length)
    expect(history.rows.map(row => row.id).sort()).toEqual(expected.sort())
    for (const row of history.rows) {
      expect(row.at).toEqual(old)
      expect(row.action).toBeNull()
      expect(row.auditId).toBe(row.targetId)
    }
    expect(await prisma.auditVerifierExecution.findMany({ where: { audit: { project: { userId: { in: [ownerId, inactiveId] } } } }, orderBy: { id: 'asc' } }))
      .toEqual(snapshots.sort((a, b) => a.id.localeCompare(b.id)))
    await expect(loadOperations({ ...actor, sessionId: 'revoked' }, { queue: 'tasks' })).rejects.toThrow('Administrator access is no longer available')
  })
})
