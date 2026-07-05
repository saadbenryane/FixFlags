import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import {
  allCheckIdsHaveVerificationRules,
  buildCurrentVerifiableCheckIds,
  isCheckStillFailing,
} from '@/lib/audit/verify-flags'
import { resolveMonitoringFlagStatus } from '@/lib/audit/flag-status-resolution'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

describe('verify-flags', () => {
  it('every checkId has a verification rule', () => {
    assert.ok(allCheckIdsHaveVerificationRules())
    for (const id of ALL_CHECK_IDS) {
      assert.ok(allCheckIdsHaveVerificationRules(), `missing rule for ${id}`)
    }
  })

  it('flow-cta-dead-end clears when flow scan succeeds on monitoring', () => {
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

  it('treats all rule-backed deterministic modules as verifiable on monitoring', () => {
    const currentIds = buildCurrentVerifiableCheckIds([
      {
        checkId: 'measurement-ga-gtm-posthog-missing',
        rubric: 'REACH',
        impactTag: 'MEASUREMENT',
        severity: 'IMPORTANT',
        problem: 'No analytics detected',
        evidence: 'No analytics script tags found.',
        fix: '1. Add analytics',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      },
      {
        checkId: 'security-mixed-content',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'CRITICAL',
        problem: 'Mixed content',
        evidence: 'HTTP resource found.',
        fix: '1. Use HTTPS',
        confidence: 1,
        source: 'DETERMINISTIC',
      },
      {
        checkId: 'visual-radius-inconsistent',
        rubric: 'EXPERIENCE',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'Radius varies',
        evidence: '0px, 8px, 24px.',
        fix: '1. Pick one radius',
        confidence: 0.8,
        source: 'DETERMINISTIC',
      },
    ])

    assert.ok(isCheckStillFailing('measurement-ga-gtm-posthog-missing', currentIds))
    assert.ok(isCheckStillFailing('security-mixed-content', currentIds))
    assert.ok(isCheckStillFailing('visual-radius-inconsistent', currentIds))
  })

  it('marks previously fixed issues as regressed when they come back', () => {
    assert.equal(
      resolveMonitoringFlagStatus({
        parentStatus: 'FIXED',
        parentSeverity: 'IMPORTANT',
        monitoringSeverity: 'IMPORTANT',
        stillFails: true,
      }),
      'REGRESSED'
    )
  })

  it('keeps still-failing issues open unless they worsen', () => {
    assert.equal(
      resolveMonitoringFlagStatus({
        parentStatus: 'OPEN',
        parentSeverity: 'IMPORTANT',
        monitoringSeverity: 'IMPORTANT',
        stillFails: true,
      }),
      'OPEN'
    )
    assert.equal(
      resolveMonitoringFlagStatus({
        parentStatus: 'OPEN',
        parentSeverity: 'IMPORTANT',
        monitoringSeverity: 'CRITICAL',
        stillFails: true,
      }),
      'REGRESSED'
    )
  })

  it('marks cleared monitoring issues fixed', () => {
    assert.equal(
      resolveMonitoringFlagStatus({
        parentStatus: 'REGRESSED',
        parentSeverity: 'CRITICAL',
        monitoringSeverity: 'CRITICAL',
        stillFails: false,
      }),
      'FIXED'
    )
  })
})
