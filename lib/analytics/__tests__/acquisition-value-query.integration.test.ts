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
import { captureLandingJourneySnapshot, loadSiteFirstValueFunnel } from '../site-first-value-funnel'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'
import { FIXFLAGS_LANDING_SCOPE } from '@/lib/growth/reporting-targets'
import { checkPublicLinks } from '@/lib/audit/checks/public-links'
import { nativeHttpCollection } from '@/lib/audit/native-http-evidence'

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
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audits (id text PRIMARY KEY, "userId" text, "projectId" text, "parentId" text, source text, status text, "createdAt" timestamp(3), "startedAt" timestamp(3), "completedAt" timestamp(3), "planAtAdmission" text, "failureCode" text, "utmSource" text)`)
      await db.$executeRaw`CREATE TABLE provisional_sites ("primaryAuditId" text, "claimedProjectId" text)`
      await db.$executeRaw`CREATE TABLE graph_artifact (id text PRIMARY KEY, kind text, path text UNIQUE, payload jsonb, "writtenAt" timestamp(3) DEFAULT NOW())`
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".site_lifecycle_events (id text PRIMARY KEY, name text, version int, "userId" text, "projectId" text, "idempotencyKey" text UNIQUE, properties jsonb, "createdAt" timestamp(3) DEFAULT NOW())`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".flags (id text PRIMARY KEY, "auditId" text,
        "createdAt" timestamp(3), "checkId" text, "verificationRule" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvements (id text PRIMARY KEY, "projectId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_occurrences (id text PRIMARY KEY, "improvementId" text, "auditId" text, "flagId" text)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycles (id text PRIMARY KEY, "projectId" text, "sourceAuditId" text, "improvementId" text, "occurrenceId" text, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_attempts (id text PRIMARY KEY, "sourceAuditId" text, "improvementId" text,
        "createdAt" timestamp(3), "sourceFlagIds" text[] DEFAULT '{}', "handoffReference" text, "verificationAuditId" text,
        frozen boolean DEFAULT false, "sourceObservations" jsonb)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".improvement_cycle_events (id text PRIMARY KEY, "cycleId" text, type text, transport text, "occurredAt" timestamp(3), outcome text, "attemptId" text, "verificationAuditId" text, client text, "contextCorrection" jsonb)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".run_requests (id text PRIMARY KEY, "projectId" text, "requestedByUserId" text, source text, status text, environment text, "requestedAt" timestamp(3), "completedAt" timestamp(3), "auditId" text)`)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".projects VALUES ('synthetic-site', 'synthetic-owner', $1, NULL)`, at(1))
      for (const [id, parent, source, created, completed] of [
        ['synthetic-source', null, 'HOMEPAGE', 0, 0.1], ['synthetic-after', 'synthetic-source', 'DASHBOARD', 3, 3.1],
        ['synthetic-later-source', 'synthetic-source', 'DASHBOARD', 4, 4.1],
      ] as const) {
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ($1, 'synthetic-owner', 'synthetic-site', $2, $3, 'COMPLETED', $4, $4, $5)`, id, parent, source, at(created), at(completed))
      }
      for (const [id, name, user, key, properties, date] of [
        ['start', 'analyze_started', null, 'analyze_started:synthetic-source',
          { anonymous: true, guideEntry: 'website-online-but-not-working', journeyId: `ffj_${'c'.repeat(32)}` }, 0],
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
        claimReceipts: 1, initialIssueCycles: 1, recordedFixAttempts: 1, independentlyImproved: 1 },
        admissionReceiptCoverage: { retainedMatureAdmissions: 1, missingStartReceipts: 0 } })
      expect(JSON.stringify(report)).not.toContain('synthetic-')
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', '30', 'acquisition'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0); expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout)).toMatchObject({
        matureCohort: { independentlyImproved: 1 },
        guideEntries: [{ guide: 'website-online-but-not-working', starts: 1, analysisCompletionReceipts: 1,
          claimReceipts: 1, recordedFixAttempts: 1, independentlyImproved: 1 }],
      })
      expect(command.stdout).not.toContain('synthetic-')
      expect(command.stdout).not.toContain('ffj_')
      const providerExport = {
        status: 'available', fetchedAt: at(9).toISOString(), reportingTimeZone: 'UTC',
        startDate: at(-1).toISOString().slice(0, 10), endDate: at(1).toISOString().slice(0, 10),
        journeys: [{ journeyId: `ffj_${'c'.repeat(32)}` }, { journeyId: `ffj_${'d'.repeat(32)}` }],
      }
      const landing = await captureLandingJourneySnapshot({ ...providerExport, scope: FIXFLAGS_LANDING_SCOPE }, at(12))
      expect(landing).toMatchObject({ landingSessions: 2, startedSessions: 1, completedAnalysisSessions: 1,
        claimedSessions: 1, followupComplete: true, claimRate: 50 })
      const path = 'ga/rolling-28d/landing-journeys'
      await persistGrowthArtifact('ga-landing-journeys', path, providerExport)
      expect((await loadSiteFirstValueFunnel(at(0))).landing).toMatchObject({ status: 'incomparable', landingSessions: null })
      await persistGrowthArtifact('ga-landing-journeys', path, landing)
      const stored = await db.growthArtifact.findUniqueOrThrow({ where: { path } })
      expect(stored.payload).toEqual(landing)
      expect(JSON.stringify(stored.payload)).not.toMatch(/ffj_|synthetic-|journeyIds/)
      expect((await loadSiteFirstValueFunnel(at(0))).landing).toMatchObject({
        landingSessions: 2, claimedSessions: 1, firstUsefulResultSessions: 1, instrumentedStarts: 1,
      })
      await admin.$executeRawUnsafe(`DELETE FROM "${schema}".site_lifecycle_events WHERE id = 'result'`)
      expect((await loadAcquisitionValueCohort(input, db)).processingEvidence).toMatchObject({
        receiptWithinFollowup: 0, completedAuditWithinFollowupWithoutReceipt: 1,
      })
      await db.$executeRaw`UPDATE audits SET status = 'FAILED', "failureCode" = 'SITE_UNREACHABLE' WHERE id = 'synthetic-source'`
      expect(await loadAcquisitionValueCohort(input, db)).toMatchObject({
        processingGaps: { failedWithinFollowup: 1 },
        guideEntries: [{ processingGaps: { failedWithinFollowup: 1 } }],
        recordedFailureCodes: [{ code: 'SITE_UNREACHABLE', audits: 1 }],
      })
      await db.$executeRaw`UPDATE audits SET status = 'COMPLETED', "failureCode" = NULL WHERE id = 'synthetic-source'`
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET transport = 'WEB' WHERE id = 'outcome'`)
      expect((await loadAcquisitionValueCohort(input, db)).matureCohort.independentlyImproved).toBe(0)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET transport = 'SYSTEM' WHERE id = 'outcome'`)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycles SET "sourceAuditId" = 'synthetic-later-source'`)
      expect((await loadAcquisitionValueCohort(input, db)).matureCohort).toMatchObject({ starts: 1, independentlyImproved: 0, initialIssueCycles: 0 })
      // Continue the same incident from the later monitoring source.
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_occurrences SET "auditId" = 'synthetic-later-source'`)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".flags SET "auditId" = 'synthetic-later-source', "createdAt" = $1`,at(4.1))
      await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycles SET "createdAt" = $1`,at(4.2))
      await db.$executeRaw`UPDATE improvement_attempts SET "sourceAuditId" = 'synthetic-later-source', "createdAt" = ${at(4.5)},
        "handoffReference" = 'flag:synthetic-flag', "verificationAuditId" = 'synthetic-after', frozen = true`
      await admin.$executeRawUnsafe(`UPDATE "${schema}".audits SET "createdAt" = $1, "startedAt" = $1, "completedAt" = $2 WHERE id = 'synthetic-after'`,at(5),at(5.1))
      for(const [id,day] of [['generated',4.2],['attempt',4.5],['outcome',5.2]] as const) {
        await admin.$executeRawUnsafe(`UPDATE "${schema}".improvement_cycle_events SET "occurredAt" = $1 WHERE id = $2`,at(day),id)
      }
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ('post-monitor', 'synthetic-owner', 'synthetic-site', 'synthetic-after', 'DASHBOARD', 'COMPLETED', $1, $1, $2)`,at(6),at(6.1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".run_requests VALUES ('watch', 'synthetic-site', 'synthetic-owner', 'WATCH', 'COMPLETED', 'production', $1, $2, 'post-monitor')`,at(6),at(6.2))
      const context = { schemaVersion: 'fixflags.handoff-receipt.v1', sourceFlagId: 'synthetic-flag',
        referenceFlagId: 'synthetic-improvement', promptHash: 'a'.repeat(64),
        context: { contextHash: 'b'.repeat(64), sourceAuditId: 'synthetic-later-source', kind: 'repair',
          sourceFlagIds: ['synthetic-flag'] } }
      await db.$executeRaw`INSERT INTO improvement_cycle_events VALUES ('clipboard', 'synthetic-cycle', 'HANDOFF_COPIED', 'copy',
        ${at(4.3)}, NULL, NULL, NULL, 'website-clipboard-v2', ${JSON.stringify(context)}::jsonb)`
      const readHandoffs = async () => (await loadSiteValueCohort(input, db)).counts.ownerAcknowledgedClipboardHandoff
      expect(await readHandoffs()).toBe(0)
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('clipboard-ack', 'fix_handoff', 1, 'synthetic-other-owner',
        NULL, 'fix-handoff:synthetic-owner:synthetic-flag:copy:clipboard-v2', '{"client":"website-clipboard-v2","channel":"copy"}', ${at(4.31)})`
      expect(await readHandoffs()).toBe(0)
      await db.$executeRaw`UPDATE site_lifecycle_events SET "userId" = 'synthetic-owner', "createdAt" = ${at(4.29)} WHERE id = 'clipboard-ack'`
      expect(await readHandoffs()).toBe(0)
      await db.$executeRaw`UPDATE site_lifecycle_events SET "createdAt" = ${at(4.31)} WHERE id = 'clipboard-ack'`
      await db.$executeRaw`UPDATE improvement_cycle_events SET client = NULL WHERE id = 'clipboard'`
      expect(await readHandoffs()).toBe(0)
      await db.$executeRaw`UPDATE improvement_cycle_events SET client = 'website-clipboard-v2',
        "contextCorrection" = jsonb_set("contextCorrection", '{context,kind}', '"investigation"') WHERE id = 'clipboard'`
      expect(await readHandoffs()).toBe(0)
      await db.$executeRaw`UPDATE improvement_cycle_events SET "contextCorrection" = ${JSON.stringify(context)}::jsonb WHERE id = 'clipboard'`
      const continuing=await loadSiteValueCohort(input,db)
      const retainedSite = { sites: 1, independentlyImproved: 1, completedScheduledChecks: 1, completedMonitoringAfterImprovement: 1,
        ownerAcknowledgedClipboardHandoff: 1, ownerClipboardHandoffWithIndependentResult: 1,
        ownerClipboardHandoffWithVerifiedImprovement: 1, verifiedPublicLinkRepair: 0 }
      expect(continuing).toMatchObject({ status: 'available', counts: retainedSite,
        guideEntries: [{ guide: 'website-online-but-not-working', ...retainedSite }] })
      expect(JSON.stringify(continuing)).not.toContain('synthetic-')
      expect(JSON.stringify(continuing)).not.toContain(context.promptHash)
      expect(continuing.observedSharesPct).not.toHaveProperty('verifiedPublicLinkRepair')
      for (const key of Object.keys(retainedSite).filter(key => key.startsWith('owner'))) {
        expect(continuing.observedSharesPct).not.toHaveProperty(key)
      }
      const readCounts = async () => (await loadSiteValueCohort(input, db)).counts
      const unlinked = { ownerAcknowledgedClipboardHandoff: 1, independentlyImproved: 1,
        ownerClipboardHandoffWithIndependentResult: 0, ownerClipboardHandoffWithVerifiedImprovement: 0 }
      for (const scope of [null, 'synthetic-flag', ['synthetic-flag', 'another-flag'], ['wrong-flag']]) {
        await db.$executeRaw`UPDATE improvement_cycle_events SET "contextCorrection" = jsonb_set("contextCorrection",
          '{context,sourceFlagIds}', ${JSON.stringify(scope)}::jsonb) WHERE id = 'clipboard'`
        expect(await readCounts()).toMatchObject(unlinked)
      }
      await db.$executeRaw`UPDATE improvement_attempts SET "sourceFlagIds" = ARRAY['another-flag', 'synthetic-flag']`
      await db.$executeRaw`UPDATE improvement_cycle_events SET "contextCorrection" = jsonb_set("contextCorrection",
        '{context,sourceFlagIds}', '["synthetic-flag","another-flag"]') WHERE id = 'clipboard'`
      expect(await readCounts()).toMatchObject(retainedSite)
      await db.$executeRaw`UPDATE improvement_attempts SET frozen = false`
      expect(await readCounts()).toMatchObject(unlinked)
      await db.$executeRaw`UPDATE improvement_attempts SET frozen = true`
      await db.$executeRaw`UPDATE site_lifecycle_events SET "createdAt" = ${at(4.6)} WHERE id = 'clipboard-ack'`
      expect(await readCounts()).toMatchObject(unlinked)
      await db.$executeRaw`UPDATE site_lifecycle_events SET "createdAt" = ${at(4.31)} WHERE id = 'clipboard-ack'`
      await db.$executeRaw`UPDATE improvement_cycle_events SET outcome = 'UNCHANGED' WHERE id = 'outcome'`
      expect(await readCounts()).toMatchObject({ ownerClipboardHandoffWithIndependentResult: 1, ownerClipboardHandoffWithVerifiedImprovement: 0 })
      await db.$executeRaw`UPDATE improvement_cycle_events SET outcome = 'IMPROVED' WHERE id = 'outcome'`
      await db.$executeRaw`UPDATE flags SET "checkId" = 'broken-internal-links', "verificationRule" = 'legacy rule'`
      expect(await readCounts()).toMatchObject({ independentlyImproved: 1, verifiedPublicLinkRepair: 0 })
      // Exercise the check that produced the study observation before passing
      // its Flag identity to the synthetic repair ledger.
      const source = 'https://93.184.215.14/'
      const inventory = { links: [{ href: '/book', text: 'Book', rel: null }], complete: true }
      const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
        expect(url).toBe(source + 'book')
        return new Response('<html><body><h1>Page not found</h1></body></html>', {
          status: 200, headers: { 'content-type': 'text/html' },
        })
      })
      try {
        const failedLink = await checkPublicLinks(source, inventory, Date.now() + 5_000, nativeHttpCollection().options.openDestination)
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(failedLink.assertions).toMatchObject([{ passed: false, complete: true }])
        expect(failedLink.flags).toHaveLength(1)
        const { checkId, verificationRule } = failedLink.flags[0]
        await db.$executeRaw`UPDATE flags SET "checkId" = ${checkId ?? null}, "verificationRule" = ${verificationRule ?? null}`
      } finally {
        fetch.mockRestore()
      }
      expect(await loadSiteValueCohort(input, db)).toMatchObject({
        counts: { verifiedPublicLinkRepair: 1 },
        guideEntries: [{ guide: 'website-online-but-not-working', verifiedPublicLinkRepair: 1 }],
      })
      await db.$executeRaw`UPDATE improvement_cycle_events SET outcome = 'UNCHANGED' WHERE id = 'outcome'`
      expect(await readCounts()).toMatchObject({ verifiedPublicLinkRepair: 0 })
      await db.$executeRaw`UPDATE improvement_cycle_events SET outcome = 'IMPROVED' WHERE id = 'outcome'`
      await db.$executeRaw`UPDATE flags SET "checkId" = 'broken-page-anchors'`
      expect(await readCounts()).toMatchObject({ independentlyImproved: 1, verifiedPublicLinkRepair: 0 })
      await db.$executeRaw`UPDATE flags SET "checkId" = NULL, "verificationRule" = NULL`
      const sitesCommand=spawnSync(process.execPath,['--import','tsx','scripts/growth/inspect-customer-value.ts','30','sites'],{
        env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',timeout:15000})
      expect(sitesCommand.status).toBe(0)
      expect(sitesCommand.stderr).toBe('')
      expect(JSON.parse(sitesCommand.stdout).guideEntries).toEqual(continuing.guideEntries)
      expect(sitesCommand.stdout).not.toMatch(/synthetic-|ffj_/)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits
        VALUES ('synthetic-return', 'synthetic-owner', 'synthetic-site', 'synthetic-source', 'DASHBOARD', 'COMPLETED', $1, $1, $2)`, at(20), at(20.1))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".run_requests
        VALUES ('owner-return', 'synthetic-site', 'synthetic-owner', 'WEB', 'COMPLETED', 'production', $1, $2, 'synthetic-return')`, at(20), at(20.2))
      expect(await loadSiteValueCohort({ since: at(0.5), now: at(30), followupDays: 28 }, db)).toMatchObject({
        guideEntries: [{ guide: 'website-online-but-not-working', ...retainedSite, ownerRequestedFollowup: 1 }],
      })
      // Keep the start window closed even while claims and follow-up can still arrive.
      const fixedEnd = at(1)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".site_lifecycle_events
        VALUES ('outside-start', 'analyze_started', 1, NULL, NULL, 'analyze_started:outside', '{"anonymous":true}', $1)`, fixedEnd)
      const window = { since: at(0), startWindowEnd: fixedEnd }
      expect(await loadAcquisitionValueCohort({ ...window, now: at(7.5) }, db)).toMatchObject({
        cohortEndExclusive: fixedEnd.toISOString(), fullyMature: false, coverage: { recordedAnonymousStarts: 1 },
        matureCohort: { starts: 1, claimReceipts: 1, observedSharesPct: { claimReceipts: null } },
      })
      expect(await loadSiteValueCohort({ ...window, now: at(35), followupDays: 28 }, db)).toMatchObject({
        fullyMature: false, fullyMatureAt: at(36).toISOString(),
        counts: { ownerRequestedFollowup: 1 }, observedSharesPct: { ownerRequestedFollowup: null },
      })
      expect(await loadSiteValueCohort({ ...window, now: at(36), followupDays: 28 }, db)).toMatchObject({
        fullyMature: true, guideEntries: [{ guide: 'website-online-but-not-working', ...retainedSite, ownerRequestedFollowup: 1 }],
      })
      const fixedCli = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', 'sites',
        '--start-window', at(0).toISOString().slice(0, 10), fixedEnd.toISOString().slice(0, 10)], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(fixedCli.status).toBe(0)
      expect(fixedCli.stderr).toBe('')
      expect(JSON.parse(fixedCli.stdout)).toMatchObject({
        fullyMature: false, guideEntries: [{ guide: 'website-online-but-not-working', ...retainedSite }],
        observedSharesPct: { completedMonitoringAfterImprovement: null },
      })
      expect(fixedCli.stdout).not.toMatch(/synthetic-|ffj_/)
      await db.$executeRaw`
        INSERT INTO audits (id, "userId", "projectId", "parentId", source, status, "createdAt", "planAtAdmission") VALUES
          ('synthetic-missing-start', NULL, NULL, NULL, 'HOMEPAGE', 'QUEUED', ${at(.5)}, NULL),
          ('synthetic-unusable-start', NULL, NULL, NULL, 'HOMEPAGE', 'QUEUED', ${at(.5)}, NULL),
          ('synthetic-delayed-start', NULL, NULL, NULL, 'HOMEPAGE', 'QUEUED', ${at(.5)}, NULL),
          ('synthetic-no-admission-evidence', NULL, NULL, NULL, 'HOMEPAGE', 'QUEUED', ${at(.5)}, NULL),
          ('synthetic-known-signed', 'synthetic-owner', 'synthetic-site', NULL, 'HOMEPAGE', 'QUEUED', ${at(.5)}, 'FREE'),
          ('synthetic-seed', NULL, NULL, NULL, 'SEED', 'QUEUED', ${at(.5)}, NULL),
          ('synthetic-future', NULL, NULL, NULL, 'HOMEPAGE', 'QUEUED', ${at(8)}, NULL)
      `
      await db.$executeRaw`
        INSERT INTO provisional_sites VALUES ('synthetic-source', 'synthetic-site'),
          ('synthetic-missing-start', NULL), ('synthetic-missing-start', NULL), ('synthetic-unusable-start', NULL),
          ('synthetic-delayed-start', NULL), ('synthetic-known-signed', 'synthetic-site'),
          ('synthetic-seed', NULL), ('synthetic-future', NULL)
      `
      await db.$executeRaw`
        INSERT INTO site_lifecycle_events VALUES
          ('bad-start', 'analyze_started', 1, NULL, NULL, 'analyze_started:synthetic-unusable-start', '{"anonymous":"true"}', ${at(.6)}),
          ('late-start', 'analyze_started', 1, NULL, NULL, 'analyze_started:synthetic-delayed-start', '{"anonymous":true}', ${fixedEnd})
      `
      const admitted = await loadAcquisitionValueCohort({ ...window, now: at(12) }, db)
      expect(admitted).toMatchObject({
        status: 'partial', fullyMature: true,
        admissionReceiptCoverage: { status: 'observed', retainedMatureAdmissions: 4,
          missingStartReceipts: 1, unusableStartReceipts: 1, startReceiptsOutsideWindow: 1 },
        matureCohort: { starts: 1, claimReceipts: 1, observedSharesPct: { claimReceipts: null } },
        guideEntries: [{ guide: 'website-online-but-not-working', starts: 1, observedSharesPct: { claimReceipts: null } }],
      })
      expect(JSON.stringify(admitted)).not.toMatch(/synthetic-|ffj_/)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".site_lifecycle_events
        SET "idempotencyKey" = 'analyze_started:synthetic-later-source' WHERE id = 'start'`)
      expect(await loadSiteValueCohort(input, db)).toMatchObject({ counts: retainedSite, guideEntries: [] })
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
