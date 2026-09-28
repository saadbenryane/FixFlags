import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { prisma } from '@/lib/db'
import { isAiProviderConfigured, isProdStorageConfigured } from '@/lib/env'
import { validateAuthEnv } from '@/lib/auth/env'
import { isBillingFullyConfigured } from '@/lib/billing/config'
import { productWatchReadiness } from '@/lib/audit/project-watch'
import { createQueueRedis } from '@/lib/queue/redis'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { checkR2Connection } from '@/lib/storage/r2'

export type ReadinessSubsystemName =
  | 'database'
  | 'redis'
  | 'migrations'
  | 'worker'
  | 'browser'
  | 'storage'
  | 'ai'
  | 'pagespeed'
  | 'auth'
  | 'billing'
  | 'email'
  | 'productWatch'

export type ReadinessProfile = 'free-launch' | 'commercial'

export type ReadinessSubsystem = {
  ok: boolean
  detail?: string
}

export type LaunchReadiness = {
  ok: boolean
  profile: ReadinessProfile
  checkedAt: string
  missing: ReadinessSubsystemName[]
  subsystems: Record<ReadinessSubsystemName, ReadinessSubsystem>
}

type ReadinessDependencies = Record<ReadinessSubsystemName, () => Promise<ReadinessSubsystem>>

const configured = (ok: boolean, detail: string): Promise<ReadinessSubsystem> =>
  Promise.resolve({ ok, ...(!ok ? { detail } : {}) })

/** One `_prisma_migrations` row, reduced to the columns readiness compares. */
export type MigrationLedgerRow = {
  migrationName: string
  finishedAt: Date | string | null
  rolledBackAt: Date | string | null
}

/**
 * The pure result of comparing the migrations shipped in this runtime against
 * the migrations the database says it applied. Poisoned is kept distinct from
 * behind because a poisoned ledger blocks every later deploy, so an operator
 * must resolve it rather than simply re-run the deploy.
 */
export type MigrationLedgerVerdict =
  | { state: 'current' }
  | { state: 'behind'; pending: string[] }
  | { state: 'poisoned'; failed: string[] }
  | { state: 'undeterminable'; reason: string }

const MIGRATION_DIRECTORY = /^\d{14}_.+$/
const MIGRATION_DETAIL_LIMIT = 3

/**
 * Compare shipped migration directories against the applied ledger.
 *
 * Superset means ok: a database legitimately runs ahead of this revision after a
 * rollback, so extra applied migrations are not drift. A shipped migration with
 * no finished row is behind, not healthy, and is never assumed applied.
 */
export function compareMigrationLedger(
  shipped: readonly string[],
  applied: readonly MigrationLedgerRow[],
): MigrationLedgerVerdict {
  if (shipped.length === 0) {
    return {
      state: 'undeterminable',
      reason: 'This runtime ships no prisma/migrations directory, so applied migrations cannot be compared',
    }
  }
  // Prisma writes finished_at only after a migration commits and rolled_back_at
  // only when it is resolved. A row with neither started and never resolved.
  const failed = applied
    .filter((row) => row.finishedAt == null && row.rolledBackAt == null)
    .map((row) => row.migrationName)
  if (failed.length > 0) return { state: 'poisoned', failed }
  const finished = new Set(
    applied.filter((row) => row.finishedAt != null).map((row) => row.migrationName),
  )
  const pending = shipped.filter((name) => !finished.has(name))
  return pending.length > 0 ? { state: 'behind', pending } : { state: 'current' }
}

function migrationNames(names: string[]): string {
  const shown = names.slice(0, MIGRATION_DETAIL_LIMIT).join(', ')
  const rest = names.length - MIGRATION_DETAIL_LIMIT
  return rest > 0 ? `${shown} (+${rest} more)` : shown
}

/** Turn a verdict into the subsystem shape every other readiness probe returns. */
export function migrationReadiness(verdict: MigrationLedgerVerdict): ReadinessSubsystem {
  switch (verdict.state) {
    case 'current':
      return { ok: true }
    case 'behind':
      return {
        ok: false,
        detail: `Database is missing ${verdict.pending.length} shipped migration(s): ${migrationNames(verdict.pending)}`,
      }
    case 'poisoned':
      return {
        ok: false,
        detail: `Migration ledger is poisoned by an unfinished migration, so every later deploy is blocked until it is resolved: ${migrationNames(verdict.failed)}`,
      }
    case 'undeterminable':
      return { ok: false, detail: verdict.reason }
  }
}

/**
 * Migration directories shipped in this runtime, oldest first. The Docker image
 * copies `prisma/`, so this resolves in the Next standalone runtime as well; an
 * absent directory yields no names and the comparison reports undeterminable
 * rather than claiming the database is current.
 */
export function shippedMigrationNames(cwd: string = process.cwd()): string[] {
  for (const root of [cwd, dirname(cwd), dirname(dirname(cwd))]) {
    try {
      return readdirSync(join(root, 'prisma', 'migrations'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && MIGRATION_DIRECTORY.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    } catch {
      continue
    }
  }
  return []
}

type MigrationLedgerQuery = {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

/**
 * Read the applied migration ledger, or null when the database has no ledger at
 * all. Bounded by statement and lock timeouts so a contended catalog can never
 * hold the readiness probe open.
 */
export async function readMigrationLedger(): Promise<MigrationLedgerRow[] | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2s'")
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2s'")
    const [present] = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS "present"`,
    )
    if (!present?.present) return null
    const rows = await tx.$queryRawUnsafe<MigrationLedgerQuery[]>(
      'SELECT "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations"',
    )
    return rows.map((row) => ({
      migrationName: row.migration_name,
      finishedAt: row.finished_at,
      rolledBackAt: row.rolled_back_at,
    }))
  })
}

/** Compare what this runtime ships against what the database has applied. */
export async function readMigrationReadiness(): Promise<ReadinessSubsystem> {
  const applied = await readMigrationLedger()
  if (applied === null) {
    return migrationReadiness({
      state: 'undeterminable',
      reason: 'The database has no _prisma_migrations ledger, so no migration can be confirmed applied',
    })
  }
  return migrationReadiness(compareMigrationLedger(shippedMigrationNames(), applied))
}

function productionDependencies(): ReadinessDependencies {
  return {
    database: async () => {
      await prisma.$queryRaw`SELECT 1`
      return { ok: true }
    },
    redis: async () => {
      const redis = createQueueRedis()
      try {
        await redis.connect()
        await redis.ping()
        return { ok: true }
      } finally {
        redis.disconnect()
      }
    },
    migrations: () => readMigrationReadiness(),
    worker: async () => {
      const heartbeat = await readWorkerHeartbeat()
      return heartbeat.alive
        ? { ok: true }
        : { ok: false, detail: 'No current worker heartbeat' }
    },
    browser: async () => {
      const heartbeat = await readWorkerHeartbeat()
      return heartbeat.alive && heartbeat.browserOk
        ? { ok: true }
        : { ok: false, detail: 'No worker has confirmed browser readiness' }
    },
    storage: async () => {
      if (process.env.NODE_ENV !== 'production') return { ok: true }
      if (!isProdStorageConfigured()) return { ok: false, detail: 'R2 configuration is incomplete' }
      await checkR2Connection()
      return { ok: true }
    },
    ai: () => configured(isAiProviderConfigured(), 'No AI provider is configured'),
    pagespeed: () => configured(Boolean(process.env.PAGESPEED_API_KEY), 'PAGESPEED_API_KEY is missing'),
    auth: async () => {
      try {
        validateAuthEnv()
        return { ok: true }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },
    billing: () => configured(isBillingFullyConfigured(), 'Stripe billing is incomplete'),
    email: () => configured(
      Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      'Email delivery is incomplete'
    ),
    productWatch: async () => {
      const readiness = productWatchReadiness()
      return readiness.available
        ? { ok: true }
        : { ok: false, detail: readiness.error ?? 'Product Watch is unavailable' }
    },
  }
}

async function safeCheck(check: () => Promise<ReadinessSubsystem>): Promise<ReadinessSubsystem> {
  try {
    return await check()
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

let cached: { expiresAt: number; value: LaunchReadiness } | null = null
const CACHE_MS = 15_000

export async function readLaunchReadiness(
  dependencies?: ReadinessDependencies,
  profile: ReadinessProfile = 'free-launch',
): Promise<LaunchReadiness> {
  const useCache = dependencies == null && profile === 'free-launch'
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.value

  const activeDependencies = dependencies ?? productionDependencies()
  const names = Object.keys(activeDependencies) as ReadinessSubsystemName[]
  const values = await Promise.all(names.map((name) => safeCheck(activeDependencies[name])))
  const subsystems = Object.fromEntries(names.map((name, index) => [name, values[index]])) as LaunchReadiness['subsystems']
  const required = profile === 'commercial'
    ? names
    : names.filter((name) => name !== 'billing')
  const missing = required.filter((name) => !subsystems[name].ok)
  const value = { ok: missing.length === 0, profile, checkedAt: new Date().toISOString(), missing, subsystems }
  if (useCache) cached = { expiresAt: Date.now() + CACHE_MS, value }
  return value
}
