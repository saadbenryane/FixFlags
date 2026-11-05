import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { claimExecution } from '@/lib/audit/execution-ownership'
import { recoverExpiredSiteRuns } from '../run-leases'
import { reconcileOutcomeRunsForAudit } from '../run-reconciliation'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('bounded Site run recovery with physical execution ownership', () => {
  let userId: string, auditIds: string[]
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'run-recovery-' + randomUUID(); auditIds = []
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('reaches abandoned and completed requests beyond a full batch still owned by progressive execution', async () => {
    const now = new Date(), old = new Date(now.getTime() - 2 * 86400_000), expired = new Date(now.getTime() - 3600_000)
    const projectIds = Array.from({ length: 102 }, () => randomUUID())
    auditIds = Array.from({ length: 101 }, () => randomUUID())
    await prisma.project.createMany({ data: projectIds.map((id, index) => ({ id, userId, name: 'Recovery fixture ' + index,
      canonicalHost: 'recovery-' + index + '.example.test', url: 'https://recovery-' + index + '.example.test/' })) })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
      environment: 'production', checks: {}, outcomes: [], verificationTarget: null }
    await prisma.audit.createMany({ data: auditIds.map((id, index) => ({ id, projectId: projectIds[index], userId,
      url: 'https://recovery-' + index + '.example.test/', executionSpec: { ...spec, targetUrl: 'https://recovery-' + index + '.example.test/' },
      status: index < 100 ? 'QUEUED' as const : 'COMPLETED' as const,
      completedAt: index < 100 ? null : now, recoveryUntil: index === 0 ? expired : new Date(now.getTime() + 3600_000) })) })
    await prisma.runRequest.createMany({ data: projectIds.map((projectId, index) => ({ id: 'request-' + projectId, projectId,
      requestedByUserId: userId, source: 'WATCH' as const, idempotencyKey: randomUUID(), leaseUntil: expired,
      requestedAt: index < 100 ? old : expired, executionSpec: { ...spec, targetUrl: 'https://recovery-' + index + '.example.test/' },
      auditId: index < 101 ? auditIds[index] : null })) })

    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(2)
    expect(await prisma.runRequest.count({ where: { projectId: { in: projectIds.slice(0, 100) }, status: 'QUEUED' } })).toBe(100)
    expect(await prisma.audit.count({ where: { id: { in: auditIds.slice(0, 100) }, status: 'QUEUED' } })).toBe(100)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: 'request-' + projectIds[100] } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: 'request-' + projectIds[101] } })).toMatchObject({ status: 'FAILED', errorCode: 'RUN_ABANDONED' })
    expect(await prisma.flag.count({ where: { auditId: { in: auditIds } } })).toBe(0)
  })

  it.each(['database-null', 'json-null', 'legacy-json'] as const)('reclaims an expired %s legacy request without requiring a progressive executor', async kind => {
    const site = await prisma.project.create({ data: { userId, name: 'Legacy recovery', canonicalHost: 'example.com', url: 'https://example.com/' } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId, url: site.url,
      executionSpec: kind === 'database-null' ? Prisma.DbNull : kind === 'json-null' ? Prisma.JsonNull : { scope: 'SITE' } } })
    auditIds.push(audit.id)
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      idempotencyKey: randomUUID(), leaseUntil: new Date(0) } })
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED', errorCode: 'EXECUTION_LEASE_EXPIRED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'FAILED', failureCode: 'EXECUTION_LEASE_EXPIRED' })
    expect(await claimExecution(audit.id)).toBeNull()
  })

  it.each(['progressive-owner', 'completed-observation'] as const)('retains a %s acquired after candidate selection', async kind => {
    const site = await prisma.project.create({ data: { userId, name: 'Recovery handoff', canonicalHost: 'example.com', url: 'https://example.com/' } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId, url: site.url } })
    auditIds.push(audit.id)
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      idempotencyKey: randomUUID(), leaseUntil: new Date(0) } })
    const handoff = prisma.$extends({ query: { audit: {
      async updateMany({ args, query }) {
        // Establish physical handoff before the same-row retirement decision.
        await prisma.audit.update({ where: { id: audit.id }, data: kind === 'progressive-owner'
          ? { executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: site.url,
            environment: 'production', checks: {}, outcomes: [], verificationTarget: null } }
          : { status: 'COMPLETED', completedAt: new Date() } })
        return query(args)
      },
    } } })
    vi.spyOn(prisma.audit, 'updateMany').mockImplementationOnce(args => handoff.audit.updateMany(args))
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'QUEUED', errorCode: null })
  })
})
