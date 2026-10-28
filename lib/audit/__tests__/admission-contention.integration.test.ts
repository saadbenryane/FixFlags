import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { requestSiteRun } from '@/lib/sites/application/run-requests'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => queue }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit: async () => false }))

const run = process.env.REVIEW_CONCURRENCY_DB_REQUIRED === 'true' ? describe : describe.skip
run('independent website admission under PostgreSQL contention', () => {
  let owners: Array<{ userId: string; projectId: string }>
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
    queue.add.mockClear()
    owners = []
    for (let index = 0; index < 5; index++) {
      const userId = 'admission-owner-' + randomUUID()
      await prisma.user.create({ data: { id: userId, email: userId + '@example.test', plan: 'FREE' } })
      const project = await prisma.project.create({ data: { userId, name: 'Independent admission ' + index,
        url: 'https://example.com/', canonicalHost: 'example.com', accountChecksEnabled: false,
        notificationLevel: 'OFF', watchLastError: 'Paused. This Site is not on a check schedule.' } })
      owners.push({ userId, projectId: project.id })
    }
  })
  afterEach(async () => {
    const userIds = owners.map(owner => owner.userId)
    await prisma.audit.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.project.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })

  it('admits five different owners concurrently and replays each exact request without another execution', async () => {
    const input = (owner: typeof owners[number]) => ({ ...owner, outcomeIds: [], source: 'WEB' as const,
      scope: 'SITE' as const, idempotencyKey: 'independent:' + owner.userId })
    const results = await Promise.all(owners.map(owner => requestSiteRun(input(owner))))
    expect(new Set(results.map(result => result.auditId)).size).toBe(owners.length)
    for (const [index, owner] of owners.entries()) {
      const result = results[index]
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: result.auditId! } })).toMatchObject({
        userId: owner.userId, projectId: owner.projectId, status: 'QUEUED', isPublic: false,
      })
      expect(await prisma.runRequest.count({ where: { projectId: owner.projectId } })).toBe(1)
      expect(await prisma.audit.count({ where: { userId: owner.userId } })).toBe(1)
    }
    const replay = await Promise.all(owners.map(owner => requestSiteRun(input(owner))))
    expect(replay).toEqual(results.map(result => ({ ...result, reused: true })))
    expect(queue.add).toHaveBeenCalledTimes(owners.length)
  })

  it('creates five first Sites concurrently with exactly one automatic availability binding for each owner', async () => {
    await prisma.project.deleteMany({ where: { userId: { in: owners.map(owner => owner.userId) } } })
    const results = await Promise.all(owners.map(owner => createAndEnqueueAudit({ admission: { kind: 'new-check' },
    userId: owner.userId,
    url: 'https://example.com/' })))
    expect(new Set(results.map(result => result.auditId)).size).toBe(owners.length)
    for (const owner of owners) {
      const sites = await prisma.project.findMany({ where: { userId: owner.userId }, include: { siteOutcomes: { include: { bindings: true } } } })
      expect(sites).toHaveLength(1)
      expect(sites[0].siteOutcomes).toHaveLength(1)
      expect(sites[0].siteOutcomes[0]).toMatchObject({ slug: 'page-loads', kind: 'AVAILABILITY' })
      expect(sites[0].siteOutcomes[0].bindings).toHaveLength(1)
      expect(await prisma.audit.count({ where: { userId: owner.userId, projectId: sites[0].id, isPublic: false } })).toBe(1)
    }
    expect(queue.add).toHaveBeenCalledTimes(owners.length)
  })

  it('keeps simultaneous deliveries for one owner bound to one admission', async () => {
    const owner = owners[0]
    const results = await Promise.all(Array.from({ length: 5 }, () => requestSiteRun({ ...owner,
      outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'repeated-admission' })))
    expect(new Set(results.map(result => result.runId)).size).toBe(1)
    expect(new Set(results.map(result => result.auditId)).size).toBe(1)
    expect(await prisma.runRequest.count({ where: { projectId: owner.projectId } })).toBe(1)
    expect(await prisma.audit.count({ where: { userId: owner.userId } })).toBe(1)
    expect(queue.add).toHaveBeenCalledTimes(1)
  })
})
