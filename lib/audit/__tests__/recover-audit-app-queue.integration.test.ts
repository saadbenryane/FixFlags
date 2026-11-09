import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { retireLegacyExecution } from '../retire-legacy-execution'
import { runStuckAuditRecoverySweep } from '../recover-audit-job'
import { recoverExpiredSiteRuns } from '@/lib/sites/application/run-leases'
import * as reconciliation from '@/lib/sites/application/run-reconciliation'

const database = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
database('legacy delivery retirement', () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('preserves observations and terminal evidence while retiring an unfinished admission once', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CAPTURING' } })
    try {
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', confidence: 1, position: 0, whyItMatters: 'Customers cannot continue', rubric: 'REACH', severity: 'IMPORTANT',
        problem: 'Recorded failure', evidence: 'Original observation', fix: 'Repair the observed failure' } })
      expect(await retireLegacyExecution(audit.id)).toBe(true)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'FAILED', failureCode: 'LEGACY_EXECUTION_RETIRED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toEqual(flag)
      expect(await retireLegacyExecution(audit.id)).toBe(false)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('does not take a live execution lease', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CAPTURING',
      executionToken: 'another-owner', executionLeaseUntil: new Date(Date.now() + 60_000) } })
    try {
      expect(await retireLegacyExecution(audit.id)).toBe(false)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

  it('selects eligible legacy recovery beyond a full cohort of suspended and leased Audits', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test', lifecycleStatus: 'SUSPENDED' } })
    const site = await prisma.project.create({ data: { userId: owner.id, name: 'Suspended Site',
      url: 'https://suspended.example/', canonicalHost: 'suspended.example' } })
    const old = new Date(Date.now() - 7 * 86400_000)
    const until = new Date(Date.now() + 60_000)
    const blocked = Array.from({ length: 50 }, (_, index) => ({ id: randomUUID(), url: site.url, updatedAt: old,
      ...(index < 25 ? { userId: owner.id, projectId: site.id } : { executionToken: 'held', executionLeaseUntil: until }),
    }))
    const candidate = await prisma.audit.create({ data: { url: 'https://eligible.example/', status: 'CHECKING',
      updatedAt: new Date(old.getTime() + 1000) } })
    try {
      await prisma.audit.createMany({ data: blocked })
      expect(await runStuckAuditRecoverySweep()).toEqual({ requeued: 0, checked: 1, failed: 1 })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: candidate.id } })).toMatchObject({
        status: 'FAILED', failureCode: 'LEGACY_EXECUTION_RETIRED',
      })
      expect(await prisma.audit.count({ where: { id: { in: blocked.map(item => item.id) },
        executionGeneration: 0, updatedAt: old, status: 'QUEUED' } })).toBe(50)
    } finally {
      await prisma.audit.deleteMany({ where: { id: { in: [candidate.id, ...blocked.map(item => item.id)] } } })
      await prisma.user.delete({ where: { id: owner.id } })
    }
  })

  it('keeps a legacy Audit terminal after interrupted request settlement and releases its Site through recovery', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    const site = await prisma.project.create({ data: { userId: owner.id, name: 'Interrupted retirement',
      url: 'https://retired.example/', canonicalHost: 'retired.example' } })
    const audit = await prisma.audit.create({ data: { projectId: site.id, userId: owner.id, url: site.url, status: 'CHECKING' } })
    try {
      const outcome = await prisma.siteOutcome.create({ data: { projectId: site.id, slug: 'availability', name: 'Availability' } })
      const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
        idempotencyKey: randomUUID(), status: 'RUNNING', leaseUntil: new Date(Date.now() + 60_000),
        selections: { create: { outcomeId: outcome.id } },
      } })
      const interrupt = vi.spyOn(reconciliation, 'markOutcomeRunsCouldNotVerify')
        .mockRejectedValueOnce(new Error('Controlled settlement interruption'))
      try {
        await expect(retireLegacyExecution(audit.id)).rejects.toThrow('Controlled settlement interruption')
      } finally { interrupt.mockRestore() }

      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        status: 'FAILED', failureCode: 'LEGACY_EXECUTION_RETIRED', executionLeaseUntil: new Date(0),
      })
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'RUNNING' })
      expect(await recoverExpiredSiteRuns(reconciliation.reconcileOutcomeRunsForAudit)).toBe(1)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
        status: 'FAILED', errorCode: 'LEGACY_EXECUTION_RETIRED', leaseUntil: null,
      })
      expect(await prisma.outcomeAssessment.findFirst({ where: { runRequestId: request.id } })).toMatchObject({
        auditId: audit.id, outcomeId: outcome.id, state: 'COULD_NOT_VERIFY',
      })
    } finally {
      await prisma.audit.delete({ where: { id: audit.id } })
      await prisma.user.delete({ where: { id: owner.id } })
    }
  })

  it.each(['fresh activity', 'progressive admission'] as const)('leaves selected work alone after %s', async change => {
    const url = 'https://example.com/', updatedAt = new Date(Date.now() - 7 * 86400_000)
    const audit = await prisma.audit.create({ data: { url, status: 'CHECKING', updatedAt } })
    const query = prisma.$queryRaw.bind(prisma)
    const selection = vi.spyOn(prisma, '$queryRaw').mockImplementationOnce(async (...args) => {
      const rows = await query(...args)
      await prisma.audit.update({ where: { id: audit.id }, data: change === 'fresh activity' ? { updatedAt: new Date() } : {
        updatedAt, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url,
          environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      } })
      return rows
    })
    try {
      expect(await runStuckAuditRecoverySweep()).toEqual({ requeued: 0, checked: 1, failed: 0 })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        status: 'CHECKING', executionGeneration: 0, failureCode: null,
      })
    } finally {
      selection.mockRestore()
      await prisma.audit.delete({ where: { id: audit.id } })
    }
  })
})
