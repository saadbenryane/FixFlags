import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WORKER_DEAD_RECOVERY_SECONDS,
  isAuditPastDeadline,
  isQueuedPastDeadline,
} from '@/lib/audit/recover-audit-job'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'
import { wrapAuditJobError } from '@/lib/queue/worker'
import { AuditDeadlineError } from '@/lib/audit/pipeline-errors'
import { UnrecoverableError } from 'bullmq'

describe('recover audit job', () => {
  it('uses a 90 second worker-dead recovery threshold', () => {
    assert.equal(WORKER_DEAD_RECOVERY_SECONDS, 90)
  })

  it('detects deadline exceeded from startedAt', () => {
    const now = Date.parse('2026-06-20T12:00:00.000Z')
    const startedAt = new Date(now - AUDIT_DEADLINE_MS - 1)
    const fresh = new Date(now - AUDIT_DEADLINE_MS + 1000)

    assert.equal(isAuditPastDeadline(startedAt, now), true)
    assert.equal(isAuditPastDeadline(fresh, now), false)
    assert.equal(isAuditPastDeadline(null, now), false)
  })

  it('detects queued stall from updatedAt when startedAt is null', () => {
    const now = Date.parse('2026-06-20T12:00:00.000Z')
    const stale = new Date(now - AUDIT_DEADLINE_MS - 1)
    const fresh = new Date(now - AUDIT_DEADLINE_MS + 1000)

    assert.equal(isQueuedPastDeadline('QUEUED', null, stale, now), true)
    assert.equal(isQueuedPastDeadline('QUEUED', null, fresh, now), false)
    assert.equal(isQueuedPastDeadline('CAPTURING', null, stale, now), false)
    assert.equal(isQueuedPastDeadline('QUEUED', fresh, stale, now), false)
  })
})

describe('wrapAuditJobError', () => {
  it('wraps non-retryable audit errors as UnrecoverableError', () => {
    const wrapped = wrapAuditJobError(new AuditDeadlineError('judging'))
    assert.ok(wrapped instanceof UnrecoverableError)
  })

  it('passes through retryable errors unchanged', () => {
    const err = new Error('transient network error')
    const wrapped = wrapAuditJobError(err)
    assert.equal(wrapped, err)
  })
})
