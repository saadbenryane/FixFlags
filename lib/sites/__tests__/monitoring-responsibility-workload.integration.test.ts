import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { monitoringResponsibility, monitoringBehaviorResponsibility } from '../application/monitoring-responsibility'

type Plan = {
  Plans?: Plan[]; 'Relation Name'?: string; 'Node Type'?: string; 'Index Name'?: string;
  'Actual Rows'?: number; 'Actual Loops'?: number; 'Rows Removed by Filter'?: number; 'Rows Removed by Index Recheck'?: number;
}
function nodes(plan: Plan): Plan[] { return [plan, ...(plan.Plans ?? []).flatMap(nodes)] }
const localDatabase = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('monitoring responsibility with populated task history', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('reads page and behavior obligation lanes without scanning unrelated historical execution work', async () => {
    const userId = 'scope-workload-' + randomUUID(), root = 'https://example.com/', retained = root + 'retained/'
    const longUrl = retained + '?fixture=' + randomBytes(4096).toString('hex')
    const sourceCount = 200, taskCount = 120, sourceIds = Array.from({ length: sourceCount }, (_, index) => userId + '-' + index)
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId, name: 'Recorded history', url: root, canonicalHost: 'example.com' } })
      await prisma.audit.createMany({ data: sourceIds.map(id => ({ id, userId, projectId: project.id, url: root,
        status: 'COMPLETED' as const, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: root,
          environment: 'production', monitoringPages: [root], checks: {}, outcomes: [], verificationTarget: null } })) })
      // Synthetic completed ledger rows model the query workload. They are not
      // observations or proof of twenty-four thousand actual check executions.
      for (const auditId of sourceIds) await prisma.auditExecutionTask.createMany({ data: Array.from({ length: taskCount }, (_, position) => ({
        auditId, targetKey: 'task:p' + position, source: 'EXECUTION', workKind: position < 2 ? 'browser' : position < 4 ? 'flow' : position === 4 ? 'slow-replay' : position === 5 ? 'journeys' : 'check',
        workInput: position === 3 ? { module: 'pricing-navigation' } : {},
        pageUrl: position >= 1 && position <= 5 ? retained : root, workState: 'COMPLETED', status: 'COMPLETED' as const,
      })) })
      // The access path must not put an unbounded URL in a B-tree tuple and
      // introduce a new write failure for a previously accepted navigation.
      await prisma.auditExecutionTask.create({ data: { auditId: sourceIds[0], targetKey: 'task:long-url', source: 'EXECUTION',
        workKind: 'browser', pageUrl: longUrl, workState: 'EXHAUSTED', status: 'FAILED' } })
      // Rebuild the actual migration over populated history, with a writer
      // held open. Another write must commit while the build waits for it.
      await prisma.$executeRaw`DROP INDEX "audit_verifier_admitted_scope_idx"`
      const migration = readFileSync(new URL('../../../prisma/migrations/20261021110000_admitted_scope_index/migration.sql', import.meta.url), 'utf8')
      let releaseWriter!: () => void, writerHeld!: () => void
      const release = new Promise<void>(resolve => { releaseWriter = resolve })
      const held = new Promise<void>(resolve => { writerHeld = resolve })
      const writer = prisma.$transaction(async tx => {
        await tx.auditExecutionTask.updateMany({ where: { auditId: sourceIds[0], targetKey: 'task:p2' }, data: { workRetryAt: new Date(0) } })
        writerHeld()
        await release
      }, { timeout: 10_000 })
      await held
      const building = prisma.$executeRawUnsafe(migration).then(() => ({ ok: true as const }), error => ({ ok: false as const, error }))
      try {
        await vi.waitFor(async () => {
          const progress = await prisma.$queryRaw<Array<{ phase: string }>>`
            SELECT phase FROM pg_stat_progress_create_index
            WHERE datname = current_database() AND relid = 'audit_verifier_executions'::regclass`
          expect(progress.some(row => row.phase.includes('waiting for writers'))).toBe(true)
        }, { timeout: 2000, interval: 25 })
        await prisma.$transaction(async tx => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`
          expect(await tx.auditExecutionTask.updateMany({ where: { auditId: sourceIds[0], targetKey: 'task:p3' },
            data: { workRetryAt: new Date(1) } })).toMatchObject({ count: 1 })
        }, { timeout: 2000 })
      } finally {
        releaseWriter()
        await writer
        const result = await building
        if (!result.ok) throw result.error
      }
      await prisma.$executeRaw`ANALYZE "audits"`
      await prisma.$executeRaw`ANALYZE "audit_verifier_executions"`
      const read = vi.fn(prisma.$queryRaw.bind(prisma))
      expect(await monitoringResponsibility({ projectId: project.id, environment: 'production', targetUrl: root, recorded: [] },
        { $queryRaw: <T>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => read(query, ...values) as Promise<T> }))
        .toEqual([root, retained, longUrl])
      expect(read).toHaveBeenCalledTimes(1)
      const [strings, ...parameters] = read.mock.calls[0]
      if (!Array.isArray(strings)) throw new Error('Expected the installed tagged ledger query')
      const query = Prisma.sql(strings as unknown as TemplateStringsArray, ...parameters)
      const [result] = await prisma.$queryRaw<Array<{ 'QUERY PLAN': Array<{ Plan: Plan; 'Execution Time': number }> }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      const report = result['QUERY PLAN'][0], scans = nodes(report.Plan).filter(plan => plan['Relation Name'] === 'audit_verifier_executions')
      // EXPLAIN rounds per-loop averages. This workload guard estimates tuple
      // visits; it is not an exact tuple counter or a latency guarantee.
      const examined = scans.reduce((count, plan) => count + ((plan['Actual Rows'] ?? 0) + (plan['Rows Removed by Filter'] ?? 0) +
        (plan['Rows Removed by Index Recheck'] ?? 0)) * (plan['Actual Loops'] ?? 1), 0)
      process.stdout.write(JSON.stringify({ sourceRuns: sourceCount, syntheticTaskRows: sourceCount * taskCount + 1, browserObligations: sourceCount * 2 + 1,
        roundedTaskRowVisits: examined, databaseExecutionMs: report['Execution Time'], independentWriteDuringBuild: true,
        scanTypes: scans.map(plan => plan['Node Type']),
        indexes: scans.map(plan => plan['Index Name'] ?? null) }) + '\n')
      expect(scans.length).toBeGreaterThan(0)
      expect(examined).toBeLessThanOrEqual((sourceCount * 2 + 1) * 2)
      const behaviorRead = vi.fn(prisma.$queryRaw.bind(prisma))
      expect(await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages: [root, retained, longUrl] },
        { $queryRaw: <T>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => behaviorRead(query, ...values) as Promise<T> }))
        .toEqual([root, retained].map(pageUrl => ({ pageUrl, behaviors: ['flow', 'pricing-navigation', 'slow-replay', 'journeys'] })))
      expect(behaviorRead).toHaveBeenCalledTimes(1)
      const [behaviorStrings, ...behaviorParameters] = behaviorRead.mock.calls[0]
      if (!Array.isArray(behaviorStrings)) throw new Error('Expected the installed tagged behavior query')
      const behaviorQuery = Prisma.sql(behaviorStrings as unknown as TemplateStringsArray, ...behaviorParameters)
      const [behaviorResult] = await prisma.$queryRaw<Array<{ 'QUERY PLAN': Array<{ Plan: Plan; 'Execution Time': number }> }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${behaviorQuery}`
      const behaviorReport = behaviorResult['QUERY PLAN'][0]
      const behaviorScans = nodes(behaviorReport.Plan).filter(plan => plan['Relation Name'] === 'audit_verifier_executions')
      const behaviorExamined = behaviorScans.reduce((count, plan) => count + ((plan['Actual Rows'] ?? 0) + (plan['Rows Removed by Filter'] ?? 0) +
        (plan['Rows Removed by Index Recheck'] ?? 0)) * (plan['Actual Loops'] ?? 1), 0)
      const behaviorIndexes = nodes(behaviorReport.Plan).flatMap(plan => plan['Index Name'] ? [plan['Index Name']] : [])
      expect(behaviorIndexes).toContain('audit_verifier_admitted_scope_idx')
      process.stdout.write(JSON.stringify({ behaviorObligations: sourceCount * 4, roundedTaskRowVisits: behaviorExamined,
        databaseExecutionMs: behaviorReport['Execution Time'], indexes: behaviorIndexes }) + '\n')
      expect(behaviorScans.length).toBeGreaterThan(0)
      expect(behaviorExamined).toBeLessThanOrEqual(sourceCount * 4 * 2)
      expect(await prisma.auditVerifierExecution.count({ where: { audit: { projectId: project.id } } })).toBe(sourceCount * taskCount + 1)
    } finally {
      await prisma.audit.deleteMany({ where: { id: { in: sourceIds } } })
      await prisma.user.delete({ where: { id: userId } })
    }
  }, 60_000)
})
