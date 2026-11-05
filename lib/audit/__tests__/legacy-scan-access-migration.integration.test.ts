import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const sql = readFileSync(resolve('prisma/migrations/20261018234031_retire_unused_scan_access_columns/migration.sql'), 'utf8')

run('legacy encrypted-access column retirement in PostgreSQL', () => {
  const suffix = randomUUID(), userId = 'legacy-retire-user-' + suffix
  const projectId = 'legacy-retire-project-' + suffix, auditId = 'legacy-retire-audit-' + suffix
  const projectCipher = 'synthetic-current-project-cipher', auditCipher = 'synthetic-current-audit-cipher'
  let db: PrismaClient

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    db = new PrismaClient()
    await db.user.create({ data: { id: userId, email: userId + '@example.test' } })
    await db.project.create({ data: { id: projectId, userId, name: 'Schema migration fixture', url: 'https://example.test/',
      canonicalHost: 'example.test', watchInterval: null, watchNextRunAt: null, accountChecksEnabled: false, scanAccessEncrypted: projectCipher } })
    await db.audit.create({ data: { id: auditId, userId, projectId, url: 'https://example.test/', isPublic: false,
      status: 'COMPLETED', completedAt: new Date(), scanAccessEncrypted: auditCipher } })
  })

  async function legacyColumns() {
    return db.$queryRaw<Array<{ table_name: string }>>`SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('projects', 'audits') AND column_name = 'scan_access_encrypted' ORDER BY table_name`
  }

  beforeEach(async () => {
    for (const table of ['projects', 'audits'])
      await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS scan_access_encrypted TEXT`)
  })

  afterEach(async () => {
    for (const { table_name: table } of await legacyColumns()) {
      if (!['projects', 'audits'].includes(table)) throw new Error('Unexpected fixture table')
      await db.$executeRawUnsafe(`UPDATE "${table}" SET scan_access_encrypted = NULL WHERE id = $1`, table === 'projects' ? projectId : auditId)
    }
    await db.$executeRawUnsafe(sql)
  })

  afterAll(async () => {
    if (!db) return
    await db.audit.deleteMany({ where: { id: auditId } })
    await db.project.deleteMany({ where: { id: projectId } })
    await db.user.deleteMany({ where: { id: userId } })
    await db.$disconnect()
  })

  async function expectCurrentCredentialsPreserved() {
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).scanAccessEncrypted).toBe(projectCipher)
    expect((await db.audit.findUniqueOrThrow({ where: { id: auditId } })).scanAccessEncrypted).toBe(auditCipher)
  }

  it('retires empty historical columns without changing current encrypted values', async () => {
    expect(await legacyColumns()).toHaveLength(2)
    await db.$executeRawUnsafe(sql)
    expect(await legacyColumns()).toHaveLength(0)
    await expectCurrentCredentialsPreserved()
  })

  it('refuses populated legacy data and retains both columns atomically', async () => {
    await db.$executeRaw`UPDATE audits SET scan_access_encrypted = 'synthetic-legacy-cipher' WHERE id = ${auditId}`
    await expect(db.$executeRawUnsafe(sql)).rejects.toThrow(/LEGACY_SCAN_ACCESS_HAS_VALUES/)
    expect(await legacyColumns()).toHaveLength(2)
    const rows = await db.$queryRaw<Array<{ value: string }>>`SELECT scan_access_encrypted AS value FROM audits WHERE id = ${auditId}`
    expect(rows[0].value).toBe('synthetic-legacy-cipher')
    await expectCurrentCredentialsPreserved()
  })

  it('accepts fresh and already-retired schemas without changing current values', async () => {
    await db.$executeRawUnsafe(sql)
    await db.$executeRawUnsafe(sql)
    expect(await legacyColumns()).toHaveLength(0)
    await expectCurrentCredentialsPreserved()
  })

  it('waits for a concurrent writer and refuses the newly committed legacy value', async () => {
    let releaseWriter!: () => void, writerReady!: () => void
    const release = new Promise<void>(resolve => { releaseWriter = resolve })
    const ready = new Promise<void>(resolve => { writerReady = resolve })
    const writer = db.$transaction(async tx => {
      await tx.$executeRaw`UPDATE projects SET scan_access_encrypted = 'synthetic-concurrent-cipher' WHERE id = ${projectId}`
      writerReady()
      await release
    })
    try {
      await ready
      const retirement = db.$executeRawUnsafe(sql).then(() => null, error => error as Error)
      await new Promise(resolve => setTimeout(resolve, 100))
      releaseWriter()
      await writer
      expect((await retirement)?.message).toMatch(/LEGACY_SCAN_ACCESS_HAS_VALUES/)
      expect(await legacyColumns()).toHaveLength(2)
      const rows = await db.$queryRaw<Array<{ value: string }>>`SELECT scan_access_encrypted AS value FROM projects WHERE id = ${projectId}`
      expect(rows[0].value).toBe('synthetic-concurrent-cipher')
      await expectCurrentCredentialsPreserved()
    } finally {
      releaseWriter()
      await writer
    }
  })
})
