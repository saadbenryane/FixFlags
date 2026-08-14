import { describe, expect, it } from 'vitest'
import {
  calculateImprovementValueMetrics,
  type ImprovementValueCycleRow,
} from './improvement-value-metrics'

const hour = 3_600_000
const at = (hours: number) => new Date(Date.UTC(2026, 7, 1) + hours * hour)

function cycle(overrides: Partial<ImprovementValueCycleRow> = {}): ImprovementValueCycleRow {
  return {
    id: 'cycle-1',
    projectId: 'product-1',
    createdAt: at(2),
    project: { createdAt: at(0) },
    occurrence: { flag: { createdAt: at(2) } },
    sourceAudit: {
      id: 'review-1',
      createdAt: at(1),
      runCost: { estimatedCostUsd: 1 },
    },
    events: [
      event('GENERATED', 2),
      event('RECOMMENDED', 3),
      event('ACCEPTED_EXPLICIT', 4),
      event('ATTEMPTED', 5),
      event('OUTCOME_ISSUED', 8, 'IMPROVED'),
      event('IMPROVED', 8, 'IMPROVED'),
    ],
    ...overrides,
  }
}

function event(
  type: ImprovementValueCycleRow['events'][number]['type'],
  hours: number,
  outcome: ImprovementValueCycleRow['events'][number]['outcome'] = null,
): ImprovementValueCycleRow['events'][number] {
  return {
    type,
    occurredAt: at(hours),
    outcome,
    rejectionReason: null,
    attempt: type === 'OUTCOME_ISSUED' || type === 'IMPROVED'
      ? {
          verificationAudit: {
            id: 'review-2',
            completedAt: at(8),
            runCost: { estimatedCostUsd: 2 },
          },
        }
      : null,
  }
}

describe('calculateImprovementValueMetrics', () => {
  it('separates issued outcomes from improved outcomes and reports distribution N', () => {
    const metrics = calculateImprovementValueMetrics([cycle()], {
      activeProductCount: 2,
      now: at(240),
    })

    expect(metrics).toMatchObject({
      cohortSize: 1,
      generated: 1,
      recommended: 1,
      accepted: 1,
      acceptedExplicit: 1,
      acceptedInferred: 0,
      attempted: 1,
      outcomeIssued: 1,
      improved: 1,
      outcomes: { IMPROVED: 1, UNCHANGED: 0, REGRESSED: 0, INCONCLUSIVE: 0 },
      urlToFirstEvidence: { n: 1, medianHours: 1, p75Hours: 1, p90Hours: 1 },
      recommendationToAcceptance: { n: 1, medianHours: 1 },
      acceptanceToAttempt: { n: 1, medianHours: 1 },
      attemptToOutcome: { n: 1, medianHours: 3 },
      fullyLoadedReviewCostPerImprovedUsd: 3,
      outcomeReviewCostPerOutcomeUsd: 2,
      verifiedWorthwhileImprovementsPerActiveProduct: 0.5,
    })
  })

  it('does not count handoff copy as acceptance or an inconclusive receipt as improvement', () => {
    const metrics = calculateImprovementValueMetrics([
      cycle({
        events: [
          event('GENERATED', 2),
          event('HANDOFF_COPIED', 3),
          event('ATTEMPTED', 5),
          event('OUTCOME_ISSUED', 8, 'INCONCLUSIVE'),
          { ...event('REJECTED', 9), rejectionReason: 'MISUNDERSTOOD_PRODUCT_CONTEXT' },
        ],
      }),
    ], { activeProductCount: 1, now: at(240) })

    expect(metrics.accepted).toBe(0)
    expect(metrics.outcomeIssued).toBe(1)
    expect(metrics.improved).toBe(0)
    expect(metrics.outcomes.INCONCLUSIVE).toBe(1)
    expect(metrics.rejections.MISUNDERSTOOD_PRODUCT_CONTEXT).toBe(1)
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBeNull()
  })

  it('counts a second cycle only when it starts after a prior terminal outcome', () => {
    const first = cycle()
    const second = cycle({
      id: 'cycle-2',
      createdAt: at(10),
      sourceAudit: { id: 'review-3', createdAt: at(10), runCost: null },
      events: [event('GENERATED', 10)],
    })
    const parallel = cycle({
      id: 'cycle-3',
      projectId: 'product-2',
      createdAt: at(4),
      sourceAudit: { id: 'review-4', createdAt: at(4), runCost: null },
      events: [event('GENERATED', 4)],
    })

    expect(calculateImprovementValueMetrics([first, second, parallel], {
      activeProductCount: 2,
      now: at(240),
    }).productsWithSecondCycle).toBe(1)
  })
})
