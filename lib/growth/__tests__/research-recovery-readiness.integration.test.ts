import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
import { researchSiteIdentity } from '../research-consent'
import { RESEARCH_CONSENT_EVENT, RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
import { inspectResearchReadiness } from '../research-readiness'
import { prepareResearchDraft } from '../research-draft'

vi.mock('@/lib/db', () => ({ prisma: {} }))

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('research readiness for native availability recovery', () => {
  it('checks prospective consent for every observation and withholds sub-threshold cells', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const schema = `research_recovery_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const base = Date.now() - 20 * 86_400_000
    const at = (day: number) => new Date(base + day * 86_400_000)
    const run = () => inspectResearchReadiness({ start: at(0), end: at(15), checkedAt: at(20), includeRecoveries: true }, db)
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await db.$executeRawUnsafe(`CREATE TYPE "AuditStatus" AS ENUM ('COMPLETED')`)
      await db.$executeRawUnsafe(`CREATE TYPE "FlagSource" AS ENUM ('DETERMINISTIC')`)
      await db.$executeRawUnsafe(`CREATE TYPE "AccountLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETING')`)
      for (const definition of [
        `users (id text PRIMARY KEY, "lifecycleStatus" "AccountLifecycleStatus" NOT NULL DEFAULT 'ACTIVE', "lifecycleRevision" int NOT NULL DEFAULT 0)`,
        'projects (id text PRIMARY KEY, "userId" text, url text, "deletedAt" timestamp(3), "watchTargetRevision" int NOT NULL DEFAULT 1)',
        'site_lifecycle_events (id text PRIMARY KEY, "projectId" text, "userId" text, name text, version int, properties jsonb, "createdAt" timestamp(3))',
        `audits (id text PRIMARY KEY, "projectId" text, "userId" text, url text, status "AuditStatus", "createdAt" timestamp(3), "startedAt" timestamp(3), "completedAt" timestamp(3),
          "scanAccessEncrypted" text, "executionSpec" jsonb DEFAULT '{"version":1,"environment":"production","scope":"OUTCOMES","scanAccess":{"kind":"public"}}')`,
        'site_outcomes (id text PRIMARY KEY, "projectId" text, environment text, kind text)',
        'run_requests (id text PRIMARY KEY, "auditId" text, "projectId" text, environment text, status text, source text, "requestedAt" timestamp(3), "completedAt" timestamp(3), "executionSpec" jsonb)',
        'run_request_outcomes ("runRequestId" text, "outcomeId" text)',
        'outcome_assessments (id text PRIMARY KEY, "outcomeId" text, "runRequestId" text, "auditId" text, state text, "assessedAt" timestamp(3), coverage jsonb, evidence jsonb)',
        'flags (id text PRIMARY KEY, "auditId" text, "checkId" text, source "FlagSource", confidence double precision, "createdAt" timestamp(3), fingerprint text, status text, "resolvedInId" text)',
        'outcome_binding_executions (id text PRIMARY KEY, "auditId" text, "outcomeId" text, "bindingKey" text, "bindingVersion" int, "executionGeneration" int, mechanism text, disposition text, detail jsonb)',
        'outcome_binding_attempts ("executionId" text, "auditId" text, "outcomeId" text, "bindingKey" text, "bindingVersion" int, "executionGeneration" int, mechanism text, attempt int, disposition text, detail jsonb)',
      ]) await db.$executeRawUnsafe(`CREATE TABLE ${definition}`)
      const address = (i: number) => `https://private-fixture${i}.example/`
      const grant = (i: number, enabled: boolean) => JSON.stringify({
        enabled, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity: researchSiteIdentity(address(i)),
      })
      const save = async (i: number, day: number, label: 'source' | 'recovery' | 'pass' | 'recurrence') => {
        const audit = `${label}-${i}`, request = `request-${audit}`, outcome = `private-outcome-${i}`
        const project = `private-project-${i}`, owner = `private-owner-${i}`, flag = `private-flag-${i}`
        const failed = label === 'source' || label === 'recurrence'
        const scope = { startUrl: address(i) }
        const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
          bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: scope,
            evaluator: DEFAULT_AVAILABILITY_EVALUATOR, result: failed ? 'FAILED' : 'SUCCEEDED' }] }
        const evidence = { incident: {
          version: 1, transition: label === 'source' ? 'failure' : label === 'recovery' ? 'recovery' : 'clear',
          incidentRunRequestId: `request-source-${i}`, rootFlagIds: [flag], previousAssessmentId: null,
          flagIds: label === 'source' ? [flag] : [], recoveredFlagIds: label === 'recovery' ? [flag] : [],
        } }
        await db.$executeRaw`INSERT INTO audits VALUES (${audit}, ${project}, ${owner}, ${address(i)}, 'COMPLETED', ${at(day)}, ${at(day)}, ${at(day + .01)})`
        await db.$executeRaw`INSERT INTO run_requests VALUES (${request}, ${audit}, ${project}, 'production', 'COMPLETED',
          ${label === 'recovery' ? 'WEB' : 'WATCH'}, ${at(day)}, ${at(day + .02)}, NULL)`
        await db.$executeRaw`INSERT INTO run_request_outcomes VALUES (${request}, ${outcome})`
        await db.$executeRaw`INSERT INTO outcome_assessments VALUES (${`assessment-${audit}`}, ${outcome}, ${request}, ${audit},
          ${failed ? 'FLAG' : 'CLEAR'}, ${at(day + .01)}, ${JSON.stringify(coverage)}::jsonb, ${JSON.stringify(evidence)}::jsonb)`
        const execution = `binding-${audit}`
        const disposition = failed ? 'FAILED' : 'SUCCEEDED'
        const last = { url: address(i), finalUrl: address(i), collectedAt: at(day + .009).toISOString(),
          evaluator: DEFAULT_AVAILABILITY_EVALUATOR, ...(failed ? { source: 'public-http' }
            : { source: 'public-http-and-rendered-dom', publicHttpFinalUrl: address(i) }) }
        const detail = { ...last, ...(label === 'source' ? { failureFlagId: flag } : {}) }
        await db.$executeRaw`INSERT INTO outcome_binding_executions VALUES (${execution}, ${audit}, ${outcome}, 'http', 1, 1,
          'HTTP_AVAILABILITY', ${disposition}, ${JSON.stringify(detail)}::jsonb)`
        const attempts = failed ? [{ ...last, collectedAt: at(day + .008).toISOString() }, last] : [last]
        for (const [index, attempt] of attempts.entries()) {
          await db.$executeRaw`INSERT INTO outcome_binding_attempts VALUES (${execution}, ${audit}, ${outcome}, 'http', 1, 1,
            'HTTP_AVAILABILITY', ${index + 1}, ${disposition}, ${JSON.stringify(attempt)}::jsonb)`
        }
        if (label === 'source') await db.$executeRaw`INSERT INTO flags VALUES (${flag}, ${audit}, 'outcome-availability-failed',
          'DETERMINISTIC', 1, ${at(day + .01)}, ${`outcome:v1:${outcome}:http`}, 'FIXED', ${`recovery-${i}`})`
      }
      for (let i = 0; i < 20; i++) {
        await db.$executeRaw`INSERT INTO users (id) VALUES (${`private-owner-${i}`})`
        await db.$executeRaw`INSERT INTO projects VALUES (${`private-project-${i}`}, ${`private-owner-${i}`}, ${address(i)}, NULL)`
        await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES (${`grant-${i}`}, ${`private-project-${i}`}, ${`private-owner-${i}`},
          ${RESEARCH_CONSENT_EVENT}, 1, ${grant(i, true)}::jsonb, ${at(.5)})`
        await db.$executeRaw`INSERT INTO site_outcomes VALUES (${`private-outcome-${i}`}, ${`private-project-${i}`}, 'production', 'AVAILABILITY')`
        await save(i, 1, 'source')
        await save(i, 2, 'recovery')
        await save(i, 3, 'pass')
      }
      await save(0, 4, 'recurrence')
      await save(1, 11, 'recurrence')
      const candidate = { evaluator: DEFAULT_AVAILABILITY_EVALUATOR, recoveredSites: 20,
        matureFollowupMeetsMinimum: true, comparableFollowupMeetsMinimum: true, failureAfterScheduledPassMeetsMinimum: false }
      const manifestSource = (i: number, label: string) => ({
        auditId: `${label}-${i}`, projectId: `private-project-${i}`, grantId: `grant-${i}`,
      })
      const sources = Array.from({ length: 20 }, (_, index) =>
        ['source', 'recovery', 'pass'].map(label => manifestSource(index, label))).flat()
      sources.push(manifestSource(0, 'recurrence'))
      const manifest = { version: 1, evidenceRef: 'private-availability-evidence', sources }
      const draft = (selected = sources) => prepareResearchDraft({
        manifest: { ...manifest, sources: selected }, recoveries: true, start: at(0), end: at(15), now: at(20),
      }, db)
      expect(await draft()).toMatchObject({ status: 'reviewable-recovery-draft', publicationApproved: false,
        databaseWritten: false, draft: { sampleSiteCount: 20, recovery: candidate } })
      const withheldFollowup = { ...candidate, comparableFollowupMeetsMinimum: null, failureAfterScheduledPassMeetsMinimum: null }
      for (const omitted of ['pass-1', 'recurrence-0']) {
        expect(await draft(sources.filter(source => source.auditId !== omitted))).toMatchObject({
          status: 'reviewable-recovery-draft', draft: { recovery: withheldFollowup },
        })
      }
      expect(await draft(sources.filter(source => source.auditId !== 'recovery-1')))
        .toMatchObject({ status: 'recovery-evidence-below-minimum' })
      const draftDirectory = mkdtempSync(join(tmpdir(), 'fixflags-recovery-draft-'))
      try {
        const manifestPath = join(draftDirectory, 'private-manifest.json')
        writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 })
        const prepared = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/prepare-research-draft.ts',
          manifestPath, '--recoveries', at(0).toISOString(), at(15).toISOString()], {
          env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
        })
        expect(prepared.status).toBe(0)
        expect(prepared.stderr).toBe('')
        expect(JSON.parse(prepared.stdout)).toMatchObject({ status: 'reviewable-recovery-draft', draft: { recovery: candidate } })
        expect(prepared.stdout).not.toMatch(/private-|request-source|recovery-0|grant-0/)
      } finally {
        rmSync(draftDirectory, { recursive: true, force: true })
      }
      expect(await run()).toMatchObject({ nativeRecovery: { checked: true, candidate }, publicationApproved: false, databaseWritten: false })
      expect(await inspectResearchReadiness({ start: at(0), end: at(7), checkedAt: at(20), includeRecoveries: true }, db))
        .toMatchObject({ nativeRecovery: { candidate: { ...candidate, matureFollowupMeetsMinimum: false, comparableFollowupMeetsMinimum: false } } })
      const runInspector = () => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-research-readiness.ts', '60', '--recoveries'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      const command = runInspector()
      expect(command.status).toBe(0)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).nativeRecovery.candidate).toEqual(candidate)
      expect(command.stdout).not.toMatch(/private-|request-source|recovery-0|grant-0/)
      const setDestination = (execution: string, attempt: number, destination: string) => db.$executeRaw`
        UPDATE outcome_binding_attempts SET detail = jsonb_set(detail, '{finalUrl}', to_jsonb(${destination}::text))
        WHERE "executionId" = ${execution} AND outcome_binding_attempts.attempt = ${attempt}`
      await setDestination('binding-source-0', 1, 'https://outside.example/')
      expect((await run()).nativeRecovery?.candidate).toBeNull()
      expect(await draft()).toMatchObject({ status: 'recovery-evidence-below-minimum' })
      await setDestination('binding-source-0', 1, address(0))
      await setDestination('binding-pass-1', 1, 'https://outside.example/')
      expect((await run()).nativeRecovery?.candidate).toEqual({ ...candidate, comparableFollowupMeetsMinimum: false })
      expect(await draft()).toMatchObject({ status: 'reviewable-recovery-draft', draft: { recovery: withheldFollowup } })
      await setDestination('binding-pass-1', 1, address(1))
      // Keep the projected success and final browser URL in scope, but change the HTTP landing in both records.
      const setHttpLanding = async (destination: string) => {
        await db.$executeRaw`UPDATE outcome_binding_attempts SET detail = jsonb_set(detail, '{publicHttpFinalUrl}', to_jsonb(${destination}::text))
          WHERE "executionId" = 'binding-recovery-0'`
        await db.$executeRaw`UPDATE outcome_binding_executions SET detail = jsonb_set(detail, '{publicHttpFinalUrl}', to_jsonb(${destination}::text))
          WHERE id = 'binding-recovery-0'`
      }
      await setHttpLanding('https://outside.example/')
      expect((await run()).nativeRecovery?.candidate).toBeNull()
      await setHttpLanding(address(0))
      expect((await run()).nativeRecovery?.candidate).toEqual(candidate)

      await db.$executeRaw`INSERT INTO users (id) VALUES ('private-owner-20')`
      await db.$executeRaw`INSERT INTO projects VALUES ('private-project-20', 'private-owner-20', ${address(20)}, NULL)`
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('grant-20', 'private-project-20', 'private-owner-20',
        ${RESEARCH_CONSENT_EVENT}, 1, ${grant(20, true)}::jsonb, ${at(.5)})`
      await db.$executeRaw`INSERT INTO site_outcomes VALUES ('private-outcome-20', 'private-project-20', 'production', 'AVAILABILITY')`
      await save(20, 3, 'pass')
      const assignOwner = async (owner: string) => {
        await db.$executeRaw`UPDATE projects SET "userId" = ${owner} WHERE id = 'private-project-1'`
        await db.$executeRaw`UPDATE audits SET "userId" = ${owner} WHERE "projectId" = 'private-project-1'`
        await db.$executeRaw`UPDATE site_lifecycle_events SET "userId" = ${owner} WHERE id = 'grant-1'`
      }
      await assignOwner('private-owner-0')
      expect(await run()).toMatchObject({ counts: { eligibleSites: 21 }, independenceFloorMet: true,
        nativeRecovery: { checked: true, candidate: null } })
      await assignOwner('private-owner-1')
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE id = 'grant-20'`
      expect((await run()).nativeRecovery?.candidate).toEqual(candidate)

      await db.$executeRaw`UPDATE audits SET "executionSpec" = jsonb_set("executionSpec", '{scanAccess,kind}', '"explicit"') WHERE id = 'recovery-0'`
      expect((await run()).nativeRecovery).toMatchObject({ checked: true, candidate: null })
      await db.$executeRaw`UPDATE audits SET "executionSpec" = jsonb_set("executionSpec", '{scanAccess,kind}', '"public"') WHERE id = 'recovery-0'`
      expect((await run()).nativeRecovery?.candidate).toEqual(candidate)
      await db.$executeRaw`UPDATE run_requests SET "requestedAt" = ${at(.25)} WHERE id = 'request-source-0'`
      expect((await run()).nativeRecovery).toMatchObject({ checked: true, candidate: null })
      await db.$executeRaw`UPDATE run_requests SET "requestedAt" = ${at(1)} WHERE id = 'request-source-0'`
      await db.$executeRaw`UPDATE outcome_assessments SET coverage = jsonb_set(coverage, '{bindings,0,config,startUrl}', to_jsonb('https://outside.example/'::text))
        WHERE "outcomeId" = 'private-outcome-0'`
      expect((await run()).nativeRecovery).toMatchObject({ checked: true, candidate: null })
      await db.$executeRaw`UPDATE outcome_assessments SET coverage = jsonb_set(coverage, '{bindings,0,config,startUrl}', to_jsonb(${address(0)}::text))
        WHERE "outcomeId" = 'private-outcome-0'`
      expect((await run()).nativeRecovery?.candidate).toEqual(candidate)
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('withdrawal', 'private-project-0', 'private-owner-0',
        ${RESEARCH_CONSENT_EVENT}, 1, ${grant(0, false)}::jsonb, ${at(16)})`
      expect((await run()).nativeRecovery).toMatchObject({ checked: false, candidate: null })
      expect(await draft()).toMatchObject({ status: 'cohort-unverified' })
      await db.$executeRaw`ALTER TABLE projects DROP COLUMN "watchTargetRevision"`
      const incomplete = runInspector()
      expect(incomplete.status).toBe(1)
      expect(incomplete.stderr).toBe('')
      expect(JSON.parse(incomplete.stdout)).toMatchObject({ status: 'consent-schema-unavailable',
        missingPrerequisite: 'projects.watchTargetRevision', retainedConsentHistory: 'present-unclassified', counts: null,
        databaseWritten: false, publicationApproved: false })
      expect(incomplete.stdout).not.toMatch(/private-|request-source|recovery-0|grant-0/)
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE name = ${RESEARCH_CONSENT_EVENT}`
      const empty = runInspector()
      expect(empty.status).toBe(1)
      expect(JSON.parse(empty.stdout)).toMatchObject({ status: 'consent-schema-unavailable', retainedConsentHistory: 'none-observed', counts: null })
      const migration = new URL('../../../prisma/migrations/20261108120000_watch_target_revision/migration.sql', import.meta.url)
      await db.$executeRawUnsafe(readFileSync(migration, 'utf8'))
      const current = runInspector()
      expect(current.status).toBe(0)
      expect(JSON.parse(current.stdout)).toMatchObject({ counts: { activeScopedGrants: 0, eligibleAudits: 0, eligibleSites: 0 },
        nativeRecovery: { checked: false, candidate: null } })
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
