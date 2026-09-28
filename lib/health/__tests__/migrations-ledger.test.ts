/**
 * Exercises the migrations readiness subsystem against a real PostgreSQL ledger
 * rather than only the pure comparison, so the probe SQL and the row mapping are
 * covered too.
 *
 * Requires TEST_DATABASE_URL on a database this suite may create and drop
 * scratch databases in. Skipped when the variable is absent.
 */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

/**
 * The probe reads the shared `prisma` singleton, so point that singleton at the
 * scratch database. The reference is resolved per call because the client cannot
 * be constructed until the database exists.
 */
const scratch = vi.hoisted(() => ({ current: null as PrismaClient | null }))
const admin = vi.hoisted(() => ({ current: null as PrismaClient | null }))
vi.mock('@/lib/db', () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (scratch.current as unknown as Record<string, unknown>)[key as string],
  }),
}))

const { compareMigrationLedger, readMigrationReadiness, shippedMigrationNames } = await import(
  '@/lib/health/readiness'
)
type MigrationLedgerRow = import('@/lib/health/readiness').MigrationLedgerRow

const url = process.env.TEST_DATABASE_URL
const describeIfDb = url ? describe : describe.skip
const SCRATCH = 'fixflags_migration_probe_scratch'
/** The admin client creates the scratch database, so it needs its own URL. */
const adminUrl = url?.replace(/\/[^/]*$/, '/postgres')

/** A finished ledger row, as `migrate deploy` records a success. */
function finished(name: string): MigrationLedgerRow {
  return { migrationName: name, finishedAt: new Date(), rolledBackAt: null }
}
/** A started-but-unresolved ledger row: the state that blocks all later deploys. */
function unfinished(name: string): MigrationLedgerRow {
  return { migrationName: name, finishedAt: null, rolledBackAt: null }
}

describeIfDb('migrations readiness against a real ledger', () => {
  const shipped = shippedMigrationNames()
  // `describe.skip` still evaluates the suite body, so both clients are built
  // lazily inside the hooks. Without that, an absent TEST_DATABASE_URL would
  // throw on an undefined url instead of skipping.
  const scratchUrl = url?.replace(/\/[^/]*$/, `/${SCRATCH}`)

  beforeAll(async () => {
    admin.current = new PrismaClient({ datasources: { db: { url: adminUrl } } })
    await admin.current.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}"`)
    await admin.current.$executeRawUnsafe(`CREATE DATABASE "${SCRATCH}"`)
    scratch.current = new PrismaClient({ datasources: { db: { url: scratchUrl } } })
    await scratch.current.$executeRawUnsafe(
      `CREATE TABLE "_prisma_migrations" (
         "id" TEXT PRIMARY KEY,
         "migration_name" TEXT NOT NULL,
         "finished_at" TIMESTAMP(3),
         "rolled_back_at" TIMESTAMP(3)
       )`,
    )
  })

  afterAll(async () => {
    await scratch.current?.$disconnect()
    await admin.current?.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SCRATCH}' AND pid <> pg_backend_pid()`,
    )
    await admin.current?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SCRATCH}"`)
    await admin.current?.$disconnect()
  })

  /** Point the probe at the scratch database for one assertion. */
  async function withLedger(
    rows: Array<[string, string | null, string | null]>,
    read: () => Promise<{ ok: boolean; detail?: string }>,
  ) {
    await scratch.current?.$executeRawUnsafe('TRUNCATE "_prisma_migrations"')
    for (const [name, finishedAt, rolledBackAt] of rows) {
      // Single quotes, not JSON.stringify: a double-quoted token is an identifier.
      const literal = `'${name.replace(/'/g, "''")}'`
      await scratch.current?.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id","migration_name","finished_at","rolled_back_at")
         VALUES (${literal}, ${literal},
           ${finishedAt ? 'now()' : 'NULL'}, ${rolledBackAt ? 'now()' : 'NULL'})`,
      )
    }
    return read()
  }

  it('reports current when the real ledger has finished every shipped migration', async () => {
    const readiness = await withLedger(
      shipped.map((name) => [name, 'now', null] as [string, string, null]),
      readMigrationReadiness,
    )
    expect(readiness).toEqual({ ok: true })
  })

  it('reports missing migrations from a real ledger that is behind', async () => {
    const missing = shipped.slice(-2)
    const readiness = await withLedger(
      shipped.slice(0, -2).map((name) => [name, 'now', null] as [string, string, null]),
      readMigrationReadiness,
    )
    expect(readiness.ok).toBe(false)
    for (const name of missing) expect(readiness.detail).toContain(name)
  })

  it('reports a real poisoned ledger distinctly, because it blocks later deploys', async () => {
    const [pending, failed] = [...shipped].reverse()
    const readiness = await withLedger(
      [
        [pending, 'now', null],
        [failed, null, null],
      ] as Array<[string, string, null]>,
      readMigrationReadiness,
    )
    expect(readiness.ok).toBe(false)
    expect(readiness.detail).toContain('poisoned')
    expect(readiness.detail).toContain(failed)
  })

  it('treats a resolved rollback as behind, not poisoned', async () => {
    const [rolled, applied] = [...shipped].reverse()
    const readiness = await withLedger(
      [
        [rolled, null, 'now'],
        [applied, 'now', null],
      ] as Array<[string, string | null, string | null]>,
      readMigrationReadiness,
    )
    expect(readiness.ok).toBe(false)
    expect(readiness.detail).toContain('missing')
    expect(readiness.detail).not.toContain('poisoned')
  })

  it('agrees with the pure comparison for each real ledger state', async () => {
    const [last, secondLast] = [...shipped].reverse()
    const cases: Array<{
      rows: Array<[string, string | null, string | null]>
      expected: ReturnType<typeof compareMigrationLedger>['state']
    }> = [
      { rows: shipped.map((n) => [n, 'now', null] as [string, string, null]), expected: 'current' },
      { rows: [[last, 'now', null]], expected: 'behind' },
      { rows: [[last, 'now', null], [secondLast, null, null]], expected: 'poisoned' },
      { rows: [[last, null, 'now']], expected: 'behind' },
      { rows: [], expected: 'behind' },
    ]
    for (const testCase of cases) {
      const verdict = await withLedger(testCase.rows, async () => {
        const probe = await readMigrationReadiness()
        const pure = compareMigrationLedger(shipped, rowsOf(testCase.rows))
        expect(pure.state).toBe(testCase.expected)
        return probe
      })
      expect(verdict.ok).toBe(testCase.expected === 'current')
    }
  })
})

function rowsOf(rows: Array<[string, string | null, string | null]>): MigrationLedgerRow[] {
  return rows.map(([name, finishedAt, rolledBackAt]) => ({
    migrationName: name,
    finishedAt: finishedAt ? new Date() : null,
    rolledBackAt: rolledBackAt ? new Date() : null,
  }))
}

describe('migration comparison rules', () => {
  const finishedRow = finished
  it('is current only when every shipped migration finished', () => {
    expect(compareMigrationLedger(['a', 'b'], [finishedRow('a'), finishedRow('b')]))
      .toEqual({ state: 'current' })
  })

  it('accepts a database ahead of this revision after a rollback', () => {
    expect(compareMigrationLedger(['a'], [finishedRow('a'), finishedRow('b')]))
      .toEqual({ state: 'current' })
  })

  it('names every shipped migration the database never applied', () => {
    expect(compareMigrationLedger(['a', 'b', 'c'], [finishedRow('a')]))
      .toEqual({ state: 'behind', pending: ['b', 'c'] })
  })

  it('never reports a migration as applied without a finished_at', () => {
    expect(compareMigrationLedger(['a'], [unfinished('a')]))
      .toEqual({ state: 'poisoned', failed: ['a'] })
  })

  it('refuses to answer when the runtime ships no migrations', () => {
    expect(compareMigrationLedger([], [finishedRow('a')]).state).toBe('undeterminable')
  })

  it('reads this repository as a sorted, well-formed shipped set', () => {
    const shipped = shippedMigrationNames()
    expect(shipped.length).toBeGreaterThan(0)
    expect(shipped.every((name) => /^\d{14}_.+$/.test(name))).toBe(true)
    expect([...shipped].sort()).toEqual(shipped)
    expect(new Set(shipped).size).toBe(shipped.length)
  })
})
