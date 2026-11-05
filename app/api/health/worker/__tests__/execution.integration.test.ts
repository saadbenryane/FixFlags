import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { GET } from '../route'

// Controlled infrastructure isolates the actual diagnostic's database decision.
// These are not observations from a deployed worker or queue.
vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: async () => ({
  alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 0, configuredConcurrency: 2,
}), readStalledJobCount: async () => 0 }))
vi.mock('@/lib/queue/estimate', () => ({ getWorkerExecutionCounts: async () => ({ activeJobs: 0, waitingJobs: 0, delayedJobs: 0 }) }))
vi.mock('@/lib/security/rate-limit', () => ({ getRateLimitRedisHealth: () => ({ redisDown: false }) }))

const local = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
local('worker diagnostic execution deadlines with migrated PostgreSQL', () => {
  let userId: string, projectId: string, now: Date
  let baseline: { ok: boolean; status: string; overdueAuditCount: number;
    oldestAudit: { status: string; ageSeconds: number; startedAt: string | null } | null }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    now = new Date()
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
    userId = 'execution-health-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Execution deadline fixture', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    projectId = project.id
    await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: project.url, state: 'online', lastCheckedAt: now,
      nextProbeAt: new Date(now.getTime() + 300_000) } })
    // Other serialized fixtures may retain orphaned execution history. Keep
    // those real global facts, and measure this fixture's added obligation.
    const snapshot = await (await GET()).json()
    baseline = { ok: snapshot.ok, status: snapshot.status,
      overdueAuditCount: snapshot.overdueAuditCount, oldestAudit: snapshot.oldestAudit }
    expect(typeof baseline.overdueAuditCount).toBe('number')
  })
  afterEach(async () => {
    vi.useRealTimers()
    await prisma.audit.deleteMany({ where: { projectId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it.each([
    { name: 'never-started progressive work past its stored deadline', progressive: true, age: 120, started: null, recovery: -1, count: 1 },
    { name: 'recently started progressive work past its stored deadline', progressive: true, age: 120, started: 1, recovery: -1, count: 1 },
    { name: 'progressive work within its actual recovery window', progressive: true, age: 20, started: 20, recovery: 40, count: 0 },
    { name: 'progressive fallback expiry before execution starts', progressive: true, age: 120, started: null, recovery: null, count: 1 },
    { name: 'progressive fallback grace', progressive: true, age: 10, started: null, recovery: null, count: 0 },
    { name: 'a retained explicit progressive deadline', progressive: true, age: 120, started: 20, recovery: 5, count: 0 },
    { name: 'never-started legacy work', progressive: false, age: 10, started: null, recovery: null, count: 1 },
    { name: 'legacy work past its execution deadline', progressive: false, age: 11, started: 10, recovery: null, count: 1 },
    { name: 'legacy queue grace', progressive: false, age: 1, started: null, recovery: null, count: 0 },
    { name: 'deeper legacy execution within its permitted budget', progressive: false, age: 7, started: 6, recovery: null, depth: 3, count: 0 },
    { name: 'deeper legacy queue expiry', progressive: false, age: 9, started: null, recovery: null, depth: 2, count: 1 },
  ])('accounts for $name', async ({ progressive, age, started, recovery, count, depth }) => {
    const audit = await prisma.audit.create({ data: { userId, projectId, url: 'https://example.com/',
      status: started === null ? 'QUEUED' : 'CHECKING', reviewDepth: depth ?? 1, createdAt: new Date(now.getTime() - age * 60_000),
      startedAt: started === null ? null : new Date(now.getTime() - started * 60_000),
      recoveryUntil: recovery === null ? null : new Date(now.getTime() + recovery * 60_000),
      executionSpec: progressive ? { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } : Prisma.DbNull } })
    const response = await GET()
    expect(response.status).toBe(200)
    const overdueAuditCount = baseline.overdueAuditCount + count
    const oldestAudit = baseline.oldestAudit && baseline.oldestAudit.ageSeconds >= age * 60
      ? baseline.oldestAudit : { status: audit.status, ageSeconds: age * 60 }
    expect(await response.json()).toMatchObject({ ok: baseline.ok && count === 0,
      status: overdueAuditCount ? 'audit_overdue' : baseline.status, overdueAuditCount, oldestAudit })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
  })

  it.each(['COMPLETED', 'FAILED'] as const)('keeps terminal %s execution outside the overdue cohort without rewriting history', async status => {
    const audit = await prisma.audit.create({ data: { userId, projectId, url: 'https://example.com/', status,
      createdAt: new Date(now.getTime() - 7200_000), recoveryUntil: new Date(now.getTime() - 3600_000) } })
    expect(await (await GET()).json()).toMatchObject(baseline)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
  })

  it('bounds a contended ledger read and exposes unavailable evidence without a false healthy result', async () => {
    let unlock!: () => void, held!: () => void
    const released = new Promise<void>(resolve => { unlock = resolve })
    const locked = new Promise<void>(resolve => { held = resolve })
    const writer = prisma.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE audits IN ACCESS EXCLUSIVE MODE`
      held()
      await released
    }, { timeout: 5000 })
    await locked
    try {
      const response = await GET()
      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toMatchObject({ ok: false, status: 'audit_unavailable', overdueAuditCount: null, oldestAudit: null })
      expect(JSON.stringify(result)).not.toContain('statement_timeout')
    } finally { unlock(); await writer }
  })
})
