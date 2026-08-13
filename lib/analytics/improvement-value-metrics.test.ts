import { describe, expect, it } from 'vitest'
import { calculateImprovementValueMetrics, type ImprovementValueRow } from './improvement-value-metrics'

const hour = 3_600_000
const at = (hours: number) => new Date(Date.UTC(2026, 7, 1) + hours * hour)

function row(overrides: Partial<ImprovementValueRow> = {}): ImprovementValueRow {
  return {
    id: 'improvement-1',
    projectId: 'product-1',
    createdAt: at(2),
    acceptedAt: at(3),
    rejectionReason: null,
    project: { createdAt: at(0) },
    occurrences: [{ audit: { id: 'review-1', createdAt: at(1) }, flag: { createdAt: at(2) } }],
    attempts: [{
      createdAt: at(4),
      outcome: 'IMPROVED',
      sourceAudit: { id: 'review-1', runCost: { estimatedCostUsd: 1 } },
      verificationAudit: {
        id: 'review-2',
        completedAt: at(8),
        runCost: { estimatedCostUsd: 2 },
      },
    }],
    ...overrides,
  }
}

describe('calculateImprovementValueMetrics', () => {
  it('measures the durable Recommended to Outcome funnel and time to value', () => {
    const metrics = calculateImprovementValueMetrics([row()])

    expect(metrics).toMatchObject({
      recommended: 1,
      accepted: 1,
      attempted: 1,
      verified: 1,
      outcomes: { IMPROVED: 1, UNCHANGED: 0, REGRESSED: 0, INCONCLUSIVE: 0 },
      urlToFirstEvidenceHours: 1,
      urlToValuableRecommendationHours: 2,
      recommendationToAttemptHours: 2,
      productToVerifiedImprovementHours: 8,
      costPerVerifiedImprovementUsd: 3,
      verifiedMeaningfulImprovementsPerActiveProduct: 1,
    })
  })

  it('keeps rejection reasons and inconclusive outcomes visible without claiming value', () => {
    const metrics = calculateImprovementValueMetrics([
      row({
        acceptedAt: null,
        rejectionReason: 'MISUNDERSTOOD_PRODUCT_CONTEXT',
        attempts: [{
          createdAt: at(4),
          outcome: 'INCONCLUSIVE',
          sourceAudit: { id: 'review-1', runCost: null },
          verificationAudit: { id: 'review-2', completedAt: at(8), runCost: null },
        }],
      }),
    ])

    expect(metrics.accepted).toBe(0)
    expect(metrics.verified).toBe(1)
    expect(metrics.outcomes.INCONCLUSIVE).toBe(1)
    expect(metrics.outcomes.IMPROVED).toBe(0)
    expect(metrics.rejections.MISUNDERSTOOD_PRODUCT_CONTEXT).toBe(1)
    expect(metrics.costPerVerifiedImprovementUsd).toBeNull()
    expect(metrics.verifiedMeaningfulImprovementsPerActiveProduct).toBe(0)
  })

  it('deduplicates source and verification Review cost across Improvements', () => {
    const metrics = calculateImprovementValueMetrics([
      row(),
      row({ id: 'improvement-2', createdAt: at(3), acceptedAt: at(4) }),
    ])

    expect(metrics.outcomes.IMPROVED).toBe(2)
    expect(metrics.costPerVerifiedImprovementUsd).toBe(1.5)
  })
})
