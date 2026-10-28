import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as finalization from '@/lib/audit/finalize'
import { recoverCompletedImprovementProjections } from '@/lib/audit/recover-audit-job'
import { randomUUID } from 'node:crypto'
import { loadSiteHome } from '@/lib/sites/application/queries'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('fair completed projection recovery in PostgreSQL', () => {
  let oldest: string, later: string
  let additionalAudit: string | undefined, userId: string | undefined
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    const now = Date.now()
    const create = (age: number) => prisma.audit.create({ data: { url: 'https://example.com/', status: 'COMPLETED',
      completedAt: new Date(now - age), updatedAt: new Date(now - age) } })
    oldest = (await create(2 * 86400_000)).id
    later = (await create(86400_000)).id
    additionalAudit = undefined; userId = undefined
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { id: { in: [oldest, later, ...(additionalAudit ? [additionalAudit] : [])] } } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('moves a failed projection behind untouched work, then recovers it through the same projector', async () => {
    const project = finalization.persistImprovementCycle
    vi.spyOn(finalization, 'persistImprovementCycle').mockImplementation(async (id, parentId) => {
      if (id === oldest) throw new Error('Controlled interrupted legacy projection')
      return project(id, parentId)
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
