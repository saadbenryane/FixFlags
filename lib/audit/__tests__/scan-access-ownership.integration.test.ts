import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { admitScanAccess, persistProjectScanAccess, resolveAuditScanAccess } from '../scan-access-store'
import { readSavedScanAccess, saveScanAccess } from '@/lib/sites/application/scan-access-commands'
import { encryptScanAccess, decryptScanAccess } from '../scan-access'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('saved website access ownership', () => {
  const users: string[] = []
  const config = { headers: { 'X-Preview': 'synthetic-owner-access' } }
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
  })
  afterAll(async () => { await prisma.$disconnect() })
  async function owner() {
    const user = await prisma.user.create({ data: { email: randomUUID() + '@access.test', role: 'admin' } })
    users.push(user.id); return user
  }
  async function fixture() {
    const user = await owner()
    const project = await prisma.project.create({ data: { userId: user.id, name: 'Website access fixture',
      canonicalHost: randomUUID() + '.example.test', url: 'https://example.com/' } })
    await persistProjectScanAccess(project.id, user.id, config)
    return { user, project }
  }
  it('reads deliberately removed access as unconfigured rather than an unreadable secret', async () => {
    const { user, project } = await fixture()
    await persistProjectScanAccess(project.id, user.id, null)
    expect(await readSavedScanAccess(project.id, user.id)).toEqual({ configured: false, summary: null })
  })
  it('admits public checks without lending the former owner\'s saved credentials', async () => {
    const { project } = await fixture(), replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect(await admitScanAccess(prisma, { projectId: project.id, userId: replacement.id, targetUrl: project.url }))
      .toEqual({ config: null, intent: { kind: 'public', origin: 'https://example.com' } })
    expect(await readSavedScanAccess(project.id, replacement.id)).toEqual({ configured: false, summary: null })
  })
  it('refuses previously borrowed snapshots, retains original evidence and rotates identical credentials under the new owner', async () => {
    const { user, project } = await fixture()
    const before = await admitScanAccess(prisma, { projectId: project.id, userId: user.id, targetUrl: project.url })
    if (before.intent.kind !== 'project') throw new Error('Fixture did not admit saved access')
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: project.url, environment: 'production',
      scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null, scanAccess: before.intent }
    const original = await prisma.audit.create({ data: { projectId: project.id, userId: user.id, url: project.url,
      status: 'COMPLETED', completedAt: new Date(), isPublic: false, executionSpec: spec, scanAccessEncrypted: encryptScanAccess(config) } })
    const replacement = await owner()
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    const borrowed = await prisma.audit.create({ data: { projectId: project.id, userId: replacement.id, url: project.url,
      status: 'COMPLETED', completedAt: new Date(), isPublic: false, executionSpec: spec, scanAccessEncrypted: encryptScanAccess(config) } })
    await expect(resolveAuditScanAccess(borrowed.id)).rejects.toMatchObject({ code: 'SCAN_ACCESS_CHANGED' })
    await saveScanAccess(project.id, replacement.id, config)
    const after = await admitScanAccess(prisma, { projectId: project.id, userId: replacement.id, targetUrl: project.url })
    expect(after.config).toEqual(config)
    expect(after.intent).toMatchObject({ kind: 'project' })
    if (after.intent.kind !== 'project') throw new Error('New owner did not supply access')
    expect(after.intent.reference).not.toBe(before.intent.reference)
    await expect(resolveAuditScanAccess(borrowed.id)).rejects.toMatchObject({ code: 'SCAN_ACCESS_CHANGED' })
    expect(decryptScanAccess((await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).scanAccessEncrypted)).toEqual(config)
    expect(await readSavedScanAccess(project.id, replacement.id)).toMatchObject({ configured: true, summary: { headerKeys: ['X-Preview'] } })
  })
  it('retains unreadable owned access as unavailable until explicit removal', async () => {
    const { user, project } = await fixture()
    await prisma.project.update({ where: { id: project.id }, data: { scanAccessEncrypted: 'synthetic-unreadable-cipher' } })
    await expect(readSavedScanAccess(project.id, user.id)).rejects.toMatchObject({ code: 'ACCESS_UNREADABLE' })
    await expect(admitScanAccess(prisma, { projectId: project.id, userId: user.id, targetUrl: project.url }))
      .rejects.toMatchObject({ code: 'SCAN_ACCESS_CHANGED' })
    await saveScanAccess(project.id, user.id, null)
    expect(await readSavedScanAccess(project.id, user.id)).toEqual({ configured: false, summary: null })
  })
  it.each(['SUSPENDED', 'DELETING'] as const)('refuses new credentials for a %s owner while retaining explicit revocation', async lifecycleStatus => {
    const { user, project } = await fixture()
    const saved = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus } })
    await expect(saveScanAccess(project.id, user.id, { headers: { 'X-Preview': 'replacement' } }))
      .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).scanAccessEncrypted).toBe(saved.scanAccessEncrypted)
    await saveScanAccess(project.id, user.id, null)
    expect(await readSavedScanAccess(project.id, user.id)).toEqual({ configured: false, summary: null })
  })
  it('preserves existing encrypted access and public decisions through the exact migration', async () => {
    const migration = await readFile(new URL('../../../prisma/migrations/20261026173000_scan_access_authorizer/migration.sql', import.meta.url), 'utf8')
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL search_path = pg_temp')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE users (id TEXT PRIMARY KEY) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE projects (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "scanAccessEncrypted" TEXT) ON COMMIT DROP')
      await tx.$executeRawUnsafe("INSERT INTO users VALUES ('owner-a'), ('owner-b')")
      await tx.$executeRawUnsafe("INSERT INTO projects VALUES ('saved', 'owner-a', 'retained-cipher'), ('public', 'owner-b', NULL)")
      for (const statement of migration.split(';').filter(statement => statement.trim())) await tx.$executeRawUnsafe(statement)
      expect(await tx.$queryRawUnsafe('SELECT * FROM projects ORDER BY id')).toEqual([
        { id: 'public', userId: 'owner-b', scanAccessEncrypted: null, scanAccessAuthorizedByUserId: null },
        { id: 'saved', userId: 'owner-a', scanAccessEncrypted: 'retained-cipher', scanAccessAuthorizedByUserId: 'owner-a' },
      ])
      await tx.$executeRawUnsafe("DELETE FROM users WHERE id = 'owner-a'")
      expect(await tx.$queryRawUnsafe('SELECT "scanAccessAuthorizedByUserId" FROM projects WHERE id = \'saved\''))
        .toEqual([{ scanAccessAuthorizedByUserId: null }])
    })
  })
})
