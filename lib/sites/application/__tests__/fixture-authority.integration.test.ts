import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import * as screenshots from '@/lib/audit/screenshot'
import { createOutcomeFixture, updateOutcomeFixture, authorizeOutcomeFixture, listOutcomeFixtures, revokeOutcomeFixture, deleteOutcomeFixture, dryRunOutcomeFixture } from '../outcome-fixtures'
import { executeSafeFormFixture, reconcileSafeFixtureCleanup } from '../safe-form-executor'
import { loadOutcomeBindingRevisions } from '../outcome-binding-revisions'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { confirmSiteOutcome, createSiteOutcome } from '../outcome-commands'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Safe Form fixture ownership', () => {
  const users: string[] = []
  const observedOperations: string[] = []
  let origin = '', requests = 0
  const server = createServer(async (request, response) => {
    requests++
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (typeof body.operationId === 'string') observedOperations.push(body.operationId)
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ ok: true, operationId: body.operationId, settled: true }))
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  })
  afterEach(async () => {
    vi.restoreAllMocks(); vi.unstubAllEnvs(); requests = 0; observedOperations.length = 0
    await prisma.audit.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
  })
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await prisma.$disconnect() })
  async function owner() {
    const user = await prisma.user.create({ data: { email: randomUUID() + '@fixture.test', role: 'admin' } })
    users.push(user.id); return user
  }
  const input = (url: string) => ({ name: 'Synthetic signup', targetUrl: url + '/signup',
    fieldMapping: { fields: { email: { by: 'label' as const, value: 'Email' } }, submit: { by: 'role' as const, role: 'button' as const, value: 'Submit' } },
    values: { email: 'synthetic@example.test' }, successCriterion: { type: 'text' as const, value: 'Welcome' },
    resetUrl: url + '/reset', cleanupUrl: url + '/cleanup' })
  async function fixture(url = 'https://example.com') {
    const user = await owner()
    const project = await prisma.project.create({ data: { userId: user.id, name: 'Fixture authority', canonicalHost: randomUUID() + '.example.test', url: url + '/' } })
    const { values, ...configuration } = input(url)
    const row = await prisma.outcomeFixture.create({ data: { ...configuration, projectId: project.id, configuredByUserId: user.id,
      encryptedValues: encryptSecret(JSON.stringify(values)), authorizedAt: new Date(), lastDryRunVersion: 1,
      lastDryRunResult: { disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 1, cleanupStatus: 'succeeded' } } } })
    return { user, project, row }
  }
  it('refuses a former owner at the fixture creation write', async () => {
    const { user, project } = await fixture(), replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    const stale = { projectId: project.id, userId: user.id, fixture: input('https://example.com') }
    await expect(createOutcomeFixture(stale)).rejects.toMatchObject({ code: 'SITE_NOT_FOUND' })
    expect(await prisma.outcomeFixture.count({ where: { projectId: project.id } })).toBe(1)
  })
  it('refuses a former owner at the fixture authorization write', async () => {
    const { user, project, row } = await fixture(), replacement = await owner()
    await prisma.outcomeFixture.update({ where: { id: row.id }, data: { authorizedAt: null } })
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    await expect(authorizeOutcomeFixture(project.id, row.id, user.id)).rejects.toMatchObject({ code: 'SITE_NOT_FOUND' })
    expect((await prisma.outcomeFixture.findUniqueOrThrow({ where: { id: row.id } })).authorizedAt).toBeNull()
  })
  it('does not lend authorization or native hook calls to the new owner', async () => {
    const { project, row } = await fixture(origin), replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const browser = vi.spyOn(screenshots, 'getBrowser').mockRejectedValue(new Error('Controlled browser boundary'))
    expect(await executeSafeFormFixture({ projectId: project.id, fixtureId: row.id, startUrl: row.targetUrl, allowLocalhost: true }))
      .toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_not_authorized' })
    expect(requests).toBe(0)
    expect(browser).not.toHaveBeenCalled()
    expect((await listOutcomeFixtures(project.id))[0]).toMatchObject({ authorizedAt: null, lastDryRunVersion: null })
    expect((await prisma.outcomeFixture.findUniqueOrThrow({ where: { id: row.id } })).authorizedAt).toEqual(row.authorizedAt)
  })
  it.each(['update', 'revoke', 'delete'] as const)('refuses a former owner at the fixture %s write', async action => {
    const { user, project, row } = await fixture(), replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    const write = action === 'update' ? updateOutcomeFixture({ projectId: project.id, fixtureId: row.id, userId: user.id, fixture: input('https://example.com') })
      : action === 'revoke' ? revokeOutcomeFixture(project.id, row.id, user.id) : deleteOutcomeFixture(project.id, row.id, user.id)
    await expect(write).rejects.toMatchObject({ code: 'SITE_NOT_FOUND' })
    expect(await prisma.outcomeFixture.findUniqueOrThrow({ where: { id: row.id } })).toEqual(row)
  })
  it.each(['SUSPENDED', 'DELETING'] as const)('refuses new %s permission but retains revocation and deletion', async lifecycleStatus => {
    const { user, project, row } = await fixture()
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus } })
    await expect(createOutcomeFixture({ projectId: project.id, userId: user.id, fixture: input('https://example.com') }))
      .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    await expect(updateOutcomeFixture({ projectId: project.id, fixtureId: row.id, userId: user.id, fixture: input('https://example.com') }))
      .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    await expect(authorizeOutcomeFixture(project.id, row.id, user.id)).rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    expect(await revokeOutcomeFixture(project.id, row.id, user.id)).toMatchObject({ authorizedAt: null, version: 2 })
    await deleteOutcomeFixture(project.id, row.id, user.id)
    expect(await prisma.outcomeFixture.findUnique({ where: { id: row.id } })).toBeNull()
  })
  it('validates executable origins against the current locked Site rather than a previous URL', async () => {
    const { user, project, row } = await fixture()
    await prisma.project.update({ where: { id: project.id }, data: { url: 'https://new.example.com/' } })
    await expect(updateOutcomeFixture({ projectId: project.id, fixtureId: row.id, userId: user.id, fixture: input('https://example.com') }))
      .rejects.toMatchObject({ code: 'FIXTURE_ORIGIN_MISMATCH' })
    expect(await prisma.outcomeFixture.findUniqueOrThrow({ where: { id: row.id } })).toEqual(row)
  })
  it('requires replacement configuration and a new dry run before restoring the new owner\'s permission', async () => {
    const { project, row } = await fixture(), replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    const revisions = () => loadOutcomeBindingRevisions([{ projectId: project.id, bindings: [{ key: 'signup', required: true,
      version: 1, mechanism: 'SAFE_FORM', config: { fixtureId: row.id } }] }])
    expect((await revisions())[0][0].fixture?.authorized).toBe(false)
    await expect(dryRunOutcomeFixture({ projectId: project.id, fixtureId: row.id, userId: replacement.id }))
      .rejects.toMatchObject({ code: 'FIXTURE_CHANGED', status: 409 })
    await expect(authorizeOutcomeFixture(project.id, row.id, replacement.id)).rejects.toMatchObject({ code: 'FIXTURE_CHANGED' })
    expect(await updateOutcomeFixture({ projectId: project.id, fixtureId: row.id, userId: replacement.id, fixture: input('https://example.com') }))
      .toMatchObject({ version: 2, authorizedAt: null, lastDryRunVersion: null, lastDryRunResult: null })
    expect(await prisma.outcomeFixture.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ configuredByUserId: replacement.id })
    await expect(authorizeOutcomeFixture(project.id, row.id, replacement.id)).rejects.toMatchObject({ code: 'FIXTURE_DRY_RUN_REQUIRED' })
    expect((await revisions())[0][0].fixture?.authorized).toBe(false)
  })
  it('refuses stale Outcome writes and binding permission from a former owner\'s fixture', async () => {
    const { project, row } = await fixture(), replacement = await owner()
    const originalSite = (await loadSiteRecord(project.id))!
    const outcome = await prisma.siteOutcome.create({ data: { projectId: project.id, slug: 'signup', name: 'Signup', kind: 'SIGNUP' } })
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect(await confirmSiteOutcome({ site: originalSite, outcomeId: outcome.id, confirmed: true, kind: 'SIGNUP', fixtureId: row.id })).toBeNull()
    expect(await createSiteOutcome({ site: originalSite, kind: 'AVAILABILITY', targetUrl: project.url })).toBeNull()
    const currentSite = (await loadSiteRecord(project.id))!
    await expect(confirmSiteOutcome({ site: currentSite, outcomeId: outcome.id, confirmed: true, kind: 'SIGNUP', fixtureId: row.id }))
      .rejects.toMatchObject({ name: 'OutcomeFixtureRequiredError' })
    expect((await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).confirmedAt).toBeNull()
    expect(await prisma.outcomeExecutionBinding.count({ where: { outcomeId: outcome.id } })).toBe(0)
  })
  it('preserves retained fixture data through the exact configuration-owner migration', async () => {
    const migration = await readFile(new URL('../../../../prisma/migrations/20261026180000_fixture_configuration_owner/migration.sql', import.meta.url), 'utf8')
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL search_path = pg_temp')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE users (id TEXT PRIMARY KEY) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE projects (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE outcome_fixtures (id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "encryptedValues" TEXT) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE audit_pipeline_events ("executionId" TEXT, event TEXT, detail JSONB, sequence BIGINT) ON COMMIT DROP')
      await tx.$executeRawUnsafe("INSERT INTO users VALUES ('owner-a')")
      await tx.$executeRawUnsafe("INSERT INTO projects VALUES ('site-a', 'owner-a')")
      await tx.$executeRawUnsafe("INSERT INTO outcome_fixtures VALUES ('fixture-a', 'site-a', 'retained-cipher')")
      for (const statement of migration.split(';').filter(statement => statement.trim())) await tx.$executeRawUnsafe(statement)
      expect(await tx.$queryRawUnsafe('SELECT * FROM outcome_fixtures'))
        .toEqual([{ id: 'fixture-a', projectId: 'site-a', encryptedValues: 'retained-cipher', configuredByUserId: 'owner-a' }])
      await tx.$executeRawUnsafe("DELETE FROM users WHERE id = 'owner-a'")
      expect(await tx.$queryRawUnsafe('SELECT "configuredByUserId" FROM outcome_fixtures')).toEqual([{ configuredByUserId: null }])
    })
  })
  it.each([true, false])('retains exact-operation cleanup after the owner becomes inactive without another submission (authorized: %s)', async requireAuthorization => {
    const { user, project, row } = await fixture(origin)
    if (!requireAuthorization) await prisma.outcomeFixture.update({ where: { id: row.id }, data: { authorizedAt: null } })
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const audit = await prisma.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url,
      status: 'COMPLETED', completedAt: new Date() } })
    const operationId = 'controlled-submission:g1'
    await prisma.auditPipelineEvent.create({ data: { auditId: audit.id, executionId: operationId, traceId: audit.id,
      stage: 'checking', status: 'started', attempt: 1, event: 'protected_submission_admitted',
      detail: { operationId, fixtureId: row.id, fixtureVersion: row.version } } })
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus: 'DELETING' } })
    expect(await executeSafeFormFixture({ projectId: project.id, fixtureId: row.id, startUrl: row.targetUrl, allowLocalhost: true }))
      .toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_not_authorized' })
    expect(requests).toBe(0)
    expect(await reconcileSafeFixtureCleanup({ projectId: project.id, fixtureId: row.id, version: row.version, requireAuthorization })).toBe(true)
    expect(requests).toBe(1)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'protected_submission_admitted' } })).toBe(1)
  })
  it.each(['audit', 'task'] as const)('does not borrow another %s\'s cleanup to replay an unsettled submission', async boundary => {
    const { user, project, row } = await fixture(origin)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const audit = await prisma.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED', completedAt: new Date() } })
    const other = boundary === 'audit' ? await prisma.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url,
      status: 'COMPLETED', completedAt: new Date() } }) : audit
    const submission = async (auditId: string, operationId: string, event = 'protected_submission_admitted') =>
      prisma.auditPipelineEvent.create({ data: { auditId, executionId: operationId, traceId: auditId, attempt: 1,
        stage: 'checking', status: event === 'protected_cleanup_completed' ? 'completed' : 'started', event,
        detail: { operationId, fixtureId: row.id, fixtureVersion: row.version } } })
    await submission(audit.id, 'original-task:g1')
    await submission(other.id, 'other-task:g1')
    await submission(other.id, 'other-task:g1', 'protected_cleanup_completed')
    await prisma.auditPipelineEvent.create({ data: { auditId: other.id, executionId: 'original-task:g1', traceId: other.id, attempt: 1,
      stage: 'checking', status: 'completed', event: 'protected_cleanup_completed',
      detail: { operationId: 'original-task:g1', fixtureId: row.id, fixtureVersion: row.version + 1 } } })
    expect(await reconcileSafeFixtureCleanup({ projectId: project.id, fixtureId: row.id, version: row.version })).toBe(true)
    expect(requests).toBe(1)
    expect(observedOperations).toEqual(['original-task:g1'])
    await submission(other.id, 'original-task:g1', 'protected_cleanup_completed')
    expect(await reconcileSafeFixtureCleanup({ projectId: project.id, fixtureId: row.id, version: row.version })).toBe(true)
    expect(requests).toBe(1)
  })
  it('bounds owed cleanup without certifying an uninspected remainder, then continues from recorded receipts', async () => {
    const { user, project, row } = await fixture(origin)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const audit = await prisma.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED', completedAt: new Date() } })
    const operationIds = ['first:g1', 'second:g1', 'third:g1']
    const record = (operationId: string, event: string) => prisma.auditPipelineEvent.create({ data: { auditId: audit.id,
      executionId: operationId, traceId: audit.id, attempt: 1, stage: 'checking', status: 'completed', event,
      detail: { operationId, fixtureId: row.id, fixtureVersion: row.version } } })
    for (const operationId of operationIds) await record(operationId, 'protected_submission_admitted')
    const reconcile = () => reconcileSafeFixtureCleanup({ projectId: project.id, fixtureId: row.id, version: row.version })
    expect(await reconcile()).toBe(false)
    expect(observedOperations).toEqual(operationIds.slice(0, 2))
    for (const operationId of observedOperations) await record(operationId, 'protected_cleanup_completed')
    expect(await reconcile()).toBe(true)
    expect(observedOperations).toEqual(operationIds)
  })
})
