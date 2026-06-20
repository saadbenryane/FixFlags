import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { auditPendingLeadSync } from '@/lib/leads/upsert-from-audit'

describe('upsertLeadFromAudit idempotency', () => {
  it('skips audits that already have leadSyncedAt', () => {
    assert.equal(auditPendingLeadSync({ leadSyncedAt: new Date() }), false)
    assert.equal(auditPendingLeadSync({ leadSyncedAt: null }), true)
  })
})
