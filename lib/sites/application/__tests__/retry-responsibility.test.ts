import { describe, expect, it } from 'vitest'
import { admittedResponsibilityHash } from '../run-retry'
import type { ExecutionSpec } from '../../domain/execution-spec'

const original: ExecutionSpec = { version: 1, targetUrl: 'https://example.com/', environment: 'production',
  scope: 'SITE', outcomes: [], checks: { 'title-missing': 1 }, verificationTarget: null }

describe('legacy execution retry responsibility', () => {
  it('permits a fresh engine while retaining the original responsibility', () => {
    expect(admittedResponsibilityHash(original)).toBe(admittedResponsibilityHash({ ...original, engine: 'progressive-v1' }))
  })
  it.each([
    { environment: 'staging' }, { targetUrl: 'https://example.com/other' },
    { checks: { 'title-missing': 2 } }, { scope: 'OUTCOMES' as const },
  ])('still distinguishes a changed responsibility: %j', changed => {
    expect(admittedResponsibilityHash(original)).not.toBe(admittedResponsibilityHash({ ...original, ...changed }))
  })
})
