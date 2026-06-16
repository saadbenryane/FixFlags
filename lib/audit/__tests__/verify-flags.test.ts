import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { allCheckIdsHaveVerificationRules } from '@/lib/audit/verify-flags'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

describe('verify-flags', () => {
  it('every checkId has a verification rule', () => {
    assert.ok(allCheckIdsHaveVerificationRules())
    for (const id of ALL_CHECK_IDS) {
      assert.ok(allCheckIdsHaveVerificationRules(), `missing rule for ${id}`)
    }
  })

  it('flow-cta-dead-end clears when flow scan succeeds on re-check', () => {
    const failingIds = runFlowChecks({
      status: 'dead_end',
      steps: [],
      finalUrl: 'https://example.com',
      ctaText: 'Sign up',
    }).map((f) => f.checkId)

    assert.ok(failingIds.includes('flow-cta-dead-end'))

    const passingIds = runFlowChecks({
      status: 'success',
      steps: [
        { label: 'Landing', screenshotUrl: '/a.png', url: 'https://example.com' },
        { label: 'After click', screenshotUrl: '/b.png', url: 'https://example.com/signup' },
      ],
      finalUrl: 'https://example.com/signup',
      ctaText: 'Sign up',
    }).map((f) => f.checkId)

    assert.equal(passingIds.includes('flow-cta-dead-end'), false)
    assert.equal(failingIds.includes('flow-cta-dead-end'), true)
  })
})
