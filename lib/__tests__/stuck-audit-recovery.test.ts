import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { STUCK_AUDIT_MINUTES } from '@/lib/audit/pipeline-config'

export function stuckAuditCutoff(nowMs = Date.now()): Date {
  return new Date(nowMs - STUCK_AUDIT_MINUTES * 60 * 1000)
}

export function isAuditStuck(updatedAt: Date, nowMs = Date.now()): boolean {
  return updatedAt.getTime() < stuckAuditCutoff(nowMs).getTime()
}

describe('stuck audit recovery cutoff', () => {
  it('uses a 15 minute threshold', () => {
    assert.equal(STUCK_AUDIT_MINUTES, 15)
  })

  it('flags audits older than the cutoff as stuck', () => {
    const now = Date.parse('2026-06-18T12:00:00.000Z')
    const stuckUpdatedAt = new Date(now - STUCK_AUDIT_MINUTES * 60 * 1000 - 1)
    const freshUpdatedAt = new Date(now - STUCK_AUDIT_MINUTES * 60 * 1000 + 1)

    assert.equal(isAuditStuck(stuckUpdatedAt, now), true)
    assert.equal(isAuditStuck(freshUpdatedAt, now), false)
  })
})
