import { describe, it } from 'vitest'
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

  it('keeps NEW leads as NEW regardless of scan count or score', () => {
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'NEW',
        scanCount: 3,
        latestScore: 85,
      }),
      'NEW'
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
      'NEW'
    )
  })

  it('preserves legacy QUALIFIED rows without promoting NEW to QUALIFIED', () => {
    assert.equal(
      mergeLeadStatusOnBackfill({
        currentStatus: 'QUALIFIED',
        scanCount: 1,
        latestScore: 90,
      }),
      'QUALIFIED'
    )
  })
})
