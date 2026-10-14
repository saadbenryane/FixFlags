import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ db: null as unknown as PrismaClient }))
vi.mock('@/lib/db', () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  const value = fixture.db[key as keyof PrismaClient]
  return typeof value === 'function' ? value.bind(fixture.db) : value
} }) }))
import { loadCustomerValueReport } from '../improvement-value-query'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('customer value reporting on isolated local PostgreSQL', () => {
  it('resolves event-time costs, deduplicates monitoring runs and withholds incomplete estimates', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: databaseUrl })
    const schema = `value_report_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString() })
    const base = Date.now() - 12 * 86_400_000
    const at = (day: number) => new Date(base + day * 86_400_000)
    fixture.db = db
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."AuditStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".projects (id text PRIMARY KEY, "createdAt" timestamp(3), "deletedAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audits (id text PRIMARY KEY, "projectId" text, "parentId" text, "createdAt" timestamp(3), "completedAt" timestamp(3), status "${schema}"."AuditStatus")`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audit_run_costs ("auditId" text PRIMARY KEY, "estimatedCostUsd" decimal(10,6), "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".flags (id text PRIMARY KEY, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_occurrences (id text PRIMARY KEY, "flagId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycles (id text PRIMARY KEY, "projectId" text, "sourceAuditId" text, "occurrenceId" text, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycle_events (id text PRIMARY KEY, "cycleId" text, type text, "occurredAt" timestamp(3), outcome text, "rejectionReason" text, "verificationAuditId" text)`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".projects VALUES ('synthetic-project', $1, NULL)`, at(0))
      for (const [id, parent, date, cost] of [
        ['source', null, at(1), 1], ['original', 'source', at(3), 2], ['retry', 'source', at(6), 3],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ($1, 'synthetic-project', $2, $3::timestamp, $3::timestamp, 'COMPLETED')`, id, parent, date)
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audit_run_costs VALUES ($1, $2, $3::timestamp)`, id, cost, date)
      }
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags VALUES ('synthetic-flag', $1)`, at(1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_occurrences VALUES ('occurrence', 'synthetic-flag')`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_cycles VALUES ('synthetic-cycle', 'synthetic-project', 'source', 'occurrence', $1)`, at(1))
      for (const [id, type, date, outcome, auditId] of [
        ['generated', 'GENERATED', at(1), null, null],
        ['original-outcome', 'OUTCOME_ISSUED', at(3), 'INCONCLUSIVE', 'original'],
        ['retry-outcome', 'OUTCOME_ISSUED', at(6), 'IMPROVED', 'retry'],
        ['improved', 'IMPROVED', at(6), 'IMPROVED', 'retry'],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_cycle_events VALUES ($1, 'synthetic-cycle', $2, $3::timestamp, $4, NULL, $5)`, id, type, date, outcome, auditId)
      }
      const input = { since: at(0), now: at(12) }
      const report = await loadCustomerValueReport(input)
      expect(report.metrics).toMatchObject({ cohortSize: 1, activeProductCount: 1, improved: 1,
        outcomes: { IMPROVED: 1, INCONCLUSIVE: 0 },
        estimatedLinkedCheckCostPerImprovedCycleUsd: 6, estimatedVerificationCostPerOutcomeCycleUsd: 5,
        reviewCostCoverage: { runCount: 3, measuredRunCount: 3, missingRunCount: 0 },
      })
      expect(JSON.stringify(report)).not.toContain('synthetic-')
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', '30'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).metrics.estimatedLinkedCheckCostPerImprovedCycleUsd).toBe(6)
      expect(command.stdout).not.toContain('synthetic-')
      await admin.$executeRawUnsafe(`DELETE FROM "${schema}".audit_run_costs WHERE "auditId" = 'original'`)
      const incomplete = await loadCustomerValueReport(input)
      expect(incomplete.metrics.reviewCostCoverage).toMatchObject({ runCount: 3, missingRunCount: 1 })
      expect(incomplete.metrics.estimatedLinkedCheckCostPerImprovedCycleUsd).toBeNull()
      expect(incomplete.metrics.estimatedVerificationCostPerOutcomeCycleUsd).toBeNull()
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
