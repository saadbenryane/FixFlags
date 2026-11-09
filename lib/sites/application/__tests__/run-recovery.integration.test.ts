import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { claimExecution } from '@/lib/audit/execution-ownership'
import { activeRunWhere, recoverExpiredSiteRuns } from '../run-leases'
import { reconcileOutcomeRunsForAudit } from '../run-reconciliation'
import { requestSiteRun } from '../run-requests'
import { retainSharedRunKey } from '../run-request-keys'
import { loadActiveSiteRuns } from '../site-execution'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'

vi.mock('node:dns/promises', async original => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture({
  ...await original<typeof import('node:dns/promises')>(), resolve4: async () => ['203.0.114.1'], resolve6: async () => [],
}))

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

  async function mismatchedRequest(unassigned = false) {
    const [site, other] = await Promise.all(['requested', 'other'].map(name => prisma.project.create({
      data: { userId, name, canonicalHost: name + '.example.com', url: 'https://' + name + '.example.com/' },
    })))
    const until = new Date(Date.now() + 60_000)
    const audit = await prisma.audit.create({ data: { projectId: unassigned ? null : other.id, userId: unassigned ? null : userId,
      url: other.url, status: 'CHECKING', executionToken: randomUUID(), executionLeaseUntil: until,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: other.url,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    auditIds.push(audit.id)
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      requestedByUserId: userId, idempotencyKey: 'mismatched', status: 'RUNNING', leaseUntil: until } })
    return { site, audit, request }
  }

  it.each([false, true])('releases the invalid request while its linked Audit still has a live lease (unassigned: %s)', async unassigned => {
    const { site, audit, request } = await mismatchedRequest(unassigned)
    expect(await prisma.runRequest.findFirst({ where: activeRunWhere(site.id, new Date()) })).toBeNull()
    expect(await loadActiveSiteRuns((await loadSiteRecord(site.id))!, new Date())).toEqual([])
    const reconcile = vi.fn(reconcileOutcomeRunsForAudit)
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(1)
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(0)
    expect(reconcile).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      auditId: audit.id, status: 'FAILED', errorCode: 'RUN_AUDIT_SCOPE_CHANGED', leaseUntil: null,
    })
    expect(await prisma.outcomeAssessment.count({ where: { runRequestId: request.id } })).toBe(0)
  })

  it('refuses an invalid replay and admits a fresh owner check without waiting for the other Audit', async () => {
    const { site, audit, request } = await mismatchedRequest()
    const command = { projectId: site.id, userId, source: 'WEB' as const, scope: 'SITE' as const, outcomeIds: [] }
    await expect(requestSiteRun({ ...command, idempotencyKey: request.idempotencyKey }))
      .rejects.toMatchObject({ code: 'RUN_AUDIT_SCOPE_CHANGED' })
    await expect(retainSharedRunKey({ projectId: site.id, userId, source: 'MCP', idempotencyKey: 'would-join',
      runRequestId: request.id, cleanup: false }, () => true)).rejects.toMatchObject({ code: 'SITE_RUN_IN_PROGRESS' })
    expect(await prisma.runRequestKey.count({ where: { runRequestId: request.id } })).toBe(1)

    const started = await requestSiteRun({ ...command, idempotencyKey: 'fresh' })
    expect(started).toMatchObject({ reused: false, auditId: expect.any(String) })
    expect(started.auditId).not.toBe(audit.id)
    auditIds.push(started.auditId!)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: started.auditId! } })).toMatchObject({ projectId: site.id })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } }))
      .toMatchObject({ status: 'FAILED', errorCode: 'RUN_AUDIT_SCOPE_CHANGED' })
    await expect(requestSiteRun({ ...command, idempotencyKey: 'fresh' })).resolves.toMatchObject({ runId: started.runId, reused: true })
  })

  it('preserves a now-valid attachment established after invalid candidate selection', async () => {
    const { site, audit, request } = await mismatchedRequest(true)
    const handoff = prisma.$extends({ query: { runRequest: {
      async findMany({ args, query }) {
        const candidates = await query(args)
        await prisma.audit.update({ where: { id: audit.id }, data: { userId, projectId: site.id } })
        return candidates
      },
    } } })
    vi.spyOn(prisma.runRequest, 'findMany').mockImplementationOnce(args => handoff.runRequest.findMany(args))
    const reconcile = vi.fn(reconcileOutcomeRunsForAudit)
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(0)
    expect(reconcile).not.toHaveBeenCalled()
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } }))
      .toMatchObject({ status: 'RUNNING', auditId: audit.id, leaseUntil: request.leaseUntil, errorCode: null })
  })

  it('keeps a contended foreign Audit out of the concurrent admission fallback', async () => {
    const { site, audit, request } = await mismatchedRequest()
    let announce!: () => void, release!: () => void
    const acquired = new Promise<void>(resolve => { announce = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    const blocker = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM audits WHERE id = ${audit.id} FOR UPDATE`
      announce()
      await held
    }, { timeout: 10_000 })
    try {
      await Promise.race([acquired, blocker])
      await expect(requestSiteRun({ projectId: site.id, userId, source: 'WEB', scope: 'SITE', outcomeIds: [], idempotencyKey: 'fresh' }))
        .rejects.toMatchObject({ code: 'SITE_RUN_IN_PROGRESS' })
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
    } finally { release(); await blocker }
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
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
    await prisma.auditVerificationReceipt.create({ data: { auditId: auditIds[100], targetKey: FLAG_COMPARISON_TARGET, source: 'SYSTEM', status: 'COMPLETED' } })
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

  it('gives later Sites a recovery turn after a full batch of reconciliation failures and resumes the preserved results later', async () => {
    const old = new Date(Date.now() - 2 * 86400_000), completedAt = new Date(old.getTime() + 3600_000)
    const projectIds = Array.from({ length: 102 }, () => randomUUID())
    auditIds = Array.from({ length: 101 }, () => randomUUID())
    await prisma.project.createMany({ data: projectIds.map((id, index) => ({ id, userId, name: 'Recovery fairness ' + index,
      canonicalHost: 'fairness-' + index + '.example.test', url: 'https://fairness-' + index + '.example.test/' })) })
    const spec = (index: number) => ({ version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://fairness-' + index + '.example.test/',
      environment: 'production', checks: {}, outcomes: [], verificationTarget: null })
    await prisma.audit.createMany({ data: auditIds.map((id, index) => ({ id, projectId: projectIds[index], userId,
      url: spec(index).targetUrl, executionSpec: spec(index), status: 'COMPLETED', completedAt })) })
    await prisma.auditVerificationReceipt.createMany({ data: auditIds.map(auditId => ({ auditId, targetKey: FLAG_COMPARISON_TARGET,
      source: 'SYSTEM', status: 'COMPLETED' })) })
    await prisma.runRequest.createMany({ data: projectIds.map((projectId, index) => ({ id: 'request-' + projectId, projectId,
      requestedByUserId: userId, source: 'WEB', idempotencyKey: randomUUID(), leaseUntil: new Date(0),
      requestedAt: new Date(old.getTime() + index), updatedAt: old, executionSpec: spec(index), auditId: auditIds[index] ?? null })) })
    const originals = await prisma.audit.findMany({ where: { id: { in: auditIds } }, orderBy: { id: 'asc' } })
    const blocked = new Set(auditIds.slice(0, 100))
    const reconcile = vi.fn(async (auditId: string) => {
      if (blocked.has(auditId)) throw new Error('Controlled result projection interruption')
      return reconcileOutcomeRunsForAudit(auditId)
    })
    const { logger } = await import('@/lib/logger')
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const selection = vi.spyOn(prisma, '$queryRaw')
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(0)
    expect(await prisma.runRequest.count({ where: { projectId: { in: projectIds }, status: 'QUEUED' } })).toBe(102)
    selection.mockClear()
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(2)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: 'request-' + projectIds[100] } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: 'request-' + projectIds[101] } })).toMatchObject({ status: 'FAILED', errorCode: 'RUN_ABANDONED' })
    // A pass remains bounded even while failed results stay pending. No
    // completed observations are discarded to make the queue look recovered.
    const cohort = await selection.mock.results[0].value as Array<{ projectId: string }>
    expect(cohort).toHaveLength(100)
    expect(await prisma.runRequest.count({ where: { projectId: { in: projectIds.slice(0, 100) }, status: 'QUEUED' } })).toBe(100)
    blocked.clear()
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(100)
    expect(await prisma.runRequest.count({ where: { projectId: { in: projectIds }, status: 'COMPLETED' } })).toBe(101)
    expect(await prisma.audit.findMany({ where: { id: { in: auditIds } }, orderBy: { id: 'asc' } })).toEqual(originals)
  })

  it('skips a full cohort of locked requests before the limit and recovers the later Site', async () => {
    const projectIds = Array.from({ length: 101 }, () => randomUUID())
    const old = new Date(Date.now() - 3600_000)
    await prisma.project.createMany({ data: projectIds.map((id, index) => ({ id, userId, name: 'Busy Site ' + index,
      canonicalHost: 'locked-' + index + '.example.test', url: 'https://locked-' + index + '.example.test/' })) })
    const requestIds = projectIds.map(projectId => 'request-' + projectId)
    await prisma.runRequest.createMany({ data: projectIds.map((projectId, index) => ({ id: requestIds[index], projectId,
      source: 'WATCH' as const, idempotencyKey: randomUUID(), updatedAt: old, requestedAt: new Date(old.getTime() + index),
      leaseUntil: new Date(0) })) })
    let ready!: () => void, release!: () => void
    const locked = new Promise<void>(resolve => { ready = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    const blocker = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM run_requests WHERE id = ANY(${requestIds.slice(0, 100)}::text[]) FOR UPDATE`
      ready()
      await held
    })
    await Promise.race([locked, blocker])
    const sweep = recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)
    try {
      await vi.waitFor(async () => expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: requestIds[100] } }))
        .toMatchObject({ status: 'FAILED', errorCode: 'RUN_ABANDONED' }))
      expect(await sweep).toBe(1)
      expect(await prisma.runRequest.count({ where: { id: { in: requestIds.slice(0, 100) }, status: 'QUEUED', updatedAt: old } })).toBe(100)
    } finally { release(); await Promise.allSettled([blocker, sweep]) }
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(100)
  })

  it('reconciles an independent Site while an earlier result projection is stalled', async () => {
    const old = new Date(Date.now() - 60_000)
    async function completed(name: string, requestedAt: Date) {
      const site = await prisma.project.create({ data: { userId, name, canonicalHost: name + '.example.test', url: 'https://' + name + '.example.test/' } })
      const audit = await prisma.audit.create({ data: { userId, projectId: site.id, status: 'COMPLETED', completedAt: old, url: site.url } })
      auditIds.push(audit.id)
      return prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WATCH', requestedAt, updatedAt: old,
        idempotencyKey: randomUUID(), leaseUntil: new Date(0) } })
    }
    const slow = await completed('slow', old)
    const peer = await completed('peer', new Date(old.getTime() + 1))
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const reconcile = vi.fn(async (auditId: string) => {
      if (auditId === slow.auditId) await held
      return reconcileOutcomeRunsForAudit(auditId)
    })
    const sweep = recoverExpiredSiteRuns(reconcile)
    try {
      await vi.waitFor(async () => expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: peer.id } }))
        .toMatchObject({ status: 'COMPLETED' }))
      expect(reconcile).toHaveBeenCalledWith(slow.auditId, undefined)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: slow.id } })).toMatchObject({ status: 'QUEUED' })
    } finally { release(); await sweep }
    expect(await sweep).toBe(2)
  })

  it.each(['COMPLETED', 'FAILED'] as const)('recovers a released %s Audit while its request lease is still live', async status => {
    const site = await prisma.project.create({ data: { userId, name: 'Terminal recovery', canonicalHost: 'example.test', url: 'https://example.test/' } })
    const until = new Date(Date.now() + 60_000)
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url,
      status, completedAt: new Date(), executionLeaseUntil: until } })
    auditIds.push(audit.id)
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WATCH',
      idempotencyKey: randomUUID(), leaseUntil: until } })
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
    await prisma.audit.update({ where: { id: audit.id }, data: { executionLeaseUntil: new Date(0) } })
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status, leaseUntil: null })
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

  it.each(['renewal', 'settlement', 'activity'] as const)('does not touch or reclaim a selected request after concurrent %s', async kind => {
    const site = await prisma.project.create({ data: { userId, name: 'Recovery selection fence', canonicalHost: 'example.com', url: 'https://example.com/' } })
    const request = await prisma.runRequest.create({ data: { projectId: site.id, source: 'WEB', idempotencyKey: randomUUID(), leaseUntil: new Date(0) } })
    let changed: typeof request | undefined
    const handoff = prisma.$extends({ query: { runRequest: {
      async findMany({ args, query }) {
        const candidates = await query(args)
        changed = await prisma.runRequest.update({ where: { id: request.id }, data: {
          updatedAt: new Date(Date.now() + 1000),
          ...(kind === 'renewal' ? { leaseUntil: new Date(Date.now() + 90_000) } : {}),
          ...(kind === 'settlement' ? { status: 'FAILED', completedAt: new Date(), errorCode: 'CONTROLLED_CANCELLATION' } : {}),
        } })
        return candidates
      },
    } } })
    vi.spyOn(prisma.runRequest, 'findMany').mockImplementationOnce(args => handoff.runRequest.findMany(args))
    const reconcile = vi.fn(reconcileOutcomeRunsForAudit)
    expect(await recoverExpiredSiteRuns(reconcile)).toBe(0)
    expect(changed).toBeDefined()
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(changed)
    expect(reconcile).not.toHaveBeenCalled()
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
