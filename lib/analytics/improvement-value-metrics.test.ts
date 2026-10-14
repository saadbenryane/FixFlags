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
    verificationAuditId: type === 'OUTCOME_ISSUED' || type === 'IMPROVED' ? 'review-2' : null,
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

  it('withholds cost ratios when a source estimate is absent while exposing coverage', () => {
    const row = cycle()
    row.sourceAudit.runCost = null
    const metrics = calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) })
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBeNull()
    expect(metrics.outcomeReviewCostPerOutcomeUsd).toBe(2)
    expect(metrics.reviewCostCoverage).toEqual({ runCount: 2, measuredRunCount: 1,
      missingRunCount: 1, unknownVerificationReferenceCount: 0, knownEstimatedCostUsd: 2 })
  })

  it.each([null, undefined, '', 'not a cost', NaN, Infinity, -1])('rejects a missing or invalid verification estimate (%s)', (cost) => {
    const row = cycle()
    for (const event of row.events) if (event.attempt?.verificationAudit) event.attempt.verificationAudit.runCost = { estimatedCostUsd: cost }
    const metrics = calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) })
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBeNull()
    expect(metrics.outcomeReviewCostPerOutcomeUsd).toBeNull()
    expect(metrics.outcomeCostCoverage.missingRunCount).toBe(1)
  })

  it('accepts explicit zero and Decimal estimates and deduplicates shared audit costs', () => {
    const row = cycle()
    row.sourceAudit.runCost = { estimatedCostUsd: 0 }
    for (const event of row.events) if (event.attempt?.verificationAudit) event.attempt.verificationAudit.runCost = { estimatedCostUsd: { toNumber: () => 2 } }
    const metrics = calculateImprovementValueMetrics([row, cycle({ id: 'another-cycle', sourceAudit: row.sourceAudit, events: row.events })], { activeProductCount: 1, now: at(240) })
    expect(metrics.reviewCostCoverage).toMatchObject({ runCount: 2, measuredRunCount: 2, knownEstimatedCostUsd: 2 })
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBe(1)
    expect(metrics.outcomeReviewCostPerOutcomeUsd).toBe(1)
  })

  it('never prices a historical outcome using the attempt’s newer verification pointer', () => {
    const row = cycle()
    row.events.find((event) => event.type === 'OUTCOME_ISSUED')!.verificationAuditId = 'original-review'
    const metrics = calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) })
    expect(metrics.outcomeIssued).toBe(1)
    expect(metrics.outcomeCostCoverage).toMatchObject({ runCount: 1, missingRunCount: 1, knownEstimatedCostUsd: 0 })
    expect(metrics.outcomeReviewCostPerOutcomeUsd).toBeNull()
  })

  it('reports an unknown outcome audit reference without treating it as a free check', () => {
    const row = cycle()
    delete row.events.find((event) => event.type === 'OUTCOME_ISSUED')!.verificationAuditId
    const metrics = calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) })
    expect(metrics.reviewCostCoverage.unknownVerificationReferenceCount).toBe(1)
    expect(metrics.outcomeReviewCostPerOutcomeUsd).toBeNull()
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBeNull()
  })

  it('excludes future cycles, events and cost records at the observation cutoff', () => {
    const row = cycle()
    row.sourceAudit.monitoringAudits = [{ id: 'future-child', createdAt: at(20), runCost: { estimatedCostUsd: 100 } }]
    const metrics = calculateImprovementValueMetrics([row, cycle({ id: 'future-cycle', createdAt: at(12) })], { activeProductCount: 1, now: at(6) })
    expect(metrics).toMatchObject({ cohortSize: 1, attempted: 1, outcomeIssued: 0, improved: 0, productToImproved: null })
    expect(metrics.reviewCostCoverage.runCount).toBe(1)
    const recordedLater = cycle()
    recordedLater.sourceAudit.runCost = { estimatedCostUsd: 1, createdAt: at(20) }
    expect(calculateImprovementValueMetrics([recordedLater], { activeProductCount: 1, now: at(10) }).fullyLoadedReviewCostPerImprovedUsd).toBeNull()
  })

  it('excludes invalid or reversed durations instead of reporting negative time to value', () => {
    const row = cycle({ project: { createdAt: at(20) }, occurrence: { flag: { createdAt: new Date(NaN) } } })
    row.events.find((event) => event.type === 'ACCEPTED_EXPLICIT')!.occurredAt = at(1)
    row.events.find((event) => event.type === 'ATTEMPTED')!.occurredAt = at(0)
    const metrics = calculateImprovementValueMetrics([row, row], { activeProductCount: 1, now: at(240) })
    expect(metrics.cohortSize).toBe(1)
    expect(metrics.urlToFirstEvidence).toBeNull()
    expect(metrics.recommendationToAcceptance).toBeNull()
    expect(metrics.acceptanceToAttempt).toBeNull()
    expect(metrics.productToImproved).toBeNull()
  })

  it('uses the latest result after a retry and explicitly reports an unclassified result', () => {
    const row = cycle()
    row.events.push(event('OUTCOME_ISSUED', 10, 'UNCHANGED'))
    const latest = calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) })
    expect(latest.outcomes).toEqual({ IMPROVED: 0, INCONCLUSIVE: 0, UNCHANGED: 1, REGRESSED: 0 })
    expect(latest.improved).toBe(1)
    expect(latest.attemptToOutcome?.medianHours).toBe(3)
    row.events.push(event('OUTCOME_ISSUED', 11))
    expect(calculateImprovementValueMetrics([row], { activeProductCount: 1, now: at(240) }).unclassifiedOutcomeCount).toBe(1)
  })

  it('withholds a ratio when shared audit cost representations conflict', () => {
    const first = cycle()
    const second = cycle({ id: 'second-cycle', sourceAudit: { ...first.sourceAudit, runCost: { estimatedCostUsd: 100 } } })
    const metrics = calculateImprovementValueMetrics([first, second], { activeProductCount: 1, now: at(240) })
    expect(metrics.reviewCostCoverage.missingRunCount).toBe(1)
    expect(metrics.fullyLoadedReviewCostPerImprovedUsd).toBeNull()
  })
})
