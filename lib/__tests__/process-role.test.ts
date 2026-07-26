import { afterEach, describe, expect, it } from 'vitest'
import { validateWorkerEnv } from '@/lib/env'

const originalRole = process.env.FIXFLAGS_PROCESS_ROLE
const originalDatabaseUrl = process.env.DATABASE_URL
const originalRedisUrl = process.env.REDIS_URL
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalRole === undefined) delete process.env.FIXFLAGS_PROCESS_ROLE
  else process.env.FIXFLAGS_PROCESS_ROLE = originalRole
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL
  else process.env.REDIS_URL = originalRedisUrl
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('runtime process roles', () => {
  it('prevents the web role from starting the audit worker', () => {
    process.env.FIXFLAGS_PROCESS_ROLE = 'web'
    expect(() => validateWorkerEnv()).toThrow(
      'Worker runtime requires FIXFLAGS_PROCESS_ROLE=worker'
    )
  })

  it('allows the worker role with its required runtime dependencies', () => {
    process.env.FIXFLAGS_PROCESS_ROLE = 'worker'
    process.env.DATABASE_URL = originalDatabaseUrl ?? 'postgresql://local/test'
    process.env.REDIS_URL = originalRedisUrl ?? 'redis://localhost:6379'
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl ?? 'http://localhost:3000'
    expect(() => validateWorkerEnv()).not.toThrow()
  })
})
