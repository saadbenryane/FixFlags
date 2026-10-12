import { describe, expect, it } from 'vitest'
import { accountConfigurationFingerprint } from '../configuration'
const env = { ACCOUNT_CHECKS_ENABLED: 'true', ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'true', ACCOUNT_TEST_EMAIL: 'checks@example.com',
  TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), RESEND_API_KEY: 'provider-key', RESEND_RECEIVING_WEBHOOK_SECRET: 'signing-secret' }
describe('private account capability identity', () => {
  it('compares the exact credential and mailbox configuration without exposing its values', () => {
    const identity = accountConfigurationFingerprint(env)
    expect(identity).toMatch(/^[0-9a-f]{64}$/)
    expect(accountConfigurationFingerprint({ ...env })).toBe(identity)
    for (const key of ['TOKEN_ENCRYPTION_KEY', 'RESEND_API_KEY', 'RESEND_RECEIVING_WEBHOOK_SECRET', 'ACCOUNT_TEST_EMAIL'] as const)
      expect(accountConfigurationFingerprint({ ...env, [key]: key === 'TOKEN_ENCRYPTION_KEY' ? 'b'.repeat(64) : 'other@example.com' })).not.toBe(identity)
  })
  it('never invents capability identity when lifecycle proof or configuration is absent', () => {
    expect(accountConfigurationFingerprint({ ...env, ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'false' })).toBeNull()
    expect(accountConfigurationFingerprint({})).toBeNull()
  })
})
