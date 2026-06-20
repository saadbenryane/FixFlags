import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  getUserFacingAuditError,
  getUserFacingCaptureError,
} from '@/lib/audit/user-facing-errors'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'

describe('user-facing audit errors', () => {
  it('maps failure codes to stable copy', () => {
    assert.equal(getUserFacingAuditError('AUDIT_TIMEOUT'), AUDIT_ERRORS.timeout)
    assert.equal(getUserFacingAuditError('DESKTOP_CAPTURE_FAILED'), AUDIT_ERRORS.captureFailed)
  })

  it('never returns raw backend messages', () => {
    const message = getUserFacingAuditError('DESKTOP_CAPTURE_FAILED')
    assert.ok(!message.includes('https://'))
    assert.ok(!message.includes('Desktop screenshot'))
  })

  it('falls back to generic copy for unknown codes', () => {
    assert.equal(getUserFacingAuditError('UNKNOWN_CODE'), AUDIT_ERRORS.generic)
    assert.equal(getUserFacingAuditError(null), AUDIT_ERRORS.generic)
  })

  it('maps capture error codes', () => {
    assert.equal(getUserFacingCaptureError('HTTP_FORBIDDEN'), AUDIT_ERRORS.siteBlocked)
    assert.equal(getUserFacingCaptureError('HTTP_RATE_LIMIT'), AUDIT_ERRORS.rateLimited)
  })
})
