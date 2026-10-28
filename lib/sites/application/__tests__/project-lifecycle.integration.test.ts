import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { productTransaction } from '@/lib/billing/product-transaction'
import { ensureDefaultMonitoring, initializeDefaultMonitoring } from '../default-monitoring'
import { removeSite } from '../settings-commands'
import { scheduleUptimeProbes } from '@/lib/uptime/service'
import { fixedClock } from '@/lib/time/clock'
import { executionWrite, withExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import { DELETE, PATCH } from '@/app/api/projects/[id]/route'
import { GET, POST } from '@/app/api/projects/route'

const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: session.userId } }) } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => {}, recordRateLimit: async () => {},
  requestClientId: () => 'controlled-lifecycle-fixture', RateLimitError: class extends Error {} }))

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('legacy Project API uses the Site lifecycle with migrated PostgreSQL', () => {
  let owner: string, foreign: string, projectId: string
  const now = new Date()
  const url = 'https://lifecycle.example.test'
  const context = () => ({ params: Promise.resolve({ id: projectId }) })
  const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/projects/' + projectId,
    { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) })
  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Project lifecycle fixtures require a disposable local execution database')
  })
  beforeEach(async () => {
    owner = 'project-lifecycle-' + randomUUID(); foreign = owner + '-foreign'; session.userId = owner
    await prisma.user.createMany({ data: [owner, foreign].map(id => ({ id, email: id + '@example.test' })) })
    const site = await prisma.project.create({ data: { userId: owner, canonicalHost: 'lifecycle.example.test', url, name: 'Lifecycle fixture', isManaged: true } })
    projectId = site.id
    await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, owner, now))
  })
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.deleteMany({ where: { id: { in: [owner, foreign] } } }) })
  afterAll(async () => { await prisma.$disconnect() })

  it('does not restart deleted monitoring during automatic setup or expose the removed Site in the Project list', async () => {
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId } })
    expect((await DELETE(request('DELETE'), context())).status).toBe(200)
    await initializeDefaultMonitoring(20, fixedClock(now))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: expect.any(Date), watchInterval: null, watchNextRunAt: null })
    await scheduleUptimeProbes(fixedClock(now), 20, projectId)
    expect(await prisma.uptimeMonitor.count({ where: { projectId } })).toBe(0)
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ confirmedAt: outcome.confirmedAt })
    expect((await (await GET()).json()).map((project: { id: string }) => project.id)).not.toContain(projectId)
    const replacement = await POST(request('POST', { name: 'Replacement Site', url: 'https://replacement.example.test' }))
    expect(replacement.status).toBe(201)
    expect(await replacement.json()).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(String) })
    expect(await prisma.project.count({ where: { userId: owner, deletedAt: null } })).toBe(1)
    expect((await POST(request('POST', { name: 'Restore beyond allowance', url }))).status).toBe(409)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: expect.any(Date) })
  })

  it('requires the current account acknowledgement and then fences pending work while retaining historical facts', async () => {
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId } })
    const historical = await prisma.audit.create({ data: { projectId, userId: owner, url, status: 'COMPLETED', completedAt: now, verdict: 'Recorded historical evidence' } })
    const pending = await prisma.audit.create({ data: { projectId, userId: owner, url, status: 'CHECKING', executionToken: 'fixture-execution',
      executionGeneration: 1, executionLeaseUntil: new Date(now.getTime() + 60_000) } })
    const task = await prisma.auditExecutionTask.create({ data: { auditId: pending.id, targetKey: 'task:http', scopeKey: 'fixture', source: 'http', status: 'RUNNING',
      workKind: 'http', workState: 'RUNNING', workToken: 'fixture-task', workGeneration: 1, workLeaseUntil: new Date(now.getTime() + 60_000), workInput: {} } })
    const run = await prisma.runRequest.create({ data: { projectId, source: 'WEB', idempotencyKey: randomUUID(), auditId: pending.id,
      requestedByUserId: owner, status: 'RUNNING', leaseUntil: new Date(now.getTime() + 60_000), selections: { create: { outcomeId: outcome.id } } } })
    // This record proves acknowledgement semantics, never actual external account deletion.
    const account = await prisma.siteTestAccount.create({ data: { projectId, origin: url, purpose: 'retained', email: owner + '-account@example.test',
      encryptedPassword: 'controlled-fixture-ciphertext', signupUrl: url + '/signup', flowFingerprint: 'fixture', state: 'ACTIVE' } })
    expect((await DELETE(request('DELETE'), context())).status).toBe(409)
    expect((await DELETE(request('DELETE', { acknowledgeRemainingAccounts: true, remainingAccounts: [{ email: account.email, state: 'RESERVED' }] }), context())).status).toBe(409)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'RUNNING' })
    const removed = await DELETE(request('DELETE', { acknowledgeRemainingAccounts: true, remainingAccounts: [{ email: account.email, state: account.state }] }), context())
    expect(removed.status).toBe(200)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: expect.any(Date), accountChecksEnabled: false })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'FAILED', errorCode: 'SITE_REMOVED', leaseUntil: null })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ status: 'FAILED', executionToken: null, executionGeneration: 2 })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'BLOCKED', workToken: null, workGeneration: 2 })
    await expect(withExecutionOwnership({ auditId: pending.id, taskId: task.id, token: 'fixture-task', generation: 1 },
      () => executionWrite(tx => tx.audit.update({ where: { id: pending.id }, data: { verdict: 'Unauthorized late publication' } }))))
      .rejects.toBeInstanceOf(ExecutionOwnershipLost)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: historical.id } })).toMatchObject({ status: 'COMPLETED', verdict: historical.verdict })
    expect(await prisma.siteTestAccount.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ state: 'ACTIVE', deletionVerifiedAt: null })
  })

  it.each(['PATCH', 'DELETE'] as const)('refuses a stale %s after a real concurrent owner transfer', async method => {
    let locked!: () => void, release!: () => void
    const holding = new Promise<void>(resolve => { locked = resolve }), continueTransfer = new Promise<void>(resolve => { release = resolve })
    const transfer = prisma.$transaction(async tx => {
      await tx.project.update({ where: { id: projectId }, data: { userId: foreign } })
      locked(); await continueTransfer
    }, { timeout: 10_000 })
    await holding
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const response = method === 'PATCH' ? PATCH(request('PATCH', { name: 'Unauthorized rename' }), context()) : DELETE(request('DELETE'), context())
    try {
      await vi.waitFor(async () => {
        const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`
        expect(Number(rows[0].count)).toBeGreaterThan(0)
      }, { timeout: 5000, interval: 10 })
    } finally { release(); await transfer }
    expect((await response).status).toBe(404)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ userId: foreign, name: before.name,
      deletedAt: null, watchInterval: before.watchInterval, watchNextRunAt: before.watchNextRunAt })
  })

  it('restores the same removed Site with automatic monitoring without erasing its previous monitoring time', async () => {
    const lastRunAt = new Date(now.getTime() - 86_400_000)
    await prisma.project.update({ where: { id: projectId }, data: { watchLastRunAt: lastRunAt, watchPausedAt: now } })
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId } })
    await removeSite({ projectId, userId: owner })
    const response = await POST(request('POST', { name: 'Restored fixture', url }))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ id: projectId, watchInterval: 'WEEKLY', watchNextRunAt: expect.any(String) })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: null,
      watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date), watchLastRunAt: lastRunAt, watchPausedAt: null })
    expect(await prisma.siteOutcome.findFirstOrThrow({ where: { projectId } })).toMatchObject({ id: outcome.id, confirmedAt: outcome.confirmedAt })
  })

  it('preserves the configured protocol and port when editing the same Site origin', async () => {
    const response = await PATCH(request('PATCH', { url: 'http://lifecycle.example.test:8080/pricing' }), context())
    expect(response.status).toBe(200)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ url: 'http://lifecycle.example.test:8080', canonicalHost: 'lifecycle.example.test' })
  })


  it('keeps an active Site paused when it is added again without a removal transition', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null,
      watchLastRunAt: now, watchLastError: 'Paused. This Site is not on a check schedule.' } })
    expect((await POST(request('POST', { name: 'Same paused Site', url }))).status).toBe(201)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: null,
      watchInterval: null, watchNextRunAt: null, watchLastRunAt: now, watchLastError: 'Paused. This Site is not on a check schedule.' })
  })

})
