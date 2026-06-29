import { describe, it, expect } from 'vitest'
import {
  AuditDeadlineError,
  BrowserLaunchError,
  StorageNotConfiguredError,
  StorageUploadError,
  auditFailureCodeFromError,
  isInfrastructureAuditError,
  isNonRetryableAuditError,
} from '../pipeline-errors'
import { getUserFacingAuditError } from '../user-facing-errors'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'

describe('audit failure classification', () => {
  it('maps each error type to its own failure code', () => {
    expect(auditFailureCodeFromError(new AuditDeadlineError('capturing'))).toBe('AUDIT_TIMEOUT')
    expect(auditFailureCodeFromError(new BrowserLaunchError('no chromium'))).toBe(
      'BROWSER_LAUNCH_FAILED'
    )
    expect(auditFailureCodeFromError(new StorageNotConfiguredError('no r2'))).toBe(
      'STORAGE_NOT_CONFIGURED'
    )
    expect(auditFailureCodeFromError(new StorageUploadError('upload blew up'))).toBe(
      'STORAGE_UPLOAD_FAILED'
    )
  })

  it('falls back to the generic pipeline code for unknown errors', () => {
    expect(auditFailureCodeFromError(new Error('something odd'))).toBe('AUDIT_PIPELINE_FAILED')
    expect(auditFailureCodeFromError('not even an error')).toBe('AUDIT_PIPELINE_FAILED')
  })

  it('flags browser and storage failures as infrastructure errors', () => {
    expect(isInfrastructureAuditError(new BrowserLaunchError('x'))).toBe(true)
    expect(isInfrastructureAuditError(new StorageNotConfiguredError('x'))).toBe(true)
    expect(isInfrastructureAuditError(new StorageUploadError('x'))).toBe(true)
    expect(isInfrastructureAuditError(new Error('site blocked us'))).toBe(false)
  })

  it('treats infrastructure failures as non-retryable', () => {
    expect(isNonRetryableAuditError(new BrowserLaunchError('x'))).toBe(true)
    expect(isNonRetryableAuditError(new StorageNotConfiguredError('x'))).toBe(true)
    expect(isNonRetryableAuditError(new StorageUploadError('x'))).toBe(true)
  })
})

describe('user-facing copy for infrastructure failures', () => {
  it('shows the scanner-unavailable message, never blames the user site', () => {
    for (const code of [
      'BROWSER_LAUNCH_FAILED',
      'STORAGE_NOT_CONFIGURED',
      'STORAGE_UPLOAD_FAILED',
    ]) {
      const message = getUserFacingAuditError(code)
      expect(message).toBe(AUDIT_ERRORS.scannerUnavailable)
      expect(message).not.toBe(AUDIT_ERRORS.generic)
    }
  })

  it('keeps the generic message for a genuinely unreachable site', () => {
    expect(getUserFacingAuditError('AUDIT_PIPELINE_FAILED')).toBe(AUDIT_ERRORS.generic)
  })
})
