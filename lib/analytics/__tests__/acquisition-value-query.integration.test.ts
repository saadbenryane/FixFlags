import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ db: null as unknown as PrismaClient }))
vi.mock('@/lib/db', () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  const value = fixture.db[key as keyof PrismaClient]
  return typeof value === 'function' ? value.bind(fixture.db) : value
} }) }))
import { loadAcquisitionValueCohort } from '../acquisition-value-query'
import { recordSiteLifecycleEvent } from '../site-events'
import { loadSiteValueCohort } from '../site-value-query'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('exact-source value cohort on isolated local PostgreSQL', () => {
  it('joins the real retained tables and exports aggregates through the inspector command', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: databaseUrl })
    const schema = `acquisition_value_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    fixture.db = db
    const base = Date.now() - 12 * 86_400_000
    const at = (day: number) => new Date(base + day * 86_400_000)
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".projects (id text PRIMARY KEY, "userId" text, "createdAt" timestamp(3), "deletedAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audits (id text PRIMARY KEY, "userId" text, "projectId" text, "parentId" text, source text, status text, "createdAt" timestamp(3), "startedAt" timestamp(3), "completedAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".site_lifecycle_events (id text PRIMARY KEY, name text, version int, "userId" text, "projectId" text, "idempotencyKey" text UNIQUE, properties jsonb, "createdAt" timestamp(3) DEFAULT NOW())`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".flags (id text PRIMARY KEY, "auditId" text, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvements (id text PRIMARY KEY, "projectId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_occurrences (id text PRIMARY KEY, "improvementId" text, "auditId" text, "flagId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycles (id text PRIMARY KEY, "projectId" text, "sourceAuditId" text, "improvementId" text, "occurrenceId" text, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_attempts (id text PRIMARY KEY, "sourceAuditId" text, "improvementId" text, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycle_events (id text PRIMARY KEY, "cycleId" text, type text, transport text, "occurredAt" timestamp(3), outcome text, "attemptId" text, "verificationAuditId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".run_requests (id text PRIMARY KEY, "projectId" text, "requestedByUserId" text, source text, status text, environment text, "requestedAt" timestamp(3), "completedAt" timestamp(3), "auditId" text)`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".projects VALUES ('synthetic-site', 'synthetic-owner', $1, NULL)`, at(1))
      for (const [id, parent, source, created, completed] of [
        ['synthetic-source', null, 'ISSUE_PAGE', 0, 0.1], ['synthetic-after', 'synthetic-source', 'DASHBOARD', 3, 3.1],
        ['synthetic-later-source', 'synthetic-source', 'DASHBOARD', 4, 4.1],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ($1, 'synthetic-owner', 'synthetic-site', $2, $3, 'COMPLETED', $4, $4, $5)`, id, parent, source, at(created), at(completed))
      }
      for (const [id, name, user, key, properties, date] of [
        ['start', 'analyze_started', null, 'analyze_started:synthetic-source', { anonymous: true, journeyId: 'synthetic-private-journey' }, 0],
        ['result', 'first_useful_result', null, 'first_useful_result:synthetic-source', {}, 0.2],
        ['claim', 'analysis_claimed', 'synthetic-owner', 'analysis_claimed:synthetic-source', {}, 1],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".site_lifecycle_events VALUES ($1, $2, 1, $3, 'synthetic-site', $4, $5::jsonb, $6)`, id, name, user, key, JSON.stringify(properties), at(date))
      }
      const receiptInput = { name: 'analysis_claimed' as const, idempotencyKey: 'analysis_claimed:writer-source',
        userId: 'synthetic-owner', projectId: 'synthetic-site' }
      const first = await recordSiteLifecycleEvent(receiptInput)
      const repeated = await recordSiteLifecycleEvent(receiptInput)
      expect(repeated.id).toBe(first.id)
      expect(repeated.createdAt).toEqual(first.createdAt)
      expect(first.properties).toEqual({})
      expect(first.userId).toBe('synthetic-owner')
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags VALUES ('synthetic-flag', 'synthetic-source', $1)`, at(0.1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvements VALUES ('synthetic-improvement', 'synthetic-site')`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_occurrences VALUES ('synthetic-occurrence', 'synthetic-improvement', 'synthetic-source', 'synthetic-flag')`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_cycles VALUES ('synthetic-cycle', 'synthetic-site', 'synthetic-source', 'synthetic-improvement', 'synthetic-occurrence', $1)`, at(1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_attempts VALUES ('synthetic-attempt', 'synthetic-source', 'synthetic-improvement', $1)`, at(2))
      for (const [id, type, transport, day, outcome, attempt, after] of [
        ['generated', 'GENERATED', 'SYSTEM', 1, null, null, null],
        ['attempt', 'ATTEMPTED', 'WEB', 2, null, 'synthetic-attempt', null],
        ['outcome', 'OUTCOME_ISSUED', 'SYSTEM', 3.2, 'IMPROVED', 'synthetic-attempt', 'synthetic-after'],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".improvement_cycle_events VALUES ($1, 'synthetic-cycle', $2, $3, $4, $5, $6, $7)`, id, type, transport, at(day), outcome, attempt, after)
      }
      const input = { since: at(0), now: at(12) }
      const report = await loadAcquisitionValueCohort(input, db)
      expect(report).toMatchObject({ status: 'available', matureCohort: { starts: 1, usefulResultReceipts: 1,
        claimReceipts: 1, initialIssueCycles: 1, recordedFixAttempts: 1, independentlyImproved: 1 } })
      expect(JSON.stringify(report)).not.toContain('synthetic-')
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', '30', 'acquisition'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0); expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).matureCohort.independentlyImproved).toBe(1)
      expect(command.stdout).not.toContain('synthetic-')
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET transport = 'WEB' WHERE id = 'outcome'`)
      expect((await loadAcquisitionValueCohort(input, db)).matureCohort.independentlyImproved).toBe(0)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET transport = 'SYSTEM' WHERE id = 'outcome'`)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycles SET "sourceAuditId" = 'synthetic-later-source'`)
      expect((await loadAcquisitionValueCohort(input, db)).matureCohort).toMatchObject({ starts: 1, independentlyImproved: 0, initialIssueCycles: 0 })
      // Continue the same incident from the later monitoring source.
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_occurrences SET "auditId" = 'synthetic-later-source'`)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".flags SET "auditId" = 'synthetic-later-source', "createdAt" = $1`,at(4.1))
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycles SET "createdAt" = $1`,at(4.2))
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_attempts SET "sourceAuditId" = 'synthetic-later-source', "createdAt" = $1`,at(4.5))
      await admin.$executeRawUnsafe(`UPDATE "${schema}".audits SET "createdAt" = $1, "startedAt" = $1, "completedAt" = $2 WHERE id = 'synthetic-after'`,at(5),at(5.1))
      for(const [id,day] of [['generated',4.2],['attempt',4.5],['outcome',5.2]] as const) {
        await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET "occurredAt" = $1 WHERE id = $2`,at(day),id)
      }
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ('post-monitor', 'synthetic-owner', 'synthetic-site', 'synthetic-after', 'DASHBOARD', 'COMPLETED', $1, $1, $2)`,at(6),at(6.1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".run_requests VALUES ('watch', 'synthetic-site', 'synthetic-owner', 'WATCH', 'COMPLETED', 'production', $1, $2, 'post-monitor')`,at(6),at(6.2))
      const continuing=await loadSiteValueCohort(input,db)
      expect(continuing).toMatchObject({status:'available',counts:{sites:1,independentlyImproved:1,completedScheduledChecks:1,completedMonitoringAfterImprovement:1}})
      expect(JSON.stringify(continuing)).not.toContain('synthetic-')
      const sitesCommand=spawnSync(process.execPath,['--import','tsx','scripts/growth/inspect-customer-value.ts','30','sites'],{
        env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',timeout:15000})
      expect(sitesCommand.status).toBe(0)
      expect(JSON.parse(sitesCommand.stdout).counts.independentlyImproved).toBe(1)
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
