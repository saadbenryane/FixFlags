import { describe, expect, it } from 'vitest'
import {
  calculateWatchLaunchReadiness,
  type WatchRunEvidence,
} from '../watch-launch-readiness'

const AS_OF = new Date('2026-10-05T12:00:00.000Z')

function run(index: number, overrides: Partial<WatchRunEvidence> = {}): WatchRunEvidence {
  const requestedAt = new Date(AS_OF.getTime() - (index + 1) * 2 * 60 * 60 * 1000)
  return {
    id: `run-${index}`,
    projectId: `project-${index % 4}`,
    requestedAt,
    completedAt: new Date(requestedAt.getTime() + 5 * 60 * 1000),
    status: 'COMPLETED',
    leaseUntil: null,
    errorCode: null,
    assessments: [{ state: 'CLEAR' }],
    audit: {
      id: `audit-${index}`,
      status: 'COMPLETED',
      failureCode: null,
      watchRegressionCount: 0,
      watchRecoveryCount: 0,
      watchNotificationStatus: 'NOT_APPLICABLE',
      watchNotificationAttempts: 0,
      watchNotificationLeaseUntil: null,
      estimatedCostUsd: 0.3,
      flags: [],
    },
    ...overrides,
  }
}

function customerFlag(id: string, improvementId: string | null) {
  return {
    id,
    fingerprint: 'checkout-dead-link',
    status: 'OPEN',
    severity: 'CRITICAL',
    confidence: 0.98,
    impactTag: 'REVENUE',
    checkId: 'checkout-failed',
    improvementId,
  }
}

describe('Watch launch readiness', () => {
  it('passes only after the full sample and exercised reliability paths are evidenced', () => {
    const runs = Array.from({ length: 100 }, (_, index) => run(index))
    runs[0] = run(0, {
      projectId: 'project-repeat',
      assessments: [{ state: 'FLAG' }],
      audit: {
        ...run(0).audit!,
        watchRegressionCount: 1,
        watchNotificationStatus: 'SENT',
        watchNotificationAttempts: 1,
        flags: [customerFlag('flag-1', 'improvement-1')],
      },
    })
    runs[1] = run(1, {
      projectId: 'project-repeat',
      assessments: [{ state: 'FLAG' }],
      audit: {
        ...run(1).audit!,
        watchRegressionCount: 1,
        watchNotificationStatus: 'SENT',
        watchNotificationAttempts: 1,
        flags: [customerFlag('flag-2', 'improvement-1')],
      },
    })

    const readiness = calculateWatchLaunchReadiness({
      asOf: AS_OF,
      firstWatchRequestedAt: new Date('2026-09-20T11:59:59.000Z'),
      runs,
    })

    expect(readiness.status).toBe('passed')
    expect(readiness.metrics).toMatchObject({
      scheduledExecutions: 100,
      terminalCompletionRate: 100,
      lostScheduledRuns: 0,
      notificationAttempts: 2,
      durableNotificationRecords: 2,
      unchangedClearRuns: 98,
      repeatedFailureGroups: 1,
      duplicateActiveFlagGroups: 0,
      costedExecutions: 100,
      missingCostExecutions: 0,
      projectedDailyCareCostUsd: 9,
    })
    expect(Object.values(readiness.gates).every((gate) => gate.status === 'passed')).toBe(true)
  })

  it('keeps unexercised paths collecting instead of treating absence as success', () => {
    const readiness = calculateWatchLaunchReadiness({
      asOf: AS_OF,
      firstWatchRequestedAt: new Date('2026-10-01T00:00:00.000Z'),
      runs: [run(0)],
    })

    expect(readiness.status).toBe('collecting')
    expect(readiness.gates.sample.status).toBe('collecting')
    expect(readiness.gates.notificationRecords.status).toBe('collecting')
    expect(readiness.gates.flagDeduplication.status).toBe('collecting')
  })

  it('fails measured platform loss, incomplete delivery, noisy Clear, duplicate Flags, and excess cost', () => {
    const duplicateOne = run(0, {
      projectId: 'project-repeat',
      assessments: [{ state: 'FLAG' }],
      audit: {
        ...run(0).audit!,
        watchRegressionCount: 1,
        watchNotificationStatus: 'SENDING',
        watchNotificationAttempts: 1,
        watchNotificationLeaseUntil: new Date('2026-10-05T13:00:00.000Z'),
        estimatedCostUsd: 0.5,
        flags: [customerFlag('flag-1', 'improvement-1')],
      },
    })
    const duplicateTwo = run(1, {
      projectId: 'project-repeat',
      assessments: [{ state: 'FLAG' }],
      audit: {
        ...run(1).audit!,
        watchRegressionCount: 1,
        estimatedCostUsd: 0.5,
        flags: [customerFlag('flag-2', 'improvement-2')],
      },
    })
    const noisyClear = run(2, {
      audit: {
        ...run(2).audit!,
        watchNotificationStatus: 'SENT',
        watchNotificationAttempts: 1,
        estimatedCostUsd: 0.5,
      },
    })
    const lost = run(3, {
      status: 'FAILED',
      completedAt: new Date('2026-10-05T05:00:00.000Z'),
      errorCode: 'RUN_ABANDONED',
      audit: null,
    })
    const readiness = calculateWatchLaunchReadiness({
      asOf: AS_OF,
      firstWatchRequestedAt: new Date('2026-09-20T00:00:00.000Z'),
      runs: [duplicateOne, duplicateTwo, noisyClear, lost],
    })

    expect(readiness.status).toBe('failed')
    expect(readiness.gates.terminalCompletion.status).toBe('failed')
    expect(readiness.gates.noLostRuns.status).toBe('failed')
    expect(readiness.gates.notificationRecords.status).toBe('failed')
    expect(readiness.gates.quietClear.status).toBe('failed')
    expect(readiness.gates.flagDeduplication.status).toBe('failed')
    expect(readiness.gates.economics.status).toBe('failed')
  })

  it('excludes explicit target failures and reports ambiguous historical evidence as unavailable', () => {
    const targetFailure = run(0, {
      status: 'FAILED',
      completedAt: new Date('2026-10-05T10:05:00.000Z'),
      errorCode: 'SITE_UNREACHABLE',
      assessments: [{ state: 'COULD_NOT_VERIFY' }],
      audit: {
        ...run(0).audit!,
        status: 'FAILED',
        failureCode: 'SITE_UNREACHABLE',
      },
    })
    const ambiguous = run(1, {
      audit: {
        ...run(1).audit!,
        watchRecoveryCount: null,
        estimatedCostUsd: null,
      },
    })
    const readiness = calculateWatchLaunchReadiness({
      asOf: AS_OF,
      firstWatchRequestedAt: new Date('2026-09-20T00:00:00.000Z'),
      runs: [targetFailure, ambiguous],
    })

    expect(readiness.metrics.targetFailuresExcluded).toBe(1)
    expect(readiness.metrics.terminalCompletionRate).toBe(100)
    expect(readiness.status).toBe('unavailable')
    expect(readiness.gates.quietClear.status).toBe('unavailable')
    expect(readiness.gates.economics.status).toBe('unavailable')
  })
})
