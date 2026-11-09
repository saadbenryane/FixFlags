import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { claimExecution } from '@/lib/audit/execution-ownership'
import { activeRunWhere, reclaimExpiredRuns } from '../run-leases'
import { reconcileOutcomeRunsForAudit } from '../run-reconciliation'
import { getOwnedRun } from '../run-queries'
import { performAdminExternalAction } from '@/lib/admin/external-actions'
import { adminDomainActorForOperation } from '@/lib/admin/domain-actor'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'

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

  it.each(['authorized result', 'authorized retirement', 'authorized cleanup', 'transfer before retirement',
    'revocation before result', 'replacement before request close'] as const)(
    'keeps operator expired-run recovery within its scope: %s', async scenario => {
      const authorized = scenario.startsWith('authorized')
      const fixture = await observed(scenario === 'authorized result' || scenario === 'revocation before result' ? 'COMPLETED' : 'CAPTURING')
      const { project, audit, request } = fixture
      if (scenario === 'replacement before request close') await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED' } })
      const actorId = 'run-recovery-operator-' + randomUUID(), sessionId = randomUUID()
      await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } })
      await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
      const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: new Date(),
        action: scenario === 'authorized cleanup' ? 'SITE_ACCOUNT_CLEANUP' : 'SITE_RECONCILE',
        targetType: 'SITE', targetId: project.id, ownerId: userId, reason: 'Controlled expired-run authority',
        input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 60_000),
        status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 60_000) } })
      const find = prisma.audit.findUnique.bind(prisma.audit)
      const selected = authorized ? undefined : vi.spyOn(prisma.audit, 'findUnique').mockImplementationOnce(async args => {
        const result = await find(args)
        if (scenario === 'transfer before retirement') await prisma.$transaction([
          prisma.project.update({ where: { id: project.id }, data: { userId: actorId } }),
          prisma.audit.update({ where: { id: audit.id }, data: { userId: actorId } }),
        ])
        if (scenario === 'revocation before result') await prisma.session.delete({ where: { id: sessionId } })
        if (scenario === 'replacement before request close') await prisma.adminOperation.update({ where: { id: operation.id }, data: { executionToken: randomUUID() } })
        return result
      })
      try {
        if (scenario === 'authorized cleanup') {
          await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'DELETING' } })
          await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } })
          const scope = { actor: adminDomainActorForOperation(operation), projectId: project.id, userId }
          await expect(reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit, scope)).rejects.toMatchObject({ code: 'TARGET_CHANGED' })
          expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit, { ...scope, cleanup: true })).toBe(1)
          expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED', errorCode: 'EXECUTION_LEASE_EXPIRED' })
          return
        }
        const tick = performAdminExternalAction(operation, {})
        if (authorized) {
          await expect(tick).resolves.toMatchObject({ state: 'RECONCILED', reconciledRuns: 1 })
          if (scenario === 'authorized result') await completed(request.id)
          else expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED', errorCode: 'EXECUTION_LEASE_EXPIRED' })
          return
        }
        await expect(tick).rejects.toMatchObject({ code: scenario === 'transfer before retirement' ? 'TARGET_CHANGED'
          : scenario === 'revocation before result' ? 'ADMIN_ACCESS_REVOKED' : 'ADMIN_DOMAIN_ACCESS_DENIED' })
        expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
          status: scenario === 'replacement before request close' ? 'FAILED' : audit.status, failureCode: null,
        })
        expect(await prisma.outcomeAssessment.count({ where: { runRequestId: request.id } })).toBe(0)
        expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(1)
      } finally {
        selected?.mockRestore()
        if (scenario === 'authorized cleanup') await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE' } })
        await prisma.adminOperation.delete({ where: { id: operation.id } })
        await prisma.user.delete({ where: { id: actorId } })
      }
    })

  it('reports no settlement until a completed Site Audit has published its comparison', async () => {
    const { project, audit, request } = await observed()
    await prisma.runRequest.update({ where: { id: request.id }, data: { executionSpec: { version: 1, engine: 'progressive-v1',
      scope: 'SITE', environment: 'production', targetUrl: project.url, checks: {}, outcomes: [], verificationTarget: null } } })
    expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'RUNNING' })
    await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: FLAG_COMPARISON_TARGET, source: 'SYSTEM', status: 'COMPLETED' } })
    expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'COMPLETED' })
    expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(0)
  })

  it.each(['selected', 'renewed-before-write'] as const)('preserves a legacy physical lease %s despite an expired request lease', async timing => {
    const fixture = await observed('CAPTURING'), lease = new Date(Date.now() + 90_000)
    let changed = false
    if (timing === 'selected') await prisma.audit.update({ where: { id: fixture.audit.id }, data: { executionLeaseUntil: lease } })
    const renewal = prisma.$extends({ query: { audit: {
      async updateMany({ args, query }) {
        if (!changed) {
          changed = true
          await prisma.audit.update({ where: { id: fixture.audit.id }, data: { executionLeaseUntil: lease } })
        }
        return query(args)
      },
    } } })
    const write = timing === 'renewed-before-write' ? vi.spyOn(prisma.audit, 'updateMany')
      .mockImplementation(input => renewal.audit.updateMany(input)) : null
    try { expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0) }
    finally { write?.mockRestore() }
    if (write) expect(changed).toBe(true)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } })).toEqual(fixture.request)
    expect(await prisma.runRequest.findFirst({ where: activeRunWhere(fixture.project.id, new Date()) })).toMatchObject({ id: fixture.request.id })
    expect(await prisma.outcomeAssessment.count({ where: { runRequestId: fixture.request.id } })).toBe(0)
    await prisma.audit.update({ where: { id: fixture.audit.id }, data: { executionLeaseUntil: new Date(0) } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } })).toMatchObject({ status: 'FAILED', errorCode: 'EXECUTION_LEASE_EXPIRED' })
  })

  it('reconciles a completed observation before its physical lease is released', async () => {
    const fixture = await observed()
    await prisma.audit.update({ where: { id: fixture.audit.id }, data: { executionLeaseUntil: new Date(Date.now() + 90_000) } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    await completed(fixture.request.id)
  })

  it.each(['COMPLETED', 'FAILED'] as const)('settles a released %s Audit before its request lease expires', async status => {
    const fixture = await observed(status === 'COMPLETED' ? 'COMPLETED' : 'CAPTURING')
    if (status === 'FAILED') await prisma.audit.update({ where: { id: fixture.audit.id }, data: { status, completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: fixture.request.id }, data: { leaseUntil: new Date(Date.now() + 1800_000) } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    if (status === 'COMPLETED') await completed(fixture.request.id)
    else expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } }))
      .toMatchObject({ status: 'FAILED', errorCode: 'RUN_ABANDONED', leaseUntil: null })
  })

  it.each(['COMPLETED', 'FAILED'] as const)('retains a %s execution with both request and physical leases still live', async status => {
    const fixture = await observed(status === 'COMPLETED' ? 'COMPLETED' : 'CAPTURING'), until = new Date(Date.now() + 90_000)
    await prisma.audit.update({ where: { id: fixture.audit.id }, data: { status, executionLeaseUntil: until } })
    const request = await prisma.runRequest.update({ where: { id: fixture.request.id }, data: { leaseUntil: until } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
    await prisma.audit.update({ where: { id: fixture.audit.id }, data: { executionLeaseUntil: new Date(0) } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
  })

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

  it('restores the recorded failure and inconclusive outcome when the worker stopped before settling the run', async () => {
    const { project, audit, request, outcome } = await observed('CAPTURING')
    const failedAt = new Date(Date.now() - 60_000)
    const errorCode = 'QUEUE_ENQUEUE_FAILED'
    await prisma.runRequest.update({ where: { id: request.id }, data: { requestedAt: new Date(failedAt.getTime() - 1000) } })
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED', completedAt: failedAt,
      failureCode: errorCode, errorMsg: 'Internal execution diagnostic' } })

    expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      status: 'FAILED', errorCode, errorMessage: getUserFacingAuditError(errorCode), completedAt: failedAt, leaseUntil: null,
    })
    const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: outcome.id } } })
    expect(assessment).toMatchObject({ state: 'COULD_NOT_VERIFY', evidence: { reason: errorCode }, assessedAt: failedAt, validUntil: failedAt,
      coverage: { requiredBindings: ['http'], observedBindings: [] } })
    expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: 'FAILED', outcomes: [{ outcomeId: outcome.id, result: 'COULD_NOT_VERIFY' }] })
    expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.outcomeAssessment.findMany({ where: { runRequestId: request.id } })).toEqual([assessment])
  })

  it('retains the active run when assessment persistence fails and settles it once on concurrent retry', async () => {
    const { project, audit, request, outcome } = await observed('CAPTURING')
    const errorCode = 'CONTROLLED_SETTLEMENT_WRITE_FAILURE'
    const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: project.url, environment: 'production',
      checks: {}, verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null,
        bindingPolicy: outcome.bindingPolicy, bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: project.url }, scope: null }] }] }
    await prisma.runRequest.update({ where: { id: request.id }, data: { executionSpec } })
    await prisma.outcomeExecutionBinding.updateMany({ where: { outcomeId: outcome.id }, data: { enabled: false } })
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED', completedAt: new Date(), failureCode: errorCode } })
    await prisma.$executeRaw`ALTER TABLE outcome_assessments ADD CONSTRAINT reject_controlled_settlement
      CHECK (evidence->>'reason' IS DISTINCT FROM 'CONTROLLED_SETTLEMENT_WRITE_FAILURE') NOT VALID`
    try {
      expect(await reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)).toBe(0)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'RUNNING', completedAt: null })
      expect(await prisma.outcomeAssessment.count({ where: { runRequestId: request.id } })).toBe(0)
    } finally { await prisma.$executeRaw`ALTER TABLE outcome_assessments DROP CONSTRAINT reject_controlled_settlement` }

    const reclaim = () => reclaimExpiredRuns(project.id, reconcileOutcomeRunsForAudit)
    expect((await Promise.all([reclaim(), reclaim()])).sort()).toEqual([0, 1])
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED', errorCode })
    expect(await prisma.outcomeAssessment.findMany({ where: { runRequestId: request.id } })).toMatchObject([
      { state: 'COULD_NOT_VERIFY', coverage: { requiredBindings: ['http'], observedBindings: [] } },
    ])
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
    const originalBindings = await prisma.outcomeBindingExecution.findMany({ where: { auditId: fixture.audit.id } })
    if (status === 'FAILED') await prisma.audit.update({ where: { id: fixture.audit.id }, data: { status } })
    expect(await reclaimExpiredRuns(fixture.project.id, reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: fixture.request.id } }))
      .toMatchObject({ status: 'FAILED', errorCode: status === 'FAILED' ? 'RUN_ABANDONED' : 'EXECUTION_LEASE_EXPIRED' })
    expect(await claimExecution(fixture.audit.id, { resume: true })).toBeNull()
    expect(await prisma.outcomeBindingExecution.findMany({ where: { auditId: fixture.audit.id } })).toEqual(originalBindings)
    expect(await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: fixture.request.id } })).toMatchObject({
      state: 'COULD_NOT_VERIFY', evidence: { reason: status === 'FAILED' ? 'RUN_ABANDONED' : 'EXECUTION_LEASE_EXPIRED' },
    })
  })
})
