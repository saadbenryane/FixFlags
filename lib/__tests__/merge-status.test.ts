import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLeadStatusOnBackfill } from '@/lib/leads/merge-status'

describe('mergeLeadStatusOnBackfill', () => {
  it('preserves manual workflow states', () => {
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'CONTACTED',
        scanCount: 5,
        latestScore: 90,
      }),
      'CONTACTED'
    )
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'CONVERTED',
        scanCount: 2,
        latestScore: 80,
      }),
      'CONVERTED'
    )
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'DISQUALIFIED',
        scanCount: 1,
        latestScore: 40,
      }),
      'DISQUALIFIED'
    )
  })

  it('auto-qualifies NEW leads with enough signal', () => {
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'NEW',
        scanCount: 3,
        latestScore: 85,
      }),
      'QUALIFIED'
    )
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'NEW',
        scanCount: 1,
        latestScore: 80,
      }),
      'NEW'
    )
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'NEW',
        scanCount: 1,
        latestScore: 50,
      }),
      'QUALIFIED'
    )
  })
})
