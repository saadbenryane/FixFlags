import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import {
  allCheckIdsHaveVerificationRules,
  buildCurrentVerifiableCheckIds,
  isCheckStillFailing,
} from '@/lib/audit/verify-flags'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

describe('verify-flags', () => {
  it('every checkId has a verification rule', () => {
    assert.ok(allCheckIdsHaveVerificationRules())
    for (const id of ALL_CHECK_IDS) {
      assert.ok(allCheckIdsHaveVerificationRules(), `missing rule for ${id}`)
    }
  })

  it('flow-cta-dead-end clears when flow scan succeeds on re-check', () => {
    const failingFlags = runFlowChecks({
      status: 'dead_end',
      steps: [],
      finalUrl: 'https://example.com',
      ctaText: 'Sign up',
    })
    const failingIds = buildCurrentVerifiableCheckIds(failingFlags)
    assert.ok(isCheckStillFailing('flow-cta-dead-end', failingIds))

    const passingFlags = runFlowChecks({
      status: 'success',
      steps: [
        { label: 'Landing', screenshotUrl: '/a.png', url: 'https://example.com' },
        { label: 'After click', screenshotUrl: '/b.png', url: 'https://example.com/signup' },
      ],
      finalUrl: 'https://example.com/signup',
      ctaText: 'Sign up',
    })
    const passingIds = buildCurrentVerifiableCheckIds(passingFlags)
    assert.equal(isCheckStillFailing('flow-cta-dead-end', passingIds), false)
  })
})
