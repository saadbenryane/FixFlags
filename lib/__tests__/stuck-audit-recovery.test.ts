import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isAuditStuck,
  resolveStuckAuditRecovery,
  stuckAuditCutoff,
} from '@/lib/audit/stuck-audit-recovery'

describe('stuck audit recovery', () => {
  it('uses a 15 minute cutoff', () => {
    const now = Date.parse('2026-06-18T12:00:00.000Z')
    const stuckUpdatedAt = new Date(now - 15 * 60 * 1000 - 1)
    const freshUpdatedAt = new Date(now - 15 * 60 * 1000 + 1)

    assert.equal(isAuditStuck(stuckUpdatedAt, now), true)
    assert.equal(isAuditStuck(freshUpdatedAt, now), false)
    assert.equal(stuckAuditCutoff(now).getTime(), now - 15 * 60 * 1000)
  })

  it('requeues queued audits without active jobs', () => {
    assert.equal(resolveStuckAuditRecovery({ status: 'QUEUED', jobState: 'waiting' }), 'requeue')
    assert.equal(resolveStuckAuditRecovery({ status: 'QUEUED', jobState: null }), 'requeue')
  })

  it('force-fails active or in-progress audits', () => {
    assert.equal(resolveStuckAuditRecovery({ status: 'QUEUED', jobState: 'active' }), 'force_fail')
    assert.equal(resolveStuckAuditRecovery({ status: 'JUDGING', jobState: 'waiting' }), 'force_fail')
  })
})
