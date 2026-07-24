import { describe, expect, it } from 'vitest'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'

describe('triageUnavailableBody', () => {
  it('uses provider copy when keys are missing', () => {
    expect(triageUnavailableBody('AI_PROVIDER_NOT_CONFIGURED', false)).toBe(
      AUDIT_ERRORS.triageProviderNotConfigured
    )
    expect(triageUnavailableBody('AI_PROVIDER_NOT_CONFIGURED', true)).toBe(
      AUDIT_ERRORS.triageProviderNotConfigured
    )
  })

  it('uses timeout copy for AUDIT_TIMEOUT', () => {
    expect(triageUnavailableBody('AUDIT_TIMEOUT', false)).toBe(
      AUDIT_ERRORS.triageDegradedTimeout
    )
    expect(triageUnavailableBody('AUDIT_TIMEOUT', true)).toBe(
      AUDIT_ERRORS.triageDegradedTimeout
    )
  })

  it('prompts anonymous users to sign up', () => {
    expect(triageUnavailableBody('AUDIT_PIPELINE_FAILED', false)).toBe(
      AUDIT_ERRORS.triageDegradedAnonymous
    )
    expect(triageUnavailableBody(null, false)).toBe(AUDIT_ERRORS.triageDegradedAnonymous)
  })

  it('uses signed-in copy without partialReport fallback', () => {
    expect(triageUnavailableBody('AUDIT_PIPELINE_FAILED', true)).toBe(
      AUDIT_ERRORS.triageDegradedSignedIn
    )
    expect(triageUnavailableBody(null, true)).toBe(AUDIT_ERRORS.triageDegradedSignedIn)
    expect(triageUnavailableBody(null, true)).not.toBe(AUDIT_ERRORS.partialReport)
  })
})
