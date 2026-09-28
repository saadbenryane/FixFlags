import { describe, expect, it } from 'vitest'
import {
  compareMigrationLedger,
  readLaunchReadiness,
  shippedMigrationNames,
  type MigrationLedgerRow,
  type ReadinessSubsystemName,
} from '@/lib/health/readiness'

const subsystemNames: ReadinessSubsystemName[] = [
  'database',
  'redis',
  'migrations',
  'worker',
  'browser',
  'storage',
  'ai',
  'pagespeed',
  'auth',
  'billing',
  'email',
  'productWatch',
]

function dependencies(failing?: ReadinessSubsystemName): NonNullable<Parameters<typeof readLaunchReadiness>[0]> {
  return Object.fromEntries(
    subsystemNames.map((name) => [
      name,
      async () => name === failing
        ? { ok: false, detail: `${name} unavailable` }
        : { ok: true },
    ])
  ) as NonNullable<Parameters<typeof readLaunchReadiness>[0]>
}

describe('readLaunchReadiness', () => {
  it('is ready only when every launch subsystem is ready', async () => {
    const result = await readLaunchReadiness(dependencies())
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('keeps free launch healthy when paid billing is intentionally closed', async () => {
    const free = await readLaunchReadiness(dependencies('billing'), 'free-launch')
    const commercial = await readLaunchReadiness(dependencies('billing'), 'commercial')
    expect(free).toMatchObject({ ok: true, profile: 'free-launch', missing: [] })
    expect(commercial).toMatchObject({ ok: false, profile: 'commercial', missing: ['billing'] })
  })

  it('names each unavailable launch subsystem', async () => {
    const result = await readLaunchReadiness(dependencies('worker'))
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['worker'])
    expect(result.subsystems.worker.detail).toBe('worker unavailable')
  })

  it('turns thrown probe failures into explicit readiness failures', async () => {
    const deps = dependencies()
    deps.storage = async () => { throw new Error('R2 rejected credentials') }
    const result = await readLaunchReadiness(deps)
    expect(result.ok).toBe(false)
    expect(result.subsystems.storage.detail).toBe('R2 rejected credentials')
  })

  it('fails the free-launch profile when migrations are not ready', async () => {
    const result = await readLaunchReadiness(dependencies('migrations'), 'free-launch')
    expect(result).toMatchObject({ ok: false, missing: ['migrations'] })
  })
})

const applied = (name: string): MigrationLedgerRow => ({
  migrationName: name,
  finishedAt: new Date('2026-09-27T05:00:00Z'),
  rolledBackAt: null,
})

describe('compareMigrationLedger', () => {
  it('is current when the database applied every shipped migration', () => {
    expect(compareMigrationLedger(['a', 'b'], [applied('a'), applied('b')]))
      .toEqual({ state: 'current' })
  })

  it('is current when the database is ahead of this revision after a rollback', () => {
    expect(compareMigrationLedger(['a'], [applied('a'), applied('b')]))
      .toEqual({ state: 'current' })
  })

  it('is behind when a shipped migration was never applied', () => {
    expect(compareMigrationLedger(['a', 'b', 'c'], [applied('a')]))
      .toEqual({ state: 'behind', pending: ['b', 'c'] })
  })

  it('treats a resolved rollback as not applied rather than poisoned', () => {
    const rolledBack: MigrationLedgerRow = {
      migrationName: 'b',
      finishedAt: null,
      rolledBackAt: new Date('2026-09-27T06:00:00Z'),
    }
    expect(compareMigrationLedger(['a', 'b'], [applied('a'), rolledBack]))
      .toEqual({ state: 'behind', pending: ['b'] })
  })

  it('reports a poisoned ledger distinctly, because it blocks all later deploys', () => {
    const unfinished: MigrationLedgerRow = {
      migrationName: 'b',
      finishedAt: null,
      rolledBackAt: null,
    }
    expect(compareMigrationLedger(['a', 'b'], [applied('a'), unfinished]))
      .toEqual({ state: 'poisoned', failed: ['b'] })
  })

  it('prefers poisoned over behind so a blocked deploy is never reported as merely late', () => {
    const unfinished: MigrationLedgerRow = {
      migrationName: 'b',
      finishedAt: null,
      rolledBackAt: null,
    }
    expect(compareMigrationLedger(['a', 'b', 'c'], [applied('a'), unfinished]))
      .toEqual({ state: 'poisoned', failed: ['b'] })
  })

  it('cannot be determined when the runtime ships no migrations', () => {
    const verdict = compareMigrationLedger([], [])
    expect(verdict.state).toBe('undeterminable')
  })
})

describe('shippedMigrationNames', () => {
  it('lists the migration directories in this repository in order', () => {
    const names = shippedMigrationNames()
    expect(names.length).toBeGreaterThan(0)
    expect(names[0]).toMatch(/^\d{14}_/)
    expect([...names].sort()).toEqual(names)
  })

  it('finds no migrations rather than guessing when the directory is absent', () => {
    expect(shippedMigrationNames('/nonexistent-runtime-root')).toEqual([])
  })
})
