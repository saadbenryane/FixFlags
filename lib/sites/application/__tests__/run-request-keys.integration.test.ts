import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadOwnedRunRequestByKey, loadRunRequestByKey, retainSharedRunKey } from '../run-request-keys'
import { requestSiteRun } from '../run-requests'
import { executionIntentHash } from '../execution-spec'
import * as runSelection from '../run-selection'
import type { ExecutionSpec } from '../../domain/execution-spec'

const enabled = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
enabled('durable keys on the existing Site request ledger', () => {
  let userId: string, projectId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'request-keys-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    projectId = (await prisma.project.create({ data: { userId, name: 'Replay keys', url: 'https://example.com/', canonicalHost: 'example.com' } })).id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.adminOperation.deleteMany({ where: { actorId: { in: [userId, userId + '-other'] } } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId + '-other'] } } })
  })
  const key = (idempotencyKey: string) => ({ projectId, source: 'WEB' as const, idempotencyKey })
  async function recorded(idempotencyKey = 'original', requestHash = 'same-intent') {
    return prisma.runRequest.create({ data: { projectId, source: 'WEB', idempotencyKey, requestedByUserId: userId,
      requestHash, status: 'COMPLETED', completedAt: new Date() } })
  }
  const join = (runRequestId: string, idempotencyKey = 'joined', requestHash = 'same-intent') =>
    retainSharedRunKey({ ...key(idempotencyKey), userId, runRequestId, cleanup: false }, run => run.requestHash === requestHash)

  it.each(['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC', 'FIXTURE_SETUP', 'ACCOUNT_CHECKS'] as const)('recovers an accepted %s receipt without current planning, configuration or another admission', async scope => {
    const targetUrl = 'https://example.com/'
    const outcome = scope === 'OUTCOMES' ? await prisma.siteOutcome.create({ data: {
      projectId, slug: 'recorded-checkout', name: 'Recorded checkout', kind: 'CHECKOUT', environment: 'production', enabled: false,
    } }) : null
    const spec: ExecutionSpec = { version: 1, engine: 'progressive-v1', targetUrl, environment: 'production', scope,
      checks: scope === 'FIXTURE_SETUP' ? {} : { 'title-missing': 1 }, outcomes: outcome ? [{ id: outcome.id, kind: outcome.kind,
        expectation: null, bindingPolicy: 'ALL_REQUIRED', bindings: [] }] : [],
      verificationTarget: scope === 'DIAGNOSTIC' ? { kind: 'DIAGNOSTIC', pageUrl: targetUrl, checkId: 'title-missing',
        attemptId: 'recorded-attempt', parentAuditId: 'recorded-parent' } : null,
      ...(scope === 'CATEGORY' ? { category: { area: 'search', sourceAuditId: 'recorded-source', pages: [targetUrl] } } : {}),
      ...(scope === 'FIXTURE_SETUP' ? { fixtureSetup: { id: 'retired-fixture', version: 1 } } : {}),
      ...(scope === 'ACCOUNT_CHECKS' ? { accountChecks: { revision: 1, mode: 'routine' } } : {}) }
    const audit = await prisma.audit.create({ data: { projectId, userId, url: targetUrl,
      executionSpec: spec, status: 'COMPLETED', completedAt: new Date() } })
    const run = await prisma.runRequest.create({ data: { projectId, source: 'WEB', idempotencyKey: 'accepted', requestedByUserId: userId,
      auditId: audit.id, executionSpec: spec, requestHash: executionIntentHash(spec), status: 'COMPLETED', completedAt: new Date(),
      ...(spec.verificationTarget ? { verificationTarget: spec.verificationTarget } : {}),
      ...(outcome ? { selections: { create: [{ outcomeId: outcome.id }] } } : {}) } })
    const planning = vi.spyOn(runSelection, 'resolveRunExecution').mockRejectedValue(new Error('Current planning unavailable'))
    const input = { projectId, userId, source: 'WEB' as const, scope: scope === 'DIAGNOSTIC' ? 'OUTCOMES' as const : scope, outcomeIds: outcome ? [outcome.id] : [],
      ...(scope === 'CATEGORY' ? { categoryArea: 'search' as const } : {}),
      ...(scope === 'FIXTURE_SETUP' ? { fixtureId: 'retired-fixture' } : {}), idempotencyKey: 'accepted' }
    if (spec.verificationTarget) Object.assign(input, { verificationTarget: spec.verificationTarget })
    expect(await requestSiteRun(input)).toEqual({ runId: run.id, auditId: audit.id, outcomeIds: input.outcomeIds, reused: true })
    expect(planning).not.toHaveBeenCalled()
    const different = scope === 'CATEGORY' ? { categoryArea: 'security' as const }
      : scope === 'FIXTURE_SETUP' ? { fixtureId: 'different-fixture' }
        : scope === 'OUTCOMES' ? { outcomeIds: ['different-outcome'] }
          : scope === 'DIAGNOSTIC' ? { verificationTarget: { ...spec.verificationTarget!, attemptId: 'different-attempt' } }
            : scope === 'ACCOUNT_CHECKS' ? { accountMode: 'retest' as const } : { url: targetUrl + 'different-page' }
    await expect(requestSiteRun({ ...input, ...different })).rejects.toMatchObject({ status: 409 })
    expect(planning).not.toHaveBeenCalled()
    await expect(requestSiteRun({ ...input, idempotencyKey: 'new-request' })).rejects.toThrow('Current planning unavailable')
    expect(planning).toHaveBeenCalledOnce()
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: run.id } })).toEqual(run)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(await prisma.audit.count({ where: { projectId } })).toBe(1)
  })

  it('registers original keys atomically and gives concurrent same-key joins one immutable winner', async () => {
    const original = await recorded(), other = await recorded('other')
    expect(await loadRunRequestByKey(key('original'))).toMatchObject({ id: original.id, keyRequestedByUserId: userId })
    const results = await Promise.all([join(original.id), join(other.id)])
    expect(results[0].id).toBe(results[1].id)
    expect(await prisma.runRequestKey.count({ where: { projectId, idempotencyKey: 'joined' } })).toBe(1)
    expect(await loadRunRequestByKey(key('joined'))).toMatchObject({ id: results[0].id })
    await expect(prisma.runRequestKey.update({ where: { projectId_source_idempotencyKey: key('joined') },
      data: { runRequestId: results[0].id === original.id ? other.id : original.id } })).rejects.toThrow('immutable')
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
  })

  it('refuses a competing intent instead of redirecting an already bound key', async () => {
    const original = await recorded(), other = await recorded('other', 'different-intent')
    const results = await Promise.allSettled([join(original.id), join(other.id, 'joined', 'different-intent')])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ status: 409 })
    expect(await prisma.runRequestKey.count({ where: { projectId, idempotencyKey: 'joined' } })).toBe(1)
  })

  it('keeps matching key strings independent across request sources', async () => {
    const original = await recorded(), other = await recorded('other', 'different-intent')
    await join(original.id)
    await retainSharedRunKey({ ...key('joined'), source: 'MCP', userId, runRequestId: other.id, cleanup: false },
      run => run.requestHash === 'different-intent')
    expect(await loadRunRequestByKey(key('joined'))).toMatchObject({ id: original.id })
    expect(await loadRunRequestByKey({ ...key('joined'), source: 'MCP' })).toMatchObject({ id: other.id })
  })

  it.each(['transfer', 'removal', 'suspension'] as const)('refuses a shared binding after an intervening %s', async change => {
    const original = await recorded()
    if (change === 'transfer') {
      await prisma.user.create({ data: { id: userId + '-other', email: userId + '-other@example.test' } })
      await prisma.project.update({ where: { id: projectId }, data: { userId: userId + '-other' } })
    } else if (change === 'removal') await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
    else await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
    await expect(join(original.id)).rejects.toMatchObject({ status: change === 'suspension' ? 403 : 404 })
    await expect(loadOwnedRunRequestByKey({ ...key('original'), userId, cleanup: false }))
      .rejects.toMatchObject({ status: change === 'suspension' ? 403 : 404 })
    expect(await prisma.runRequestKey.count({ where: { projectId, idempotencyKey: 'joined' } })).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
  })

  it('enforces the Site foreign key and rolls back an older writer colliding with a joined key', async () => {
    const original = await recorded()
    await join(original.id)
    const foreign = await prisma.project.create({ data: { userId, name: 'Other Site', canonicalHost: 'other.example.com', url: 'https://other.example.com/' } })
    await expect(prisma.runRequestKey.create({ data: { projectId: foreign.id, source: 'WEB', idempotencyKey: 'foreign', runRequestId: original.id } }))
      .rejects.toMatchObject({ code: 'P2003' })
    await expect(prisma.$transaction(async tx => {
      const audit = await tx.audit.create({ data: { userId, projectId, url: 'https://example.com/' } })
      // An older binary knows only the original RunRequest insert. Its trigger
      // must still reserve the same canonical key and roll back a collision.
      await tx.runRequest.create({ data: { projectId, source: 'WEB', idempotencyKey: 'joined', auditId: audit.id, status: 'COMPLETED' } })
    })).rejects.toMatchObject({ code: 'P2002' })
    expect(await prisma.audit.count({ where: { projectId } })).toBe(0)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(await loadRunRequestByKey(key('joined'))).toMatchObject({ id: original.id })
    await prisma.runRequest.delete({ where: { id: original.id } })
    expect(await prisma.runRequestKey.count({ where: { projectId } })).toBe(0)
  })

  it('backfills populated original requests using the shipped migration without changing their history', async () => {
    const original = await recorded()
    await prisma.runRequestKey.deleteMany({ where: { projectId } })
    const migration = readFileSync(new URL('../../../../prisma/migrations/20261101200100_run_request_keys/migration.sql', import.meta.url), 'utf8')
    const backfill = migration.match(/INSERT INTO "run_request_keys"[^;]+SELECT[^;]+ON CONFLICT[^;]+;/)?.[0]
    expect(backfill).toBeDefined()
    await prisma.$executeRawUnsafe(backfill!)
    expect(await loadRunRequestByKey(key('original'))).toMatchObject({ id: original.id, keyRequestedByUserId: userId })
    expect(await prisma.runRequestKey.findUniqueOrThrow({ where: { projectId_source_idempotencyKey: key('original') } }))
      .toMatchObject({ runRequestId: original.id, createdAt: original.requestedAt })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
  })

  it('permits actor erasure on a transferred Site without removing or redirecting its recorded keys', async () => {
    const original = await recorded()
    await join(original.id)
    await prisma.user.create({ data: { id: userId + '-other', email: userId + '-other@example.test' } })
    await prisma.project.update({ where: { id: projectId }, data: { userId: userId + '-other' } })
    await prisma.user.delete({ where: { id: userId } })
    expect(await loadRunRequestByKey(key('joined'))).toMatchObject({ id: original.id, keyRequestedByUserId: null })
    await expect(loadOwnedRunRequestByKey({ ...key('joined'), userId: userId + '-other', cleanup: false })).rejects.toMatchObject({ status: 409 })
    expect(await prisma.runRequestKey.count({ where: { projectId, requestedByUserId: null } })).toBe(2)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ projectId, requestedByUserId: null })
  })

  it('retains an admitted cleanup operator as key actor while rechecking its authority even for replay', async () => {
    const original = await recorded(), actorId = userId + '-other', sessionId = randomUUID(), now = new Date()
    await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(now.getTime() + 60_000) } })
    const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: now,
      ownerId: userId, action: 'SITE_ACCOUNT_CLEANUP', targetType: 'SITE', targetId: projectId, reason: 'Controlled local cleanup authority',
      input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(now.getTime() + 60_000),
      status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(now.getTime() + 60_000) } })
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'DELETING' } })
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: now } })
    const input = { ...key('cleanup-replay'), source: 'INTERNAL' as const, userId, runRequestId: original.id, cleanup: true }
    // A flag alone cannot acquire the operator exception. No account lifecycle
    // task or external cleanup is executed by this key-routing fixture.
    await expect(retainSharedRunKey(input, () => true)).rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    const operator = { kind: 'admin' as const, actorId, operationId: operation.id }
    expect(await retainSharedRunKey({ ...input, operator }, run => run.id === original.id))
      .toMatchObject({ id: original.id, requestedByUserId: userId, keyRequestedByUserId: actorId })
    expect(await loadRunRequestByKey(input)).toMatchObject({ id: original.id, keyRequestedByUserId: actorId })
    expect(await loadOwnedRunRequestByKey({ ...input, operator })).toMatchObject({ id: original.id, keyRequestedByUserId: actorId })
    await prisma.user.update({ where: { id: actorId }, data: { role: 'user' } })
    await expect(retainSharedRunKey({ ...input, operator }, () => true)).rejects.toMatchObject({ code: 'ADMIN_ACCESS_REVOKED' })
    await expect(loadOwnedRunRequestByKey({ ...input, operator })).rejects.toMatchObject({ code: 'ADMIN_ACCESS_REVOKED' })
    expect(await prisma.runRequestKey.count({ where: { projectId } })).toBe(2)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
  })

  it('builds the reference index over populated requests while another write can commit', async () => {
    const first = await recorded('writer-one'), second = await recorded('writer-two')
    await prisma.runRequest.createMany({ data: Array.from({ length: 200 }, (_, index) => ({ projectId, source: 'WEB' as const,
      idempotencyKey: 'history-' + index, status: 'COMPLETED' as const })) })
    const indexName = 'request_key_reference_' + randomUUID().replaceAll('-', '')
    const migration = readFileSync(new URL('../../../../prisma/migrations/20261101200000_run_request_scope_key/migration.sql', import.meta.url), 'utf8')
      .replace('"run_requests_id_projectId_key"', '"' + indexName + '"')
    let release!: () => void, held!: () => void
    const releaseWriter = new Promise<void>(resolve => { release = resolve })
    const writerHeld = new Promise<void>(resolve => { held = resolve })
    const writer = prisma.$transaction(async tx => {
      await tx.runRequest.update({ where: { id: first.id }, data: { errorMessage: 'Controlled held writer' } })
      held(); await releaseWriter
    }, { timeout: 10_000 })
    await writerHeld
    const building = prisma.$executeRawUnsafe(migration).then(() => ({ ok: true as const }), error => ({ ok: false as const, error }))
    try {
      await vi.waitFor(async () => {
        const progress = await prisma.$queryRaw<Array<{ phase: string }>>`
          SELECT phase FROM pg_stat_progress_create_index WHERE datname = current_database()
            AND relid = 'run_requests'::regclass`
        expect(progress.some(row => row.phase.includes('waiting for writers'))).toBe(true)
      }, { timeout: 2000, interval: 25 })
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`
        await tx.runRequest.update({ where: { id: second.id }, data: { errorMessage: 'Independent write committed' } })
      }, { timeout: 2000 })
    } finally {
      release(); await writer
      const result = await building
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "' + indexName + '"')
      if (!result.ok) throw result.error
    }
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(202)
    expect(await prisma.runRequestKey.count({ where: { projectId } })).toBe(202)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({ errorMessage: 'Independent write committed' })
  })
})
