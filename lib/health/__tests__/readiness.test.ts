import { describe, expect, it } from 'vitest'
import {
  readLaunchReadiness,
  type ReadinessSubsystemName,
} from '@/lib/health/readiness'

const subsystemNames: ReadinessSubsystemName[] = [
  'database',
  'redis',
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
})
