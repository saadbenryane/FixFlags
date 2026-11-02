import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { applySitePurge, previewSitePurge, type PurgeProgress } from './site-purge'

const run = process.env.SITE_PURGE_DB_REQUIRED === 'true' ? describe : describe.skip
run('scoped website purge in disposable PostgreSQL', () => {
  const db = new PrismaClient()
  let owner: string, foreign: string, keep: string, target: string, doomed: string, preserved: string
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_purge_test_[a-f0-9]{32}$/.test(url.pathname)) throw new Error('Disposable purge database required')
    owner = randomUUID(); foreign = randomUUID()
    await db.user.createMany({ data: [{ id: owner, email: owner + '@example.test' }, { id: foreign, email: foreign + '@example.test' }] })
    const kept = await db.project.create({ data: { userId: owner, name: 'Keep', url: 'https://keep.test', canonicalHost: 'keep.test', watchInterval: 'DAILY' } })
    const removed = await db.project.create({ data: { userId: owner, name: 'Remove', url: 'https://remove.test', canonicalHost: 'remove.test', watchInterval: 'DAILY' } })
    keep = kept.id; target = removed.id
    preserved = (await db.audit.create({ data: { userId: owner, projectId: keep, url: kept.url, normalizedDomain: 'keep.test', status: 'COMPLETED' } })).id
    doomed = (await db.audit.create({ data: { userId: owner, projectId: target, url: removed.url, normalizedDomain: 'remove.test', status: 'CAPTURING', executionToken: 'old-writer' } })).id
    await db.audit.create({ data: { userId: foreign, url: removed.url, normalizedDomain: 'remove.test' } })
    await db.auditExecutionTask.create({ data: { auditId: doomed, targetKey: 'task:browser', source: 'BROWSER', scopeKey: 'root', status: 'RUNNING', workKind: 'browser', workState: 'RUNNING', workToken: 'old-task' } })
    await db.shareLink.create({ data: { auditId: doomed, token: randomUUID() } })
    await db.auditPipelineEvent.create({ data: { auditId: doomed, executionId: 'test', traceId: doomed, attempt: 1, stage: 'checking', event: 'test', status: 'completed' } })
  })
  afterAll(() => db.$disconnect())
  const scope = () => ({ email: owner + '@example.test', keepHost: 'keep.test', removeHosts: ['remove.test'], unlinkedHosts: ['remove.test'] })
  const state = (digest: string): PurgeProgress => ({ digest, fenced: false, assetsDeleted: [], auditsDeleted: [], complete: false })
  it('preserves the owner, retained site, retained history and another tenant while erasing descendants', async () => {
    const manifest = await previewSitePurge(db, scope()), progress = state(manifest.digest), deletion = vi.fn().mockResolvedValue(undefined)
    await applySitePurge(db, manifest, progress, deletion, async () => {})
    expect(progress.complete).toBe(true)
    expect(await db.project.count({ where: { id: target } })).toBe(0)
    expect(await db.auditExecutionTask.count({ where: { auditId: doomed } })).toBe(0)
    expect(await db.auditPipelineEvent.count({ where: { auditId: doomed } })).toBe(0)
    expect(await db.audit.count({ where: { id: preserved } })).toBe(1)
    expect(await db.audit.count({ where: { userId: foreign } })).toBe(1)
    expect(await db.user.count({ where: { id: owner } })).toBe(1)
    expect((await db.project.findUniqueOrThrow({ where: { id: keep } })).watchInterval).toBe('DAILY')
    await applySitePurge(db, manifest, progress, deletion, async () => {})
    expect(deletion).toHaveBeenCalledTimes(1)
  })
  it('refuses added reports and tampered retained scope before changing anything', async () => {
    const manifest = await previewSitePurge(db, scope())
    await db.audit.create({ data: { userId: owner, projectId: target, url: 'https://remove.test/new' } })
    await expect(applySitePurge(db, manifest, state(manifest.digest), vi.fn(), async () => {})).rejects.toThrow('Report scope changed')
    expect((await db.project.findUniqueOrThrow({ where: { id: target } })).deletedAt).toBeNull()
    await expect(applySitePurge(db, { ...manifest, keepProjectId: target }, state(manifest.digest), vi.fn(), async () => {})).rejects.toThrow('invalid')
  })
  it('fences stale execution and resumes after storage failure without losing report custody', async () => {
    const manifest = await previewSitePurge(db, scope()), progress = state(manifest.digest)
    await expect(applySitePurge(db, manifest, progress, async () => { throw new Error('storage unavailable') }, async () => {})).rejects.toThrow('storage unavailable')
    const audit = await db.audit.findUniqueOrThrow({ where: { id: doomed } })
    expect(audit.executionToken).toBeNull(); expect(audit.status).toBe('FAILED'); expect(audit.isPublic).toBe(false)
    expect((await db.auditExecutionTask.findFirstOrThrow({ where: { auditId: doomed } })).workToken).toBeNull()
    expect((await db.shareLink.findFirstOrThrow({ where: { auditId: doomed } })).revoked).toBe(true)
    await applySitePurge(db, manifest, progress, async () => {}, async () => {})
    expect(progress.complete).toBe(true)
  })
  it('refuses external-account obligations and another owner’s report attached to a target', async () => {
    await db.audit.create({ data: { userId: foreign, projectId: target, url: 'https://remove.test' } })
    await expect(previewSitePurge(db, scope())).rejects.toThrow('another owner')
    await db.audit.deleteMany({ where: { userId: foreign, projectId: target } })
    await db.siteTestAccount.create({ data: { projectId: target, origin: 'https://remove.test', purpose: 'retained', email: 'test@example.test', encryptedPassword: 'fixture', signupUrl: 'https://remove.test', flowFingerprint: 'fixture', state: 'ACTIVE' } })
    await expect(previewSitePurge(db, scope())).rejects.toThrow('External test-account cleanup')
  })
})
