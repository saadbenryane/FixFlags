import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { activeRunWhere, reclaimExpiredRuns } from '../run-leases'
import { reconcileOutcomeRunsForAudit } from '../run-reconciliation'
import { getOwnedRun } from '../run-queries'

const run = process.env.OUTCOME_CONFIRMATION_DB_REQUIRED === 'true' ? describe : describe.skip

run('expired run evidence with migrated PostgreSQL', () => {
  const userId = 'lease-evidence-' + randomUUID()
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', preferredTools: [] } })
  })
  afterAll(async () => { await prisma.user.delete({ where: { id: userId } }); await prisma.$disconnect() })

  async function observed(status: 'COMPLETED' | 'CAPTURING' = 'COMPLETED') {
    const host = randomUUID() + '.example.com', url = 'https://' + host + '/'
    const project = await prisma.project.create({ data: { userId, name: 'Lease recovery evidence', url, canonicalHost: host } })
    const outcome = await prisma.siteOutcome.create({ data: { projectId: project.id, slug: 'availability', name: 'The page loads', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', required: true, config: { startUrl: url } } } } })
    const audit = await prisma.audit.create({ data: { userId, projectId: project.id, url, status, isPublic: false,
      ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) } })
    const request = await prisma.runRequest.create({ data: { projectId: project.id, auditId: audit.id, requestedByUserId: userId,
      source: 'WEB', idempotencyKey: randomUUID(), status: 'RUNNING', leaseUntil: new Date(0),
      selections: { create: { outcomeId: outcome.id } } } })
    await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id, bindingKey: 'http', bindingVersion: 1,
      mechanism: 'HTTP_AVAILABILITY', disposition: 'SUCCEEDED', reason: 'available', detail: { statusCode: 200 } } })
    return { project, audit, request, outcome }
  }
  async function completed(requestId: string) {
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: requestId } })).toMatchObject({ status: 'COMPLETED', errorCode: null })
    expect(await getOwnedRun(userId, requestId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
  }

  it('retains a completed observation through a failed read and reconciles its real result later', async () => {
    const fixture = await observed()
    const read = vi.spyOn(prisma.audit, 'findUnique').mockRejectedValueOnce(new Error('Controlled Audit read failure'))
    try { expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0) }
    finally { read.mockRestore() }
    expect(await prisma.runRequest.findFirst({ where: activeRunWhere(fixture.project.id, new Date()) })).toMatchObject({ id: fixture.request.id, status: 'RUNNING' })
    expect(await prisma.outcomeAssessment.count({ where: { runRequestId: fixture.request.id } })).toBe(0)
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    await completed(fixture.request.id)
  })

  it('preserves a committed assessment through interrupted final projection without duplicating it on retry', async () => {
    const fixture = await observed()
    const write = vi.spyOn(prisma.runRequest, 'updateMany').mockRejectedValueOnce(new Error('Controlled result projection failure'))
    try { expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0) }
    finally { write.mockRestore() }
    const assessment = await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: fixture.request.id } })
    expect(assessment.state).toBe('CLEAR')
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } })).toMatchObject({ status: 'RUNNING', errorCode: null })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    await completed(fixture.request.id)
    expect(await prisma.outcomeAssessment.findMany({ where: { runRequestId: fixture.request.id } })).toEqual([assessment])
  })

  it('does not abandon an Audit that completed after the candidate read', async () => {
    const fixture = await observed('CAPTURING')
    const earlier = await prisma.audit.findUniqueOrThrow({ where: { id: fixture.audit.id } })
    await prisma.audit.update({ where: { id: fixture.audit.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
    const read = vi.spyOn(prisma.audit, 'findUnique').mockResolvedValueOnce(earlier)
    try { expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0) }
    finally { read.mockRestore() }
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } })).toMatchObject({ status: 'RUNNING', errorCode: null })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    await completed(fixture.request.id)
  })

  it('does not abandon a request after its physical Audit was attached to an earlier empty candidate', async () => {
    const fixture = await observed()
    const candidates = vi.spyOn(prisma.runRequest, 'findMany').mockResolvedValueOnce([{ ...fixture.request, auditId: null }])
    try { expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0) }
    finally { candidates.mockRestore() }
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    await completed(fixture.request.id)
  })

  it.each(['CAPTURING', 'FAILED'] as const)('still reclaims an expired legacy request without completed Audit evidence: %s', async status => {
    const fixture = await observed('CAPTURING')
    if (status === 'FAILED') await prisma.audit.update({ where: { id: fixture.audit.id }, data: { status } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } }))
      .toMatchObject({ status: 'FAILED', errorCode: 'RUN_ABANDONED' })
    expect(await prisma.outcomeAssessment.count({ where: { runRequestId: fixture.request.id } })).toBe(0)
  })
})
