import type {
  ImprovementCycleEventType,
  ImprovementRejectionReason,
  VerificationOutcome,
} from '@prisma/client'

type CostValue = number | string | { toNumber(): number } | null | undefined
type ReviewCost = { estimatedCostUsd: CostValue; createdAt?: Date } | null
type VerificationReview = { id: string; completedAt: Date | null; runCost: ReviewCost }

export type ImprovementValueCycleRow = {
  id: string
  projectId: string
  createdAt: Date
  project: { createdAt: Date }
  occurrence: { flag: { createdAt: Date } } | null
  sourceAudit: {
    id: string
    createdAt: Date
    runCost: ReviewCost
    monitoringAudits?: Array<{
      id: string
      createdAt?: Date
      runCost: ReviewCost
    }>
  }
  events: Array<{
    type: ImprovementCycleEventType
    occurredAt: Date
    outcome: VerificationOutcome | null
    rejectionReason: ImprovementRejectionReason | null
    verificationAuditId?: string | null
    verificationAudit?: VerificationReview | null
    // Legacy projections may carry the attempt's current run. It is not history.
    attempt?: { verificationAudit: VerificationReview | null } | null
  }>
}

export type DurationDistribution = {
  n: number
  medianHours: number
  p75Hours: number
  p90Hours: number
} | null

export type ImprovementValueMetrics = {
  cohortSize: number
  cohortOldestDays: number | null
  matureCycleCount: number
  generated: number
  recommended: number
  accepted: number
  acceptedExplicit: number
  acceptedInferred: number
  attempted: number
  outcomeIssued: number
  unclassifiedOutcomeCount: number
  improved: number
  outcomes: Record<VerificationOutcome, number>
  rejections: Record<ImprovementRejectionReason, number>
  urlToFirstEvidence: DurationDistribution
  recommendationToAcceptance: DurationDistribution
  acceptanceToAttempt: DurationDistribution
  attemptToOutcome: DurationDistribution
  productToImproved: DurationDistribution
  fullyLoadedReviewCostPerImprovedUsd: number | null
  outcomeReviewCostPerOutcomeUsd: number | null
  reviewCostCoverage: ReviewCostCoverage
  outcomeCostCoverage: ReviewCostCoverage
  verifiedWorthwhileImprovementsPerActiveProduct: number
  activeProductCount: number
  productsWithSecondCycle: number
}

export type ReviewCostCoverage = {
  runCount: number
  measuredRunCount: number
  missingRunCount: number
  unknownVerificationReferenceCount: number
  knownEstimatedCostUsd: number
}

function percentile(sorted: number[], ratio: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[Math.max(0, index)]
}

function durationDistribution(values: number[]): DurationDistribution {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const toHours = (value: number) => value / 3_600_000
  return {
    n: sorted.length,
    medianHours: toHours(percentile(sorted, 0.5)),
    p75Hours: toHours(percentile(sorted, 0.75)),
    p90Hours: toHours(percentile(sorted, 0.9)),
  }
}

function costNumber(record: ReviewCost, now: Date): number | null {
  if (!record || record.estimatedCostUsd == null || (record.createdAt &&
    (!Number.isFinite(record.createdAt.getTime()) || record.createdAt > now))) return null
  const value = record.estimatedCostUsd
  let cost: number
  try {
    cost = typeof value === 'number' ? value : typeof value === 'string'
      ? value.trim() ? Number(value) : NaN : value.toNumber()
  } catch { return null }
  return Number.isFinite(cost) && cost >= 0 ? cost : null
}

function costCoverage(costs: Map<string, number | null>, unknownReferences: number): ReviewCostCoverage {
  const known = [...costs.values()].filter((cost): cost is number => cost !== null)
  return { runCount: costs.size, measuredRunCount: known.length,
    missingRunCount: costs.size - known.length, unknownVerificationReferenceCount: unknownReferences,
    knownEstimatedCostUsd: known.reduce((sum, cost) => sum + cost, 0) }
}

function recordCost(costs: Map<string, number | null>, id: string, cost: number | null) {
  // Conflicting or missing representations cannot prove a complete cost.
  costs.set(id, costs.has(id) && costs.get(id) !== cost ? null : cost)
}

function costPerResult(coverage: ReviewCostCoverage, results: number): number | null {
  return results > 0 && coverage.runCount > 0 && coverage.missingRunCount === 0 &&
    coverage.unknownVerificationReferenceCount === 0 ? coverage.knownEstimatedCostUsd / results : null
}

function addDuration(values: number[], start: Date, end: Date, now: Date) {
  const duration = end.getTime() - start.getTime()
  if (Number.isFinite(duration) && duration >= 0 && start <= now && end <= now) values.push(duration)
}

function firstEvent(
  row: ImprovementValueCycleRow,
  types: ImprovementCycleEventType[],
) {
  return row.events
    .filter((event) => types.includes(event.type))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]
}

export function calculateImprovementValueMetrics(
  rows: ImprovementValueCycleRow[],
  options: { activeProductCount: number; now?: Date; maturityDays?: number },
): ImprovementValueMetrics {
  const now = options.now ?? new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('A valid observation cutoff is required')
  rows = [...new Map(rows.filter((row) => Number.isFinite(row.createdAt.getTime()) && row.createdAt <= now)
    .map((row) => [row.id, { ...row, events: row.events.filter((event) =>
      Number.isFinite(event.occurredAt.getTime()) && event.occurredAt <= now) }])).values()]
  const maturityMs = (options.maturityDays ?? 7) * 24 * 3_600_000
  const outcomes: Record<VerificationOutcome, number> = {
    IMPROVED: 0,
    UNCHANGED: 0,
    REGRESSED: 0,
    INCONCLUSIVE: 0,
  }
  const rejections: Record<ImprovementRejectionReason, number> = {
    WRONG: 0,
    ALREADY_KNOWN: 0,
    LOW_IMPACT: 0,
    POOR_TIMING: 0,
    TOO_COSTLY: 0,
    WEAK_RECOMMENDATION: 0,
    MISUNDERSTOOD_PRODUCT_CONTEXT: 0,
  }
  const firstEvidenceDurations: number[] = []
  const recommendationToAcceptance: number[] = []
  const acceptanceToAttempt: number[] = []
  const attemptToOutcome: number[] = []
  const productToImproved: number[] = []
  const allReviewCosts = new Map<string, number | null>()
  const outcomeReviewCosts = new Map<string, number | null>()
  let unknownVerificationReferences = 0
  const projectCycles = new Map<string, ImprovementValueCycleRow[]>()
  let generated = 0
  let recommended = 0
  let accepted = 0
  let acceptedExplicit = 0
  let acceptedInferred = 0
  let attempted = 0
  let outcomeIssued = 0
  let unclassifiedOutcomeCount = 0
  let improved = 0
  let worthwhileImproved = 0

  for (const row of rows) {
    const cycles = projectCycles.get(row.projectId) ?? []
    cycles.push(row)
    projectCycles.set(row.projectId, cycles)
    recordCost(allReviewCosts,
      row.sourceAudit.id,
      Number.isFinite(row.sourceAudit.createdAt.getTime()) && row.sourceAudit.createdAt <= now
        ? costNumber(row.sourceAudit.runCost, now) : null,
    )
    for (const child of row.sourceAudit.monitoringAudits ?? []) {
      if (!child.createdAt || child.createdAt <= now) recordCost(allReviewCosts, child.id, costNumber(child.runCost, now))
    }

    const generatedEvent = firstEvent(row, ['GENERATED'])
    const recommendedEvent = firstEvent(row, ['RECOMMENDED'])
    const explicitEvent = firstEvent(row, ['ACCEPTED_EXPLICIT'])
    const inferredEvent = firstEvent(row, ['ACCEPTED_INFERRED'])
    const acceptedEvent = [explicitEvent, inferredEvent]
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]
    const attemptedEvent = firstEvent(row, ['ATTEMPTED'])
    const outcomeEvent = firstEvent(row, ['OUTCOME_ISSUED'])
    const latestOutcome = row.events.filter((event) => event.type === 'OUTCOME_ISSUED')
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).at(-1)
    const improvedEvent = firstEvent(row, ['IMPROVED'])

    if (generatedEvent) generated += 1
    if (recommendedEvent) recommended += 1
    if (explicitEvent) acceptedExplicit += 1
    if (inferredEvent) acceptedInferred += 1
    if (acceptedEvent) accepted += 1
    if (attemptedEvent) attempted += 1
    if (outcomeEvent) {
      outcomeIssued += 1
      if (latestOutcome?.outcome) outcomes[latestOutcome.outcome] += 1
      else unclassifiedOutcomeCount += 1
    }
    if (improvedEvent) {
      improved += 1
      if (recommendedEvent && explicitEvent) worthwhileImproved += 1
      addDuration(productToImproved, row.project.createdAt, improvedEvent.occurredAt, now)
    }

    for (const event of row.events) {
      if (event.type === 'REJECTED' && event.rejectionReason) {
        rejections[event.rejectionReason] += 1
      }
      if (event.type !== 'OUTCOME_ISSUED') continue
      if (!event.verificationAuditId) { unknownVerificationReferences++; continue }
      const verificationAudit = event.verificationAudit ?? event.attempt?.verificationAudit
      const cost = verificationAudit?.id === event.verificationAuditId
        ? costNumber(verificationAudit.runCost, now) : null
      recordCost(allReviewCosts, event.verificationAuditId, cost)
      recordCost(outcomeReviewCosts, event.verificationAuditId, cost)
    }

    if (row.occurrence) {
      addDuration(firstEvidenceDurations, row.sourceAudit.createdAt, row.occurrence.flag.createdAt, now)
    }
    if (recommendedEvent && acceptedEvent) {
      addDuration(recommendationToAcceptance, recommendedEvent.occurredAt, acceptedEvent.occurredAt, now)
    }
    if (acceptedEvent && attemptedEvent) {
      addDuration(acceptanceToAttempt, acceptedEvent.occurredAt, attemptedEvent.occurredAt, now)
    }
    if (attemptedEvent && outcomeEvent) {
      addDuration(attemptToOutcome, attemptedEvent.occurredAt, outcomeEvent.occurredAt, now)
    }
  }

  const productsWithSecondCycle = [...projectCycles.values()].filter((cycles) => {
    const ordered = [...cycles].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    return ordered.some((cycle, index) => {
      if (index === 0) return false
      return ordered.slice(0, index).some((earlier) => {
        const outcome = firstEvent(earlier, ['OUTCOME_ISSUED'])
        return outcome && cycle.createdAt > outcome.occurredAt
      })
    })
  }).length
  const oldest = rows.length > 0
    ? Math.min(...rows.map((row) => row.createdAt.getTime()))
    : null
  const reviewCostCoverage = costCoverage(allReviewCosts, unknownVerificationReferences)
  const outcomeCostCoverage = costCoverage(outcomeReviewCosts, unknownVerificationReferences)

  return {
    cohortSize: rows.length,
    cohortOldestDays: oldest === null ? null : (now.getTime() - oldest) / (24 * 3_600_000),
    matureCycleCount: rows.filter((row) => now.getTime() - row.createdAt.getTime() >= maturityMs).length,
    generated,
    recommended,
    accepted,
    acceptedExplicit,
    acceptedInferred,
    attempted,
    outcomeIssued,
    unclassifiedOutcomeCount,
    improved,
    outcomes,
    rejections,
    urlToFirstEvidence: durationDistribution(firstEvidenceDurations),
    recommendationToAcceptance: durationDistribution(recommendationToAcceptance),
    acceptanceToAttempt: durationDistribution(acceptanceToAttempt),
    attemptToOutcome: durationDistribution(attemptToOutcome),
    productToImproved: durationDistribution(productToImproved),
    fullyLoadedReviewCostPerImprovedUsd: costPerResult(reviewCostCoverage, improved),
    outcomeReviewCostPerOutcomeUsd: costPerResult(outcomeCostCoverage, outcomeIssued),
    reviewCostCoverage,
    outcomeCostCoverage,
    verifiedWorthwhileImprovementsPerActiveProduct:
      options.activeProductCount > 0 ? worthwhileImproved / options.activeProductCount : 0,
    activeProductCount: options.activeProductCount,
    productsWithSecondCycle,
  }
}
