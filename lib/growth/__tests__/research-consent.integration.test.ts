import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const { fixture } = vi.hoisted(() => ({ fixture: { db: null as unknown as PrismaClient, schema: '' } }))
vi.mock('@/lib/db', () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  if (key === '$transaction') return async (run: (tx: unknown) => unknown, options?: { isolationLevel: 'RepeatableRead' }) => fixture.db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${fixture.schema}"`)
    return run(tx)
  }, options)
  return fixture.db[key as keyof PrismaClient]
} }) }))
import { loadResearchConsent, saveResearchConsent, withdrawResearchConsentForSiteRemoval } from '../research-consent'
import { RESEARCH_PERMISSIONS_KIND, RESEARCH_PERMISSIONS_PATH } from '../research-permissions'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
import { researchFixture } from '@/lib/graph/__tests__/fixtures/public-research'
import { inspectResearchReadiness } from '../research-readiness'
import { preflightResearchRelease } from '../research-release-preflight'
import { prepareResearchDraft } from '../research-draft'
import { getIndexableIssueCheckIds, getIssuePage, getPublicIssueLibrary } from '@/lib/graph/queries'
import { PUBLIC_RESEARCH_KIND, PUBLIC_RESEARCH_PATH } from '@/lib/graph/public-research'
import { assessPageResponse } from '@/lib/audit/checks/page-response'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { PAGE_RESPONSE_RESEARCH_CHECKS } from '../research-page-response-coverage'
import { buildPublicSitemap as sitemap } from '@/app/sitemap.xml/entries'
import { GET as getSitemap } from '@/app/sitemap.xml/route'
import { GET as getLlmsTxt } from '@/app/llms.txt/route'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('research consent on isolated local PostgreSQL fixtures', () => {
  it('records prospective grants and withholds a previously eligible release after withdrawal or deletion', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Research fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: databaseUrl })
    const schema = `research_consent_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString() })
    fixture.db = db; fixture.schema = schema
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await db.$executeRawUnsafe(`CREATE TYPE "AccountLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETING')`)
      await db.$executeRawUnsafe(`CREATE TABLE users (id text PRIMARY KEY, "lifecycleStatus" "AccountLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
        "lifecycleRevision" int NOT NULL DEFAULT 0)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".projects (id text PRIMARY KEY, "userId" text, url text,
        "deletedAt" timestamp(3), "watchTargetRevision" int NOT NULL DEFAULT 1)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".site_lifecycle_events (id text PRIMARY KEY, name text, version int, "idempotencyKey" text UNIQUE, "userId" text, "projectId" text, properties jsonb, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."AuditStatus" AS ENUM ('COMPLETED', 'FAILED')`)
      await db.$executeRawUnsafe(`CREATE TYPE "TechnologyDetectionStatus" AS ENUM ('NOT_CAPTURED', 'COMPLETE', 'PARTIAL', 'UNAVAILABLE')`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audits (id text PRIMARY KEY, "projectId" text, "userId" text, url text, status "${schema}"."AuditStatus", "createdAt" timestamp(3), "completedAt" timestamp(3),
        "scanAccessEncrypted" text, "executionSpec" jsonb DEFAULT '{"version":1,"environment":"production","scope":"SITE","scanAccess":{"kind":"public"}}',
        "technologyDetectionStatus" "${schema}"."TechnologyDetectionStatus" DEFAULT 'NOT_CAPTURED',
        "technologyDetectedAt" timestamp(3), "technologyDetectorVersion" text, "technologyObservationScope" jsonb)`)
      await db.$executeRaw`CREATE TABLE graph_technology (id text PRIMARY KEY, name text UNIQUE, kind text)`
      await db.$executeRaw`CREATE TABLE audit_technology_observation (id text PRIMARY KEY, "auditId" text, "technologyId" text,
        confidence double precision, "detectorVersion" text, "detectedAt" timestamp(3))`
      await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."FlagSource" AS ENUM ('DETERMINISTIC', 'AI', 'JOURNEY')`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".flags (id text PRIMARY KEY, "auditId" text, "checkId" text, source "${schema}"."FlagSource", confidence double precision, "createdAt" timestamp(3), "supportingObservations" jsonb)`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audit_verifier_executions ("auditId" text, "taskId" text, "targetKey" text, source text, status text, "createdAt" timestamp(3), detail jsonb, "pageUrl" text,
        id text DEFAULT gen_random_uuid()::text)`)
      await db.$executeRaw`CREATE TABLE audit_execution_tasks (id text PRIMARY KEY, "auditId" text, "workKind" text, "workState" text,
        "createdAt" timestamp(3), "pageUrl" text, "workInput" jsonb, "workResult" jsonb,
        "workDependencies" text[] DEFAULT '{}', "targetKey" text)`
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".graph_artifact (id text PRIMARY KEY DEFAULT 'manifest', path text UNIQUE, kind text, payload jsonb, "writtenAt" timestamp(3) DEFAULT NOW())`)

      const windowStart = new Date(Date.now() - 1_000)
      const sources: Array<{ projectId: string; grantId: string; auditId: string }> = []
      for (let i = 0; i < 20; i++) {
        const owner = { projectId: `project${i}`, userId: `owner${i}` }
        const siteUrl = `https://synthetic${i}.example/`
        await db.$executeRaw`INSERT INTO users (id) VALUES (${owner.userId})`
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".projects VALUES ($1, $2, $3, NULL)`, owner.projectId, owner.userId, siteUrl)
        expect((await loadResearchConsent(owner)).enabled).toBe(false)
        const granted = await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
        const grant = await db.siteLifecycleEvent.findFirstOrThrow({ where: { projectId: owner.projectId }, orderBy: { createdAt: 'desc' } })
        expect(granted.enabled).toBe(true)
        expect(await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).toEqual(granted)
        const createdAt = new Date(grant.createdAt.getTime() + 1)
        const completedAt = new Date(createdAt.getTime() + 1)
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6)`,
          `audit${i}`, owner.projectId, owner.userId, siteUrl, createdAt, completedAt)
        sources.push({ projectId: owner.projectId, grantId: grant.id, auditId: `audit${i}` })
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags VALUES ($1, $2, 'security-headers-missing', 'DETERMINISTIC', 0.95, $3)`, `flag${i}`, `audit${i}`, completedAt)
      }
      const dataset = researchFixture()
      dataset.sampleSiteCount = 20; dataset.issues[0].siteCount = 20
      dataset.issues[0].occurrenceCount = 20; dataset.issues[0].topFrameworks = []
      dataset.windowStart = windowStart.toISOString(); dataset.windowEnd = new Date(Date.now() + 10).toISOString()
      dataset.reviewedAt = dataset.windowEnd; dataset.expiresAt = new Date(Date.now() + 86_400_000).toISOString()
      const manifest = { version: 1, evidenceRef: dataset.evidenceRef, sources }
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".graph_artifact (path, kind, payload) VALUES ($1, $2, $3::jsonb)`, RESEARCH_PERMISSIONS_PATH, RESEARCH_PERMISSIONS_KIND, JSON.stringify(manifest))
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".graph_artifact (id, path, kind, payload) VALUES ('release', $1, $2, $3::jsonb)`, PUBLIC_RESEARCH_PATH, PUBLIC_RESEARCH_KIND, JSON.stringify(dataset))

      const end = new Date(dataset.windowEnd)
      const checkedAt = new Date(end.getTime() + 60_000)
      const readiness = () => inspectResearchReadiness({ start: windowStart, end, checkedAt }, db)
      const preflight = (inputManifest: unknown = manifest) => preflightResearchRelease({
        release: dataset, manifest: inputManifest, now: checkedAt,
      }, db)
      const draft = (inputManifest: unknown = manifest, checkId = 'security-headers-missing') =>
        prepareResearchDraft({ manifest: inputManifest, checkId, start: windowStart, end, now: checkedAt }, db)
      const [source] = await db.audit.findMany({ where: { id: 'audit0' }, select: { createdAt: true, completedAt: true } })
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES
        ('repeat-audit', 'project0', 'owner0', 'https://synthetic0.example/second', 'COMPLETED', $1, $2),
        ('foreign-audit', 'project0', 'foreign', 'https://synthetic0.example/', 'COMPLETED', $1, $2),
        ('other-origin', 'project0', 'owner0', 'https://outside.example/', 'COMPLETED', $1, $2)`, source.createdAt, source.completedAt)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags VALUES
        ('private-repeat', 'repeat-audit', 'security-headers-missing::page:1', 'DETERMINISTIC', 0.95, $1),
        ('private-small-cell', 'repeat-audit', 'title-missing', 'DETERMINISTIC', 0.95, $1),
        ('private-foreign', 'foreign-audit', 'security-headers-missing', 'DETERMINISTIC', 0.95, $1),
        ('private-ai', 'audit0', 'security-headers-missing', 'AI', 0.95, $1),
        ('private-weak', 'audit0', 'security-headers-missing', 'DETERMINISTIC', 0.5, $1),
        ('private-other-origin', 'other-origin', 'security-headers-missing', 'DETERMINISTIC', 0.95, $1)`, source.completedAt)
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags
        SELECT 'private-search-' || id, id, 'low-ctr', 'DETERMINISTIC', 0.95, "completedAt"
        FROM "${schema}".audits WHERE id LIKE 'audit%'`)
      const unversioned = await readiness()
      expect(unversioned.candidates).toMatchObject([
        { checkId: 'security-headers-missing', affectedSites: 20, observations: 21, corroboratedVersions: [] },
      ])
      expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified', issuesWithCorroboratedVersions: 0 })
      expect(await draft()).toMatchObject({ status: 'current-version-evidence-unverified', publicationApproved: false })
      expect(await draft(manifest, 'low-ctr')).toMatchObject({ status: 'invalid-draft-scope' })
      expect(await getPublicIssueLibrary()).toEqual([])
      await db.$executeRaw`
        UPDATE flags flag SET "supportingObservations" = jsonb_build_object('version', 1, 'items', jsonb_build_array(
          jsonb_build_object('source', 'DETERMINISTIC', 'checkId', split_part(flag."checkId", '::page:', 1),
            'evidence', 'Synthetic security-header finding', 'checkVersion', CASE WHEN flag.id = 'private-repeat' THEN 2 ELSE 1 END,
            'provenance', jsonb_build_object('auditId', flag."auditId", 'taskId', 'task-' || flag."auditId",
              'collectedAt', to_char(audit."completedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))))
        FROM audits audit WHERE audit.id = flag."auditId" AND (flag.id LIKE 'flag%' OR flag.id = 'private-repeat')
      `
      expect((await readiness()).candidates[0].corroboratedVersions).toEqual([])
      await db.$executeRaw`
        INSERT INTO audit_verifier_executions
        SELECT id, 'task-' || id, 'module:security-headers', 'DETERMINISTIC', 'COMPLETED', "completedAt",
          jsonb_build_object('kind', 'site-module-check', 'version', 1, 'module', 'security-headers', 'pageUrl', url,
            'execution', jsonb_build_object('auditId', id, 'taskId', 'task-' || id,
              'collectedAt', to_char("completedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'checkVersions', jsonb_build_object('security-headers-missing', CASE WHEN id = 'repeat-audit' THEN 2 ELSE 1 END))), url
        FROM audits WHERE id LIKE 'audit%' OR id = 'repeat-audit'
      `
      await db.$executeRaw`
        INSERT INTO audit_execution_tasks
        SELECT 'task-' || id, id, 'check', 'COMPLETED', "createdAt", url, '{}'::jsonb,
          jsonb_build_object('kind', 'check', 'version', 1, 'collectedAt', to_char("completedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'data', jsonb_build_object('flags', jsonb_build_array(jsonb_build_object(
              'checkId', 'security-headers-missing', 'source', 'DETERMINISTIC', 'pageUrl', url, 'evidence', 'Synthetic security-header finding'))))
        FROM audits WHERE id LIKE 'audit%' OR id = 'repeat-audit'
      `
      await db.$executeRaw`
        INSERT INTO audit_verifier_executions
        SELECT "auditId", id, 'artifact:observation', 'DETERMINISTIC', 'COMPLETED', "createdAt", "workResult", "pageUrl"
        FROM audit_execution_tasks WHERE id = 'task-audit2'
      `
      await db.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = NULL WHERE id = 'task-audit2'`
      const candidate = await readiness()
      expect(candidate).toMatchObject({
        databaseWritten: false, publicationApproved: false, checkedIssueCohorts: true,
        counts: { activeScopedGrants: 20, eligibleAudits: 21, eligibleSites: 20 },
        candidates: [{ checkId: 'security-headers-missing', affectedSites: 20, observations: 21,
          corroboratedVersions: [{ checkVersion: 1, affectedSites: 20, observations: 20, matchesRegisteredVersion: true }] }],
      })
      expect(candidate.candidates).toHaveLength(1)
      const reviewable = await draft()
      expect(reviewable).toMatchObject({
        status: 'reviewable-draft', publicationApproved: false, databaseWritten: false,
        draft: { sampleSiteCount: 20, issue: { checkId: 'security-headers-missing', checkVersion: 1, siteCount: 20, occurrenceCount: 20 } },
      })
      if (reviewable.status !== 'reviewable-draft') throw new Error('Expected aggregate research draft')
      expect(await preflightResearchRelease({ release: reviewable, manifest, now: checkedAt }, db))
        .toMatchObject({ status: 'invalid-release', published: false })
      const preparedRelease = { ...dataset, sampleSiteCount: reviewable.draft.sampleSiteCount,
        issues: [{ ...dataset.issues[0], ...reviewable.draft.issue }] }
      expect(await preflightResearchRelease({ release: preparedRelease, manifest, now: checkedAt }, db))
        .toMatchObject({ status: 'source-and-version-checks-passed' })
      expect(JSON.stringify(reviewable)).not.toMatch(/synthetic|project0|owner0|audit0|https:/)
      expect(await draft({ ...manifest, sources: sources.slice(1) })).toMatchObject({ status: 'cohort-unverified' })
      expect(await draft(manifest, 'title-missing')).toMatchObject({ status: 'issue-below-minimum' })
      expect(JSON.stringify(candidate)).not.toMatch(/synthetic0|project0|owner0|audit0|private-repeat|title-missing|low-ctr/)
      const setReceiptTime = (time: string) => db.$executeRaw`
        UPDATE audit_verifier_executions SET detail = jsonb_set(detail, '{execution,collectedAt}', to_jsonb(${time}::text))
        WHERE "auditId" = 'audit0' AND "targetKey" = 'module:security-headers'`
      const setFindingTime = async (time: string) => {
        await db.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{collectedAt}', to_jsonb(${time}::text))
          WHERE id = 'task-audit0'`
        await db.$executeRaw`UPDATE flags SET "supportingObservations" =
          jsonb_set("supportingObservations", '{items,0,provenance,collectedAt}', to_jsonb(${time}::text)) WHERE id = 'flag0'`
      }
      const originalTime = source.completedAt!.toISOString()
      const preAdmissionTime = new Date(source.createdAt.getTime() - 1).toISOString()
      await setReceiptTime(preAdmissionTime)
      expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified' })
      await setFindingTime(preAdmissionTime)
      expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified' })
      expect((await readiness()).candidates[0].corroboratedVersions).toEqual([])
      await setReceiptTime(originalTime)
      await setFindingTime(originalTime)
      expect(await preflight()).toMatchObject({ status: 'source-and-version-checks-passed' })
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-research-readiness.ts', '60'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).candidates).toEqual(candidate.candidates)
      expect(command.stdout).not.toMatch(/synthetic0|project0|owner0|audit0|private-repeat/)

      const coverage = async () => (await inspectResearchReadiness({
        start: windowStart, end, checkedAt, includePageResponseCoverage: true,
      }, db)).pageResponseCoverage
      expect(await coverage()).toMatchObject({ status: 'observations-below-minimum', observedSites: null })
      const coverageAudits = await db.audit.findMany({
        where: { id: { in: [...sources.map(source => source.auditId), 'repeat-audit'] } },
        select: { id: true, url: true, completedAt: true },
      })
      const makePageResult = (audit: typeof coverageAudits[number], status: 200 | 503) => {
        const pageUrl = audit.url
        const collectedAt = audit.completedAt!.toISOString()
        const document = { url: pageUrl, finalUrl: pageUrl, status, headers: { 'content-type': 'text/html' },
          body: '<title>Studio</title><h1>Studio</h1>', complete: true, reason: null, redirects: [], collectedAt }
        const response = assessPageResponse(pageUrl, document)
        const receipt = checkReceiptSchema.parse({
          kind: 'site-module-check', version: 1, module: 'page-response', applicable: true, pageUrl,
          passed: response.flags.length === 0, complete: response.complete, assertions: response.assertions,
          execution: { auditId: audit.id, taskId: 'http-' + audit.id, checkVersion: 1, source: 'http', collectedAt,
            checkVersions: Object.fromEntries(PAGE_RESPONSE_RESEARCH_CHECKS.map(id => [id, CHECK_REGISTRY[id].version])) },
        })
        return { receipt, flags: response.flags, document }
      }
      const makePageReceipt = (...args: Parameters<typeof makePageResult>) => makePageResult(...args).receipt
      for (const audit of coverageAudits) {
        const { receipt, document } = makePageResult(audit, audit.id === 'audit0' ? 503 : 200)
        const collectorId = 'collector-' + audit.id
        const capture = { kind: 'http', version: 1, collectedAt: document.collectedAt, data: { document, metadata: null } }
        await db.$executeRaw`INSERT INTO audit_execution_tasks VALUES (${collectorId}, ${audit.id}, 'http', 'COMPLETED',
          ${audit.completedAt}, ${audit.url}, '{}'::jsonb, ${JSON.stringify(capture)}::jsonb, '{}'::text[], 'task:p0:http')`
        await db.$executeRaw`INSERT INTO audit_execution_tasks VALUES (${receipt.execution!.taskId}, ${audit.id}, 'check', 'COMPLETED',
          ${audit.completedAt}, ${audit.url}, '{}'::jsonb, NULL, ARRAY['p0:http']::text[], 'task:p0:page-response')`
        await db.$executeRaw`INSERT INTO audit_verifier_executions VALUES (${audit.id}, ${receipt.execution!.taskId},
          'module:page-response', 'DETERMINISTIC', 'COMPLETED', ${audit.completedAt}, ${JSON.stringify(receipt)}::jsonb, ${audit.url})`
      }
      const covered = await coverage()
      expect(covered).toMatchObject({ status: 'sample-covered', observedSites: 20, scope: 'audit-entry-page' })
      expect(JSON.stringify(covered)).not.toMatch(/synthetic|audit0|https:/)
      const coverageAudit = coverageAudits.find(audit => audit.id === 'audit1')!
      const stored = makePageReceipt(coverageAudit, 200)
      const setPageReceipt = (detail: object) => db.$executeRaw`
        UPDATE audit_verifier_executions SET detail = ${JSON.stringify(detail)}::jsonb
        WHERE "auditId" = 'audit1' AND "targetKey" = 'module:page-response'`
      for (const detail of [
        { ...stored, assertions: [{ ...stored.assertions[0], pageResponseQualified: undefined }] },
        { ...stored, assertions: [{ ...stored.assertions[0], complete: false }] },
        { ...stored, assertions: [...stored.assertions, ...stored.assertions] },
        { ...stored, assertions: [{ ...stored.assertions[0], context: 'different-context' }] },
        { ...stored, execution: { ...stored.execution, checkVersions: { 'page-http-error': 1 } } },
        { ...stored, execution: { ...stored.execution, collectedAt: checkedAt.toISOString() } },
      ]) {
        await setPageReceipt(detail)
        expect(await coverage()).toMatchObject({ status: 'observations-below-minimum', observedSites: null })
      }
      await setPageReceipt(stored)
      expect(await coverage()).toEqual(covered)
      const setRedirects = (auditId: string, redirects: string[]) => db.$executeRaw`
        UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,document,redirects}', ${JSON.stringify(redirects)}::jsonb)
        WHERE id = ${'collector-' + auditId}`
      await setRedirects('audit1', [coverageAudit.url, 'https://outside.example/', coverageAudit.url])
      expect(await coverage()).toMatchObject({ status: 'observations-below-minimum', observedSites: null })
      await setRedirects('audit1', [])
      expect(await coverage()).toEqual(covered)
      await db.$executeRaw`UPDATE audit_execution_tasks SET "workDependencies" = ARRAY['collector-audit1'] WHERE id = 'http-audit1'`
      expect(await coverage()).toMatchObject({ status: 'observations-below-minimum', observedSites: null })
      await db.$executeRaw`UPDATE audit_execution_tasks SET "workDependencies" = ARRAY['p0:http'] WHERE id = 'http-audit1'`
      expect(await coverage()).toEqual(covered)
      for (const audit of coverageAudits.filter(audit => audit.id !== 'repeat-audit')) {
        const { receipt: failed, flags } = makePageResult(audit, 503)
        await db.$executeRaw`UPDATE audit_verifier_executions SET detail = ${JSON.stringify(failed)}::jsonb
          WHERE "auditId" = ${audit.id} AND "targetKey" = 'module:page-response'`
        const artifact = { kind: 'check', version: 1, collectedAt: failed.execution!.collectedAt, data: { flags, receipt: failed } }
        await db.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = ${JSON.stringify(artifact)}::jsonb
          WHERE id = ${failed.execution!.taskId}`
        await db.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,document,status}', '503')
          WHERE id = ${'collector-' + audit.id}`
        const observations = { version: 1, items: [{ source: 'DETERMINISTIC', checkId: 'page-http-error',
          checkVersion: CHECK_REGISTRY['page-http-error'].version, pageUrl: audit.url, evidence: flags[0].evidence,
          provenance: { auditId: audit.id, taskId: failed.execution!.taskId, collectedAt: failed.execution!.collectedAt } }] }
        await db.$executeRaw`INSERT INTO flags VALUES (${'response-' + audit.id}, ${audit.id}, 'page-http-error', 'DETERMINISTIC',
          1, ${audit.completedAt}, ${JSON.stringify(observations)}::jsonb)`
      }
      const pageRelease = { ...dataset, issues: [{ ...dataset.issues[0], checkId: 'page-http-error',
        checkVersion: CHECK_REGISTRY['page-http-error'].version }] }
      const pageManifest = { ...manifest, sources: [...sources, { ...sources[0], auditId: 'repeat-audit' }] }
      const preflightPage = (inputManifest: unknown = pageManifest) =>
        preflightResearchRelease({ release: pageRelease, manifest: inputManifest, now: checkedAt }, db)
      const pageCheck = await preflightPage()
      expect(await draft(pageManifest, 'page-http-error')).toMatchObject({ status: 'reviewable-draft',
        draft: { sampleSiteCount: 20, issue: { siteCount: 20 }, pageResponseCoverage: covered } })
      expect(pageCheck).toMatchObject({ status: 'source-and-version-checks-passed', pageResponseCoverage: covered })
      expect(JSON.stringify(pageCheck)).not.toMatch(/synthetic|audit0|https:/)
      if (pageCheck.status !== 'source-and-version-checks-passed' || !pageCheck.evidenceSha256) {
        throw new Error('Expected reviewed page-response evidence')
      }
      const reviewedPage = { ...pageManifest, reviewedInputSha256: pageCheck.inputSha256, reviewedEvidenceSha256: pageCheck.evidenceSha256 }
      const storeArtifact = (path: string, payload: object) => db.$executeRaw`
        UPDATE graph_artifact SET payload = ${JSON.stringify(payload)}::jsonb WHERE path = ${path}`
      await storeArtifact(PUBLIC_RESEARCH_PATH, pageRelease)
      await storeArtifact(RESEARCH_PERMISSIONS_PATH, reviewedPage)
      expect(await getPublicIssueLibrary()).toMatchObject([{ checkId: 'page-http-error', siteCount: 20 }])
      expect(await getIssuePage('page-http-error')).not.toBeNull()
      expect(await getIndexableIssueCheckIds()).toMatchObject([{ checkId: 'page-http-error', siteCount: 20 }])
      await setRedirects('audit0', ['https://synthetic0.example/', 'https://outside.example/'])
      expect(await preflightPage()).toMatchObject({ status: 'declared-versions-unverified', pageResponseCoverage: covered })
      expect(await draft(pageManifest, 'page-http-error')).toMatchObject({ status: 'current-version-evidence-unverified' })
      expect(await getPublicIssueLibrary()).toEqual([])
      await setRedirects('audit0', ['https://synthetic0.example/', 'https://synthetic0.example/retry'])
      expect(await preflightPage()).toMatchObject({ status: 'source-and-version-checks-passed', pageResponseCoverage: covered })
      expect(await preflightPage(reviewedPage)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      await setRedirects('audit0', [])
      expect(await preflightPage(reviewedPage)).toEqual(pageCheck)
      const assignOwner = async (userId: string) => {
        await db.$executeRaw`UPDATE projects SET "userId" = ${userId} WHERE id = 'project1'`
        await db.$executeRaw`UPDATE audits SET "userId" = ${userId} WHERE id = 'audit1'`
        await db.$executeRaw`UPDATE site_lifecycle_events SET "userId" = ${userId} WHERE "projectId" = 'project1'`
      }
      await assignOwner('owner0')
      expect(await readiness()).toMatchObject({ checkedIssueCohorts: false, independenceFloorMet: false,
        counts: { eligibleSites: 20 }, candidates: [] })
      expect(await coverage()).toMatchObject({ status: 'sample-below-minimum', observedSites: null })
      expect(await preflightPage()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
      expect(await getPublicIssueLibrary()).toEqual([])
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await assignOwner('owner1')
      expect(await getPublicIssueLibrary()).toMatchObject([{ checkId: 'page-http-error', siteCount: 20 }])
      const failed = makePageReceipt(coverageAudit, 503)
      await setPageReceipt(stored)
      expect(await preflightPage()).toMatchObject({ status: 'declared-versions-unverified', issuesWithCorroboratedVersions: 0,
        pageResponseCoverage: covered })
      expect(await getPublicIssueLibrary()).toEqual([])
      await setPageReceipt(failed)
      const originalOutput = makePageResult(coverageAudit, 503).flags
      const setEmittedFlags = (flags: unknown[]) => db.$executeRaw`
        UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,flags}', ${JSON.stringify(flags)}::jsonb)
        WHERE id = ${failed.execution!.taskId}`
      for (const flags of [[], [{ ...originalOutput[0], checkId: 'page-redirect-loop' }],
        [{ ...originalOutput[0], evidence: 'A different failure' }]]) {
        await setEmittedFlags(flags)
        expect(await preflightPage()).toMatchObject({ status: 'declared-versions-unverified', issuesWithCorroboratedVersions: 0,
          pageResponseCoverage: covered })
        expect(await getIssuePage('page-http-error')).toBeNull()
      }
      await setEmittedFlags(originalOutput)
      await setEmittedFlags([{ ...originalOutput[0], fix: 'Revised task guidance' }])
      expect(await preflightPage()).toMatchObject({ status: 'source-and-version-checks-passed', pageResponseCoverage: covered })
      expect(await preflightPage(reviewedPage)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await setEmittedFlags(originalOutput)
      await setPageReceipt({ ...failed, execution: { ...failed.execution, collectedAt: checkedAt.toISOString() } })
      expect(await preflightPage()).toMatchObject({ status: 'declared-versions-unverified',
        issuesWithCorroboratedVersions: 0, evidenceSha256: null,
        pageResponseCoverage: { status: 'observations-below-minimum', observedSites: null } })
      expect(await getPublicIssueLibrary()).toEqual([])
      expect(await getIssuePage('page-http-error')).toBeNull()
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await setPageReceipt(failed)
      const repeatReceipt = makePageReceipt(coverageAudits.find(audit => audit.id === 'repeat-audit')!, 200)
      await db.$executeRaw`UPDATE audit_verifier_executions SET detail = jsonb_set(detail, '{assertions,0,observed}', '"revised observation"')
        WHERE "taskId" = ${repeatReceipt.execution!.taskId}`
      expect(await preflightPage(reviewedPage)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await preflightPage()).toMatchObject({ status: 'source-and-version-checks-passed', pageResponseCoverage: covered })
      expect(await getPublicIssueLibrary()).toEqual([])
      await db.$executeRaw`UPDATE audit_verifier_executions SET detail = ${JSON.stringify(repeatReceipt)}::jsonb
        WHERE "taskId" = ${repeatReceipt.execution!.taskId}`
      expect(await preflightPage(reviewedPage)).toEqual(pageCheck)
      expect(await getPublicIssueLibrary()).toMatchObject([{ checkId: 'page-http-error', siteCount: 20 }])
      await storeArtifact(PUBLIC_RESEARCH_PATH, dataset)
      await storeArtifact(RESEARCH_PERMISSIONS_PATH, manifest)
      await db.$executeRaw`DELETE FROM flags WHERE "checkId" = 'page-http-error'`

      const releaseCheck = await preflight()
      expect(releaseCheck).toMatchObject({
        status: 'source-and-version-checks-passed', issuesWithCorroboratedVersions: 1,
        sampleSites: 20, databaseWritten: false, published: false, inputSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
      if (releaseCheck.status !== 'source-and-version-checks-passed' || !releaseCheck.evidenceSha256) throw new Error('Expected a passing fixture preflight')
      const reviewedManifest = { ...manifest, reviewedInputSha256: releaseCheck.inputSha256, reviewedEvidenceSha256: releaseCheck.evidenceSha256 }
      expect(await getPublicIssueLibrary()).toEqual([])
      const setManifest = async (payload: object) => db.$executeRaw`
        UPDATE graph_artifact SET payload = ${JSON.stringify(payload)}::jsonb WHERE path = ${RESEARCH_PERMISSIONS_PATH}`
      const inputOnlyManifest = { ...manifest, reviewedInputSha256: releaseCheck.inputSha256 }
      await setManifest(inputOnlyManifest)
      expect(await preflight(inputOnlyManifest)).toMatchObject({ status: 'review-digests-incomplete' })
      expect(await getPublicIssueLibrary()).toEqual([])
      await setManifest(reviewedManifest)
      expect(await preflight(reviewedManifest)).toEqual(releaseCheck)
      const library = await getPublicIssueLibrary()
      expect(library).toMatchObject([{ checkId: 'security-headers-missing', siteCount: 20, occurrenceCount: 20, examples: [] }])
      expect(JSON.stringify(library)).not.toMatch(/synthetic-test|project0|owner0|audit0/)
      expect(JSON.stringify(library)).not.toContain(releaseCheck.inputSha256)
      expect(JSON.stringify(library)).not.toContain(releaseCheck.evidenceSha256)
      expect(await getIndexableIssueCheckIds()).toMatchObject([{ checkId: 'security-headers-missing', siteCount: 20 }])
      const framework = { name: 'Next.js', siteCount: 20 }
      const frameworkRelease = { ...dataset, issues: [{ ...dataset.issues[0], topFrameworks: [framework] }] }
      await db.$executeRaw`INSERT INTO graph_technology VALUES ('framework-fixture', 'Next.js', 'framework')`
      await db.$executeRaw`
        UPDATE audits SET "technologyDetectionStatus" = 'PARTIAL', "technologyDetectedAt" = "completedAt",
          "technologyDetectorVersion" = 'fixture-v1', "technologyObservationScope" =
            jsonb_build_object('pageUrl', url, 'finalUrl', url, 'profile', 'desktop-v1', 'access', 'public')
        WHERE id LIKE 'audit%'
      `
      await db.$executeRaw`
        INSERT INTO audit_technology_observation SELECT 'technology-' || id, id, 'framework-fixture', 0.95,
          "technologyDetectorVersion", "technologyDetectedAt" FROM audits WHERE id LIKE 'audit%'
      `
      const frameworkCheck = (privateManifest: unknown = manifest) =>
        preflightResearchRelease({ release: frameworkRelease, manifest: privateManifest, now: checkedAt }, db)
      const reviewedFramework = await frameworkCheck()
      if (reviewedFramework.status !== 'source-and-version-checks-passed' || !reviewedFramework.evidenceSha256) {
        throw new Error('Expected an eligible framework capture')
      }
      const frameworkManifest = { ...manifest, reviewedInputSha256: reviewedFramework.inputSha256,
        reviewedEvidenceSha256: reviewedFramework.evidenceSha256 }
      await storeArtifact(PUBLIC_RESEARCH_PATH, frameworkRelease)
      await setManifest(frameworkManifest)
      expect(await getPublicIssueLibrary()).toMatchObject([{ topFrameworks: [framework] }])
      const setFrameworkLanding = (url: string) => db.$executeRaw`
        UPDATE audits SET "technologyObservationScope" = jsonb_set("technologyObservationScope", '{finalUrl}', to_jsonb(${url}::text))
        WHERE id = 'audit1'`
      await setFrameworkLanding('https://outside.example/')
      expect(await frameworkCheck()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
      expect(await getPublicIssueLibrary()).toEqual([])
      await setFrameworkLanding('https://synthetic1.example/welcome')
      expect(await frameworkCheck(frameworkManifest)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await setFrameworkLanding('https://synthetic1.example/')
      expect(await getPublicIssueLibrary()).toMatchObject([{ topFrameworks: [framework] }])
      await storeArtifact(PUBLIC_RESEARCH_PATH, dataset)
      await setManifest(reviewedManifest)
      const publicSpec = { version: 1, environment: 'production', scope: 'SITE',
        scanAccess: { kind: 'public', origin: 'https://synthetic1.example' } }
      for (const { spec, encrypted } of [
        { spec: null, encrypted: null },
        { spec: { ...publicSpec, scanAccess: undefined }, encrypted: null },
        { spec: { ...publicSpec, environment: 'preview' }, encrypted: null },
        { spec: { ...publicSpec, scanAccess: { kind: 'explicit' } }, encrypted: 'protected-fixture' },
        { spec: { ...publicSpec, scanAccess: { kind: 'project' } }, encrypted: null },
        { spec: publicSpec, encrypted: 'legacy-protected-fixture' },
        { spec: { ...publicSpec, scope: 'ACCOUNT_CHECKS' }, encrypted: null },
        { spec: { ...publicSpec, scope: 'FIXTURE_SETUP' }, encrypted: null },
      ]) {
        await db.$executeRaw`UPDATE audits SET "executionSpec" = ${spec ? JSON.stringify(spec) : null}::jsonb,
          "scanAccessEncrypted" = ${encrypted} WHERE id = 'audit1'`
        expect(await preflight()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
        expect(await getPublicIssueLibrary()).toEqual([])
        expect(await getIssuePage('security-headers-missing')).toBeNull()
        expect(await getIndexableIssueCheckIds()).toEqual([])
        expect(await readiness()).toMatchObject({ checkedIssueCohorts: false, candidates: [], counts: { eligibleSites: 19 } })
      }
      await db.$executeRaw`UPDATE audits SET "executionSpec" = ${JSON.stringify(publicSpec)}::jsonb, "scanAccessEncrypted" = NULL WHERE id = 'audit1'`
      expect(await getPublicIssueLibrary()).toEqual(library)
      const setObservationPage = async (page: string) => {
        await db.$executeRaw`
          UPDATE flags SET "supportingObservations" = jsonb_set("supportingObservations", '{items,0,pageUrl}', to_jsonb(${page}::text))
          WHERE id = 'flag1'`
        await db.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,flags,0,pageUrl}', to_jsonb(${page}::text))
          WHERE id = 'task-audit1'`
      }
      const setModuleReceipt = (module: string, page: string) => db.$executeRaw`
        UPDATE audit_verifier_executions SET "targetKey" = ${'module:' + module}, "pageUrl" = ${page},
          detail = jsonb_set(jsonb_set(detail, '{module}', to_jsonb(${module}::text)), '{pageUrl}', to_jsonb(${page}::text))
        WHERE "auditId" = 'audit1' AND "taskId" = 'task-audit1'`
      const subpage = 'https://synthetic1.example/about'
      await setObservationPage(subpage)
      for (const [module, receiptPage, observationPage] of [
        ['security-headers', 'https://synthetic1.example/contact', subpage],
        ['metadata', subpage, subpage],
        ['security-headers', 'https://outside.example/', 'https://outside.example/'],
        ['security-headers', subpage + '?preview=synthetic', subpage + '?preview=synthetic'],
        ['security-headers', subpage + '/..%2felsewhere', subpage + '/..%2felsewhere'],
      ]) {
        await setObservationPage(observationPage)
        await setModuleReceipt(module, receiptPage)
        expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified' })
        expect(await getPublicIssueLibrary()).toEqual([])
        expect(await getIndexableIssueCheckIds()).toEqual([])
        expect((await readiness()).candidates[0].corroboratedVersions).toEqual([])
      }
      await setObservationPage(subpage)
      await setModuleReceipt('security-headers', subpage)
      expect(await preflight(reviewedManifest)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await getPublicIssueLibrary()).toEqual([])
      const revised = await preflight()
      if (revised.status !== 'source-and-version-checks-passed' || !revised.evidenceSha256) throw new Error('Expected valid subpage evidence')
      expect(revised.inputSha256).toBe(releaseCheck.inputSha256)
      expect(revised.evidenceSha256).not.toBe(releaseCheck.evidenceSha256)
      await setManifest({ ...reviewedManifest, reviewedEvidenceSha256: revised.evidenceSha256 })
      expect(await getPublicIssueLibrary()).toEqual(library)
      await setObservationPage('https://synthetic1.example/')
      await db.$executeRaw`UPDATE flags SET "supportingObservations" = "supportingObservations" #- '{items,0,pageUrl}' WHERE id = 'flag1'`
      await setModuleReceipt('security-headers', 'https://synthetic1.example/')
      await setManifest(reviewedManifest)
      expect(await preflight(reviewedManifest)).toEqual(releaseCheck)

      await db.$executeRaw`UPDATE flags SET id = 'replaced-flag' WHERE id = 'flag1'`
      expect(await preflight(reviewedManifest)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await db.$executeRaw`UPDATE flags SET id = 'flag1' WHERE id = 'replaced-flag'`
      await db.$executeRaw`UPDATE audit_verifier_executions SET detail = detail || '{"passed":false}'::jsonb WHERE "taskId" = 'task-audit1'`
      expect(await preflight(reviewedManifest)).toMatchObject({ status: 'reviewed-evidence-digest-mismatch' })
      expect(await getIssuePage('security-headers-missing')).toBeNull()
      await db.$executeRaw`UPDATE audit_verifier_executions SET detail = detail - 'passed' WHERE "taskId" = 'task-audit1'`
      expect(await getPublicIssueLibrary()).toEqual(library)
      const setRelease = async (payload: object) => db.$executeRaw`
        UPDATE graph_artifact SET payload = ${JSON.stringify(payload)}::jsonb WHERE path = ${PUBLIC_RESEARCH_PATH}`
      await setRelease({ ...dataset, issues: [{ ...dataset.issues[0], fixTemplate: 'Revised repair instructions.' }] })
      expect(await getIssuePage('security-headers-missing')).toBeNull()
      await setRelease(dataset)
      expect(await preflight({ ...manifest, evidenceRef: 'wrong-release' })).toMatchObject({
        status: 'invalid-or-mismatched-manifest',
      })
      const substituted = { ...manifest, sources: [{ ...sources[0], auditId: 'repeat-audit' }, ...sources.slice(1)] }
      expect(await preflight(substituted))
        .toMatchObject({ status: 'declared-versions-unverified', issuesWithCorroboratedVersions: 0 })
      const setAlternateVersion = async (version: number) => {
        await db.$executeRaw`UPDATE flags
          SET "supportingObservations" = jsonb_set("supportingObservations", '{items,0,checkVersion}', to_jsonb(${version}::int))
          WHERE id = 'private-repeat'`
        await db.$executeRaw`UPDATE audit_verifier_executions
          SET detail = jsonb_set(detail, '{execution,checkVersions,security-headers-missing}', to_jsonb(${version}::int))
          WHERE "auditId" = 'repeat-audit'`
      }
      await setAlternateVersion(1)
      const alternateCheck = await preflight(substituted)
      expect(alternateCheck).toMatchObject({ status: 'source-and-version-checks-passed', sampleSites: 20, issuesWithCorroboratedVersions: 1 })
      if (alternateCheck.status !== 'source-and-version-checks-passed') throw new Error('Expected a passing alternate preflight')
      expect(alternateCheck.inputSha256).not.toBe(releaseCheck.inputSha256)
      const borrowedReview = { ...substituted, reviewedInputSha256: reviewedManifest.reviewedInputSha256 }
      expect(await preflight(borrowedReview)).toMatchObject({ status: 'reviewed-input-digest-mismatch' })
      await setManifest(borrowedReview)
      expect(await getIndexableIssueCheckIds()).toEqual([])
      await setManifest(reviewedManifest)
      await setAlternateVersion(2)
      expect(await getPublicIssueLibrary()).toEqual(library)
      await db.$executeRaw`UPDATE audit_verifier_executions SET "createdAt" = ${new Date(end.getTime() + 1)} WHERE "auditId" = 'audit0'`
      expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified' })
      expect(await getIssuePage('security-headers-missing')).toBeNull()
      await db.$executeRaw`UPDATE audit_verifier_executions SET "createdAt" = ${source.completedAt} WHERE "auditId" = 'audit0'`

      const inputDirectory = mkdtempSync(join(tmpdir(), 'fixflags-research-preflight-'))
      try {
        const releasePath = join(inputDirectory, 'release.json')
        const manifestPath = join(inputDirectory, 'manifest.json')
        const draftManifestPath = join(inputDirectory, 'unreviewed-manifest.json')
        writeFileSync(releasePath, JSON.stringify(dataset), { mode: 0o600 })
        writeFileSync(manifestPath, JSON.stringify(reviewedManifest), { mode: 0o600 })
        writeFileSync(draftManifestPath, JSON.stringify(manifest), { mode: 0o600 })
        const prepared = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/prepare-research-draft.ts',
          draftManifestPath, 'security-headers-missing', windowStart.toISOString(), end.toISOString()], {
          env: { ...process.env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 15_000,
        })
        expect(prepared.status).toBe(0)
        expect(prepared.stderr).toBe('')
        expect(JSON.parse(prepared.stdout)).toMatchObject({ status: 'reviewable-draft', draft: reviewable.draft })
        expect(prepared.stdout).not.toMatch(/synthetic-test|project0|owner0|audit0|manifest\.json/)
        const run = (args: string[], database: string) => spawnSync(process.execPath,
          ['--import', 'tsx', 'scripts/growth/validate-public-research.ts', releasePath, ...args],
          { env: { ...process.env, DATABASE_URL: database }, encoding: 'utf8', timeout: 15_000 })
        const shapeOnly = run([], 'not-a-database')
        expect(shapeOnly.status).toBe(0)
        expect(JSON.parse(shapeOnly.stdout)).toMatchObject({ status: 'valid-local-artifact', permissionsVerified: false })
        const checked = run(['--manifest', manifestPath], url.toString())
        expect(checked.status).toBe(0)
        expect(checked.stderr).toBe('')
        expect(JSON.parse(checked.stdout)).toEqual({ ...releaseCheck, checkedAt: expect.any(String) })
        expect(checked.stdout).not.toMatch(/synthetic-test|project0|owner0|audit0|manifest\.json/)
      } finally {
        rmSync(inputDirectory, { recursive: true, force: true })
      }
      await db.$executeRaw`
        UPDATE flags
        SET "supportingObservations" = jsonb_insert("supportingObservations", '{items,1}',
          jsonb_set("supportingObservations"#>'{items,0}', '{checkVersion}', '2'::jsonb))
        WHERE id = 'flag0'
      `
      expect((await readiness()).candidates[0].corroboratedVersions).toEqual([])
      await db.$executeRaw`UPDATE flags SET "supportingObservations" = "supportingObservations" #- '{items,1}' WHERE id = 'flag0'`
      await db.$executeRaw`UPDATE audit_verifier_executions SET "taskId" = 'unrelated' WHERE "auditId" = 'audit1'`
      expect((await readiness()).candidates).toMatchObject([
        { affectedSites: 20, observations: 21, corroboratedVersions: [] },
      ])
      expect(await preflight()).toMatchObject({ status: 'declared-versions-unverified' })
      expect(await getIndexableIssueCheckIds()).toEqual([])
      expect(await getIssuePage('security-headers-missing')).toBeNull()
      await db.$executeRaw`UPDATE audit_verifier_executions SET "taskId" = 'task-audit1' WHERE "auditId" = 'audit1'`

      const first = { projectId: 'project0', userId: 'owner0' }
      await expect(saveResearchConsent({ ...first, userId: 'foreign' }, { enabled: false })).rejects.toMatchObject({ status: 404 })
      expect(await getPublicIssueLibrary()).toHaveLength(1)
      const discoveryPaths = async () => (await sitemap()).map(entry => ({
        path: new URL(entry.url).pathname, lastModified: entry.lastModified,
      }))
      const issuePath = '/issues/security-headers-missing'
      expect(await discoveryPaths()).toEqual(expect.arrayContaining([
        { path: '/issues', lastModified: new Date(dataset.reviewedAt) },
        { path: issuePath, lastModified: new Date(dataset.reviewedAt) },
      ]))
      const approvedSitemap = await getSitemap()
      expect(approvedSitemap.headers.get('cache-control')).toBe('no-store')
      expect(await approvedSitemap.text()).toContain(`${issuePath}</loc>`)
      const approvedDiscovery = await getLlmsTxt()
      expect(approvedDiscovery.headers.get('cache-control')).toBe('no-store')
      expect(await approvedDiscovery.text()).toContain(`${issuePath})`)

      const accountOwner = { projectId: 'project1', userId: 'owner1' }
      const expectPriorGrantWithheld = async () => {
        expect((await loadResearchConsent(accountOwner)).enabled).toBe(false)
        expect(await getPublicIssueLibrary()).toEqual([])
        expect(await getIssuePage('security-headers-missing')).toBeNull()
        expect((await discoveryPaths()).filter(entry => entry.path.startsWith('/issues'))).toEqual([])
        expect(await (await getLlmsTxt()).text()).not.toContain(`${issuePath})`)
        expect(await preflight()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
        expect(await readiness()).toMatchObject({ checkedIssueCohorts: false,
          counts: { activeScopedGrants: 19, eligibleSites: 19 } })
      }
      let queuedOptIn: Promise<unknown> | undefined
      await db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE users SET "lifecycleStatus" = 'SUSPENDED', "lifecycleRevision" = 1 WHERE id = 'owner1'`
        queuedOptIn = saveResearchConsent(accountOwner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
          .catch(error => error)
        await vi.waitFor(async () => {
          const [row] = await tx.$queryRaw<Array<{ waiting: boolean }>>`
            SELECT EXISTS (
              SELECT 1 FROM pg_locks blocked JOIN pg_locks blocker USING (transactionid)
              WHERE blocked.locktype = 'transactionid' AND NOT blocked.granted AND blocker.granted
                AND blocker.pid = pg_backend_pid()
            ) AS waiting`
          expect(row.waiting).toBe(true)
        }, { timeout: 2_000 })
      })
      expect(await queuedOptIn).toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
      await expectPriorGrantWithheld()
      await expect(saveResearchConsent(accountOwner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION }))
        .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
      await db.$executeRaw`UPDATE users SET "lifecycleStatus" = 'ACTIVE', "lifecycleRevision" = 2 WHERE id = 'owner1'`
      await expectPriorGrantWithheld()
      expect((await saveResearchConsent(accountOwner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).enabled).toBe(true)
      expect(await preflight()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
      expect(await readiness()).toMatchObject({ counts: { activeScopedGrants: 20, eligibleSites: 19 } })
      await db.$executeRaw`UPDATE users SET "lifecycleStatus" = 'DELETING', "lifecycleRevision" = 3 WHERE id = 'owner1'`
      await expectPriorGrantWithheld()
      // Restore fixture data to exercise explicit withdrawal independently.
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE "projectId" = 'project1' AND id <> ${sources[1].grantId}`
      await db.$executeRaw`UPDATE users SET "lifecycleStatus" = 'ACTIVE', "lifecycleRevision" = 0 WHERE id = 'owner1'`
      expect(await getPublicIssueLibrary()).toHaveLength(1)

      await db.$executeRaw`UPDATE projects SET url = 'https://synthetic1.example/other', "watchTargetRevision" = 2 WHERE id = 'project1'`
      await expectPriorGrantWithheld()
      await db.$executeRaw`UPDATE projects SET url = 'https://synthetic1.example/', "watchTargetRevision" = 3 WHERE id = 'project1'`
      await expectPriorGrantWithheld()
      expect((await saveResearchConsent(accountOwner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).enabled).toBe(true)
      expect(await preflight()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
      expect(await readiness()).toMatchObject({ counts: { activeScopedGrants: 20, eligibleSites: 19 } })
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE "projectId" = 'project1' AND id <> ${sources[1].grantId}`
      await db.$executeRaw`UPDATE projects SET "watchTargetRevision" = 1 WHERE id = 'project1'`
      expect(await getPublicIssueLibrary()).toHaveLength(1)

      await db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE projects SET "deletedAt" = NOW() WHERE id = 'project1'`
        await withdrawResearchConsentForSiteRemoval(tx, accountOwner)
      })
      expect(await getPublicIssueLibrary()).toEqual([])
      await db.$executeRaw`UPDATE projects SET "deletedAt" = NULL WHERE id = 'project1'`
      await expectPriorGrantWithheld()
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE "projectId" = 'project1' AND id <> ${sources[1].grantId}`
      expect(await getPublicIssueLibrary()).toHaveLength(1)

      await saveResearchConsent(first, { enabled: false })
      await db.siteLifecycleEvent.updateMany({
        where: { projectId: first.projectId, properties: { path: ['enabled'], equals: false } },
        data: { createdAt: new Date(end.getTime() + 1) },
      })
      expect((await loadResearchConsent(first)).enabled).toBe(false)
      expect(await getPublicIssueLibrary()).toEqual([])
      expect((await discoveryPaths()).filter(entry => entry.path.startsWith('/issues'))).toEqual([])
      const withdrawnSitemap = await getSitemap()
      expect(withdrawnSitemap.headers.get('cache-control')).toBe('no-store')
      expect(await withdrawnSitemap.text()).not.toContain(`${issuePath}</loc>`)
      const withdrawnDiscovery = await (await getLlmsTxt()).text()
      expect(withdrawnDiscovery).not.toContain(`${issuePath})`)
      expect(withdrawnDiscovery).not.toContain('/issues)')
      expect(withdrawnDiscovery).toContain('/docs)')
      expect(await preflight()).toMatchObject({ status: 'current-sources-or-counts-unverified' })
      expect(await readiness()).toMatchObject({ checkedIssueCohorts: false, candidates: [],
        counts: { activeScopedGrants: 19, eligibleAudits: 19, eligibleSites: 19 } })
      await saveResearchConsent(first, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
      expect(await getPublicIssueLibrary()).toEqual([])
      expect(await readiness()).toMatchObject({ checkedIssueCohorts: false, candidates: [],
        counts: { activeScopedGrants: 20, eligibleAudits: 19, eligibleSites: 19 } })
      await admin.$executeRawUnsafe(`UPDATE "${schema}".projects SET "deletedAt" = NOW() WHERE id = 'project1'`)
      await expect(loadResearchConsent({ projectId: 'project1', userId: 'owner1' })).rejects.toMatchObject({ status: 404 })
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
