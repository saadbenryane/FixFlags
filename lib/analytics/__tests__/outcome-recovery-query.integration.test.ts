import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
import { loadOutcomeRecoveryValue } from '../outcome-recovery-query'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('Outcome recovery reporting on isolated PostgreSQL', () => {
  it('joins the original failed Flag and independent recovery to a comparable scheduled observation', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const schema = `outcome_value_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const dayMs = 86_400_000
    const base = Date.now() - 12 * dayMs
    const at = (day: number) => new Date(base + day * dayMs)
    const key = 'private-binding'
    const scope = { startUrl: 'https://private-site.test/', expectedText: 'ready' }
    const save = async (id: string, day: number, state: string, result: string, options: {
      watch?: boolean
      bindingVersion?: number
      wrongOwner?: boolean
      superseded?: boolean
    } = {}) => {
      await db.$executeRaw`INSERT INTO audits VALUES (
        ${id}, 'private-project', ${options.wrongOwner ? 'old-owner' : 'private-owner'}, 'COMPLETED', ${at(day)}, ${at(day + .01)})`
      const requestId = `request-${id}`
      await db.$executeRaw`INSERT INTO run_requests VALUES (
        ${requestId}, ${id}, 'private-project', 'production', 'COMPLETED', ${options.watch ? 'WATCH' : 'WEB'}, ${at(day)}, ${at(day + .02)}, NULL)`
      await db.$executeRaw`INSERT INTO run_request_outcomes VALUES (${requestId}, 'private-outcome')`
      const coverage = { environment: 'production', requiredBindings: [key], observedBindings: [key],
        bindings: [{ key, version: options.bindingVersion ?? 1, mechanism: 'HTTP_AVAILABILITY', config: scope, result }] }
      const evidence = { privateScreenshot: 'private-screenshot', ...(options.superseded ? { supersededByAssessmentId: 'private-newer' } : {}),
        incident: { version: 1, transition: id === 'source' ? 'failure' : id === 'recovery' ? 'recovery' : 'clear',
          incidentRunRequestId: 'request-source', rootFlagIds: ['private-flag'],
          flagIds: id === 'source' ? ['private-flag'] : [], recoveredFlagIds: id === 'recovery' ? ['private-flag'] : [],
          previousAssessmentId: id === 'source' ? null : 'assessment-source' } }
      await db.$executeRaw`INSERT INTO outcome_assessments VALUES (
        ${`assessment-${id}`}, 'private-outcome', ${requestId}, ${id}, ${state}, ${at(day + .01)},
        ${JSON.stringify(coverage)}::jsonb, ${JSON.stringify(evidence)}::jsonb)`
    }
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      for (const definition of [
        'projects (id text PRIMARY KEY, "userId" text, "deletedAt" timestamp(3))',
        'audits (id text PRIMARY KEY, "projectId" text, "userId" text, status text, "startedAt" timestamp(3), "completedAt" timestamp(3))',
        'site_outcomes (id text PRIMARY KEY, "projectId" text, environment text, kind text)',
        'run_requests (id text PRIMARY KEY, "auditId" text, "projectId" text, environment text, status text, source text, "requestedAt" timestamp(3), "completedAt" timestamp(3), "executionSpec" jsonb)',
        'run_request_outcomes ("runRequestId" text, "outcomeId" text)',
        'outcome_assessments (id text PRIMARY KEY, "outcomeId" text, "runRequestId" text, "auditId" text, state text, "assessedAt" timestamp(3), coverage jsonb, evidence jsonb)',
        'flags (id text PRIMARY KEY, "auditId" text, fingerprint text, status text, "resolvedInId" text)',
        'outcome_binding_executions ("auditId" text, "outcomeId" text, disposition text, detail jsonb)',
      ]) await db.$executeRawUnsafe(`CREATE TABLE ${definition}`)
      await db.$executeRaw`INSERT INTO projects VALUES ('private-project', 'private-owner', NULL)`
      await db.$executeRaw`INSERT INTO site_outcomes VALUES ('private-outcome', 'private-project', 'production', 'AVAILABILITY')`
      await db.$executeRaw`INSERT INTO flags VALUES ('private-flag', 'source', 'outcome:v1:private-outcome:private-binding', 'FIXED', 'recovery')`
      await save('source', 0, 'FLAG', 'FAILED')
      await save('recovery', 1, 'CLEAR', 'SUCCEEDED')
      const input = { since: at(.5), now: at(12) }
      const read = () => loadOutcomeRecoveryValue(input, db)
      expect((await read()).counts).toMatchObject({ matureRecoveredFlags: 1, noRetainedScheduledAssessment: 1 })
      await save('wrong-owner', 2, 'CLEAR', 'SUCCEEDED', { watch: true, wrongOwner: true })
      await save('superseded', 2, 'CLEAR', 'SUCCEEDED', { watch: true, superseded: true })
      await save('changed-binding', 3, 'CLEAR', 'SUCCEEDED', { watch: true, bindingVersion: 2 })
      expect(await read()).toMatchObject({
        counts: { firstComparablePass: 0, scheduledAssessmentWithoutComparableResult: 1 },
        coverage: { retainedAssessments: 2 },
      })
      await save('returned-failure', 4, 'FLAG', 'FAILED', { watch: true })
      await save('later-pass', 5, 'CLEAR', 'SUCCEEDED', { watch: true })
      expect((await read()).counts).toMatchObject({ firstComparableFailure: 1, firstComparablePass: 0 })
      await db.$executeRaw`DELETE FROM run_request_outcomes WHERE "runRequestId" = 'request-returned-failure'`
      expect((await read()).counts).toMatchObject({ firstComparableFailure: 0, firstComparablePass: 1 })
      await save('failure-after-pass', 6, 'FLAG', 'FAILED', { watch: true })
      expect((await read()).counts).toMatchObject({
        firstComparablePass: 1, firstComparableFailure: 0, anyComparableFailure: 1, comparableFailureAfterScheduledPass: 1,
      })
      expect((await loadOutcomeRecoveryValue({ ...input, now: at(7) }, db)).coverage.immatureRecoveries).toBe(1)
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', '30', 'outcomes'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).counts).toMatchObject({
        firstComparablePass: 1, anyComparableFailure: 1, comparableFailureAfterScheduledPass: 1,
      })
      for (const value of ['private-project', 'private-outcome', 'private-owner', 'private-binding',
        'private-site.test', 'private-flag', 'private-screenshot', 'assessment-recovery']) {
        expect(command.stdout).not.toContain(value)
      }
      await db.$executeRaw`UPDATE flags SET "resolvedInId" = 'unrelated'`
      expect(await read()).toMatchObject({ counts: { matureRecoveredFlags: 0 }, coverage: { unprovenRecovery: 1 } })
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  })
})
