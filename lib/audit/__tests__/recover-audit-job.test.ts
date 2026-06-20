import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WORKER_DEAD_RECOVERY_SECONDS,
  isAuditPastDeadline,
} from '@/lib/audit/recover-audit-job'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'

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
})
