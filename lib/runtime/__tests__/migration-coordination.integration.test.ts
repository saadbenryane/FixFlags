import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { deployMigrations, MIGRATION_LOCK } from '../migration-coordination.mjs'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('database migration admission with PostgreSQL and actual Prisma processes', () => {
  const databaseUrl = process.env.DATABASE_URL!
  const admin = new Client({ connectionString: databaseUrl })
  beforeAll(async () => {
    const url = new URL(databaseUrl)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Migration admission requires the disposable execution verifier')
    await admin.connect()
  })
  afterAll(() => admin.end())

  async function fixture(secondMigration = 'CREATE INDEX CONCURRENTLY startup_probe_index ON "StartupProbe" (id);') {
    const schema = 'startup_' + randomUUID().replaceAll('-', '')
    const cwd = await mkdtemp(join(tmpdir(), 'fixflags-startup-'))
    await admin.query(`CREATE SCHEMA "${schema}"`)
    const url = new URL(databaseUrl)
    url.searchParams.set('schema', schema)
    await mkdir(join(cwd, 'migrations/001_table'), { recursive: true })
    await mkdir(join(cwd, 'migrations/002_index'), { recursive: true })
    await writeFile(join(cwd, 'schema.prisma'), 'datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\nmodel StartupProbe {\n id Int @id\n}\n')
    await writeFile(join(cwd, 'migrations/migration_lock.toml'), 'provider = "postgresql"\n')
    await writeFile(join(cwd, 'migrations/001_table/migration.sql'), 'CREATE TABLE "StartupProbe" (id INTEGER PRIMARY KEY); INSERT INTO "StartupProbe" VALUES (1); SELECT pg_sleep(0.5);')
    await writeFile(join(cwd, 'migrations/002_index/migration.sql'), secondMigration)
    const options = { cwd, env: { ...process.env, DATABASE_URL: url.href }, args: ['migrate', 'deploy', '--schema', join(cwd, 'schema.prisma')], stdio: 'pipe', log: () => {} }
    return { schema, options, async close() { await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await rm(cwd, { recursive: true }) } }
  }

  it('serializes simultaneous actual Prisma deploys around concurrent index creation', async () => {
    const target = await fixture()
    let waited = false
    try {
      const options = { ...target.options, log: () => { waited = true } }
      const results = await Promise.all([deployMigrations(options), deployMigrations(options)])
      expect(results).toEqual([0, 0])
      expect(waited).toBe(true)
      const migrations = await admin.query(`SELECT migration_name, finished_at, rolled_back_at FROM "${target.schema}"._prisma_migrations ORDER BY migration_name`)
      expect(migrations.rows).toEqual([
        { migration_name: '001_table', finished_at: expect.any(Date), rolled_back_at: null },
        { migration_name: '002_index', finished_at: expect.any(Date), rolled_back_at: null },
      ])
      expect((await admin.query('SELECT indisvalid FROM pg_index WHERE indexrelid = $1::regclass', [target.schema + '.startup_probe_index'])).rows)
        .toEqual([{ indisvalid: true }])
      expect((await admin.query(`SELECT * FROM "${target.schema}"."StartupProbe"`)).rows).toEqual([{ id: 1 }])
    } finally { await target.close() }
  }, 30_000)

  it('preserves a failed migration and refuses subsequent startup without resolving it', async () => {
    const target = await fixture('SELECT missing_startup_function();')
    try {
      expect(await deployMigrations(target.options)).not.toBe(0)
      const failed = await admin.query(`SELECT id, finished_at, rolled_back_at FROM "${target.schema}"._prisma_migrations WHERE migration_name = '002_index'`)
      expect(failed.rows).toEqual([{ id: expect.any(String), finished_at: null, rolled_back_at: null }])
      expect(await deployMigrations(target.options)).not.toBe(0)
      expect((await admin.query(`SELECT id, finished_at, rolled_back_at FROM "${target.schema}"._prisma_migrations WHERE migration_name = '002_index'`)).rows).toEqual(failed.rows)
    } finally { await target.close() }
  }, 30_000)

  it('interrupts its owned migration engine if the coordinating database session is lost', async () => {
    const target = await fixture('SELECT pg_sleep(30);')
    let coordinator: Client | undefined
    const running = deployMigrations({ ...target.options, createClient: configuration => {
      coordinator = new Client(configuration)
      return coordinator
    } })
    // Observe the rejection immediately; the owner is deliberately terminated below.
    const settled = running.then(code => ({ code, error: null }), error => ({ code: null, error }))
    try {
      await vi.waitFor(async () => {
        const active = await admin.query("SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND query = 'SELECT pg_sleep(30);' AND state = 'active'")
        expect(active.rows[0].count).toBe(1)
      }, { timeout: 15_000, interval: 50 })
      if (!coordinator) throw new Error('The coordinating connection was not created')
      const session = await coordinator.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      expect(session.rows[0].pid).toBeGreaterThan(0)
      await admin.query('SELECT pg_terminate_backend($1)', [session.rows[0].pid])
      expect((await settled).error).toMatchObject({ code: 'MIGRATION_COORDINATION_LOST' })
      await vi.waitFor(async () => {
        expect((await admin.query("SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND query = 'SELECT pg_sleep(30);' AND state = 'active'")).rows[0].count).toBe(0)
      }, { timeout: 5000, interval: 50 })
      expect((await admin.query('SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired', MIGRATION_LOCK)).rows[0].acquired).toBe(true)
      await admin.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', MIGRATION_LOCK)
    } finally { await coordinator?.end(); await settled; await target.close() }
  }, 30_000)

  it('times out behind an active migrator before starting another Prisma process', async () => {
    const target = await fixture()
    await admin.query('SELECT pg_advisory_lock($1::integer, $2::integer)', MIGRATION_LOCK)
    try {
      await expect(deployMigrations({ ...target.options, waitMs: 30, pollMs: 5 })).rejects.toThrow('startup deadline')
      expect((await admin.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', [target.schema])).rows).toEqual([])
    } finally {
      await admin.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', MIGRATION_LOCK)
      await target.close()
    }
  })
})
