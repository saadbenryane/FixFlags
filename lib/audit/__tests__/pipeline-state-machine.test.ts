import { describe, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import {
  AuditDeadlineError,
  BrowserLaunchError,
  StorageNotConfiguredError,
  StorageUploadError,
  SiteOutageError,
  auditFailureCodeFromError,
  isNonRetryableAuditError,
} from '@/lib/audit/pipeline-errors'
import { sanitizeAuditErrorMessage } from '@/lib/audit/pipeline/context'
import { assertDeadline } from '@/lib/audit/pipeline/context'
import { AUDIT_DEADLINE_MS, MIN_JUDGE_BUDGET_MS, FINALIZE_RESERVE_MS, STUCK_AUDIT_MINUTES } from '@/lib/audit/pipeline-config'
import { JudgeContractError } from '@/lib/audit/validate-judge-output'

// ── AuditDeadlineError ──────────────────────────────────────────

describe('AuditDeadlineError', () => {
  it('sets the correct error name and code', () => {
    const err = new AuditDeadlineError('judging')
    assert.equal(err.name, 'AuditDeadlineError')
    assert.equal(err.code, 'AUDIT_TIMEOUT')
  })

  it('preserves the stage where the timeout occurred', () => {
    const err = new AuditDeadlineError('capturing')
    assert.equal(err.stage, 'capturing')
    assert.ok(err.message.includes('capturing'))
  })

  it('is an instance of Error', () => {
    const err = new AuditDeadlineError('checking')
    assert.ok(err instanceof Error)
  })
})

// ── assertDeadline ───────────────────────────────────────────────

describe('assertDeadline', () => {
  it('does not throw when within the deadline', () => {
    const ctx = { auditId: 'test', deadline: Date.now() + 60_000, startedAt: new Date(), pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }
    assert.doesNotThrow(() => assertDeadline(ctx, 'checking'))
  })

  it('throws AuditDeadlineError when past the deadline', () => {
    const ctx = { auditId: 'test', deadline: Date.now() - 1, startedAt: new Date(), pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }
    assert.throws(() => assertDeadline(ctx, 'capturing'), AuditDeadlineError)
  })

  it('includes the stage name in the thrown error', () => {
    const ctx = { auditId: 'test', deadline: Date.now() - 1, startedAt: new Date(), pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }
    try {
      assertDeadline(ctx, 'finalizing')
      assert.fail('should have thrown')
    } catch (e) {
      assert.ok(e instanceof AuditDeadlineError)
      assert.equal(e.stage, 'finalizing')
    }
  })

  it('does not throw at the exact deadline boundary', () => {
    // Freeze the clock so deadline === Date.now() inside assertDeadline; the
    // check is `>`, not `>=`, so the exact boundary must not throw. (Without
    // freezing, the wall clock can advance past the captured deadline between
    // building ctx and the call, making this test flaky.)
    const now = Date.now()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      const ctx = { auditId: 'test', deadline: now, startedAt: new Date(now), pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }
      assert.doesNotThrow(() => assertDeadline(ctx, 'checking'))
    } finally {
      spy.mockRestore()
    }
  })
})

// ── isNonRetryableAuditError ─────────────────────────────────────

describe('isNonRetryableAuditError', () => {
  it('returns true for AuditDeadlineError', () => {
    assert.equal(isNonRetryableAuditError(new AuditDeadlineError('judging')), true)
  })

  it('returns true for desktop screenshot failure', () => {
    assert.equal(isNonRetryableAuditError(new Error('Desktop screenshot capture failed for https://example.com')), true)
  })

  it('returns true for API key errors', () => {
    assert.equal(isNonRetryableAuditError(new Error('ANTHROPIC_API_KEY is not set')), true)
    assert.equal(isNonRetryableAuditError(new Error('OPENAI_API_KEY is invalid')), true)
  })

  it('returns false for generic errors', () => {
    assert.equal(isNonRetryableAuditError(new Error('transient network error')), false)
  })

  it('returns false for JudgeContractError', () => {
    const judgeErr = new JudgeContractError('Invalid output')
    assert.equal(isNonRetryableAuditError(judgeErr), false)
  })

  it('returns false for non-Error values', () => {
    assert.equal(isNonRetryableAuditError(null), false)
    assert.equal(isNonRetryableAuditError(undefined), false)
    assert.equal(isNonRetryableAuditError('string error'), false)
    assert.equal(isNonRetryableAuditError(42), false)
    assert.equal(isNonRetryableAuditError({}), false)
  })
})

// ── auditFailureCodeFromError ────────────────────────────────────

describe('auditFailureCodeFromError', () => {
  it('maps AuditDeadlineError to AUDIT_TIMEOUT', () => {
    assert.equal(auditFailureCodeFromError(new AuditDeadlineError('capturing')), 'AUDIT_TIMEOUT')
  })

  it('maps BrowserLaunchError to BROWSER_LAUNCH_FAILED', () => {
    assert.equal(
      auditFailureCodeFromError(new BrowserLaunchError('chromium missing')),
      'BROWSER_LAUNCH_FAILED'
    )
  })

  it('maps StorageNotConfiguredError to STORAGE_NOT_CONFIGURED', () => {
    assert.equal(
      auditFailureCodeFromError(new StorageNotConfiguredError('R2 not configured')),
      'STORAGE_NOT_CONFIGURED'
    )
  })

  it('maps StorageUploadError to STORAGE_UPLOAD_FAILED', () => {
    assert.equal(
      auditFailureCodeFromError(new StorageUploadError('upload failed')),
      'STORAGE_UPLOAD_FAILED'
    )
  })

  it('maps SiteOutageError to its own failure code', () => {
    const err = new SiteOutageError('SITE_UNREACHABLE', 'site is down', 'throw')
    assert.equal(auditFailureCodeFromError(err), 'SITE_UNREACHABLE')
  })

  it('maps generic errors to AUDIT_PIPELINE_FAILED', () => {
    assert.equal(auditFailureCodeFromError(new Error('something broke')), 'AUDIT_PIPELINE_FAILED')
  })

  it('maps non-Error throw values to AUDIT_PIPELINE_FAILED', () => {
    assert.equal(auditFailureCodeFromError('string error'), 'AUDIT_PIPELINE_FAILED')
    assert.equal(auditFailureCodeFromError(null), 'AUDIT_PIPELINE_FAILED')
  })
})

// ── sanitizeAuditErrorMessage ────────────────────────────────────

describe('sanitizeAuditErrorMessage', () => {
  it('replaces URLs with [url]', () => {
    const result = sanitizeAuditErrorMessage('Failed to connect to https://example.com/page')
    assert.equal(result, 'Failed to connect to [url]')
  })

  it('replaces multiple URLs', () => {
    const result = sanitizeAuditErrorMessage('Error at https://a.com and https://b.com/path')
    assert.equal(result, 'Error at [url] and [url]')
  })

  it('redacts API and KEY environment variable names', () => {
    const result = sanitizeAuditErrorMessage('ANTHROPIC_API_KEY is not configured')
    assert.equal(result, '[config] is not configured')
  })

  it('does not redact non-API/KEY uppercase identifiers', () => {
    const result = sanitizeAuditErrorMessage('CHECKING status reached')
    assert.equal(result, 'CHECKING status reached')
  })

  it('normalizes whitespace', () => {
    const result = sanitizeAuditErrorMessage('  too   many   spaces  ')
    assert.equal(result, 'too many spaces')
  })

  it('trims the result', () => {
    const result = sanitizeAuditErrorMessage('  leading and trailing  ')
    assert.equal(result, 'leading and trailing')
  })

  it('truncates long messages to 500 characters', () => {
    const long = 'x'.repeat(1000)
    const result = sanitizeAuditErrorMessage(long)
    assert.equal(result.length, 500)
  })

  it('handles empty strings', () => {
    assert.equal(sanitizeAuditErrorMessage(''), '')
  })

  it('does not include newlines', () => {
    const result = sanitizeAuditErrorMessage('line1\nline2\r\nline3')
    assert.equal(result, 'line1 line2 line3')
  })

  it('handles mixed URLs, API keys, and whitespace', () => {
    const result = sanitizeAuditErrorMessage(
      '  Error at https://app.example.com: ANTHROPIC_API_KEY  invalid  '
    )
    assert.equal(result, 'Error at [url] [config] invalid')
  })
})

// ── Pipeline config constants ────────────────────────────────────

describe('pipeline config constants', () => {
  it('AUDIT_DEADLINE_MS is 5 minutes', () => {
    assert.equal(AUDIT_DEADLINE_MS, 300_000)
  })

  it('MIN_JUDGE_BUDGET_MS is 25 seconds', () => {
    assert.equal(MIN_JUDGE_BUDGET_MS, 25_000)
  })

  it('FINALIZE_RESERVE_MS is 10 seconds', () => {
    assert.equal(FINALIZE_RESERVE_MS, 10_000)
  })

  it('MIN_JUDGE_BUDGET_MS + FINALIZE_RESERVE_MS < AUDIT_DEADLINE_MS', () => {
    // There must be room for both judge budget and finalize reserve within the deadline
    assert.ok(MIN_JUDGE_BUDGET_MS + FINALIZE_RESERVE_MS < AUDIT_DEADLINE_MS)
  })

  it('STUCK_AUDIT_MINUTES is 20', () => {
    assert.equal(STUCK_AUDIT_MINUTES, 20)
  })

  it('STUCK_AUDIT_MINUTES in milliseconds exceeds AUDIT_DEADLINE_MS', () => {
    // Stuck detection should be much longer than a single audit deadline
    assert.ok(STUCK_AUDIT_MINUTES * 60 * 1000 > AUDIT_DEADLINE_MS * 3)
  })
})
