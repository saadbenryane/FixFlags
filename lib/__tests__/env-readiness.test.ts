import { afterEach, describe, expect, it } from 'vitest'
import { isExplicitLocalDegradedMode, missingProductionLaunchVars } from '@/lib/env'

const keys = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'PAGESPEED_API_KEY',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'ADMIN_NOTIFICATION_EMAIL',
  'R2_BUCKET_NAME',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_URL',
] as const

const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
const originalLocalMode = {
  FIXFLAGS_ALLOW_DEGRADED_LOCAL: process.env.FIXFLAGS_ALLOW_DEGRADED_LOCAL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
}

afterEach(() => {
  for (const key of keys) {
    const value = original[key]
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
  for (const [key, value] of Object.entries(originalLocalMode)) {
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
})

describe('missingProductionLaunchVars', () => {
  it('requires every subsystem that backs a shipped launch feature', () => {
    for (const key of keys) delete process.env[key]
    const missing = missingProductionLaunchVars()
    expect(missing).toContain('PAGESPEED_API_KEY')
    expect(missing).toContain('R2_BUCKET_NAME')
    expect(missing).toContain('OPENAI_API_KEY or ANTHROPIC_API_KEY')
  })

  it('accepts either configured AI provider', () => {
    for (const key of keys) process.env[key] = 'configured'
    delete process.env.ANTHROPIC_API_KEY
    expect(missingProductionLaunchVars()).toEqual([])
  })

  it('allows explicit degradation only on a loopback application URL', () => {
    process.env.FIXFLAGS_ALLOW_DEGRADED_LOCAL = 'true'
    process.env.NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000'
    expect(isExplicitLocalDegradedMode()).toBe(true)

    process.env.NEXT_PUBLIC_APP_URL = 'https://fixflags.com'
    expect(isExplicitLocalDegradedMode()).toBe(false)
  })
})
