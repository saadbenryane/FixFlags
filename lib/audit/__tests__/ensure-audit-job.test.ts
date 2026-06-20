import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QUEUED_RECOVERY_SECONDS } from '@/lib/audit/ensure-audit-job'

describe('ensure audit job', () => {
  it('uses a 90 second queued recovery threshold', () => {
    assert.equal(QUEUED_RECOVERY_SECONDS, 90)
  })
})
