import type {
  ImprovementCycleEventType,
  ImprovementRejectionReason,
  VerificationOutcome,
} from '@prisma/client'

type CostValue = number | string | { toNumber(): number } | null | undefined

export type ImprovementValueCycleRow = {
  id: string
  projectId: string
  createdAt: Date
  project: { createdAt: Date }
  occurrence: { flag: { createdAt: Date } } | null
  sourceAudit: {
    id: string
    createdAt: Date
    runCost: { estimatedCostUsd: CostValue } | null
    monitoringAudits?: Array<{
      id: string
      runCost: { estimatedCostUsd: CostValue } | null
    }>
  }
  events: Array<{
    type: ImprovementCycleEventType
    occurredAt: Date
    outcome: VerificationOutcome | null
    rejectionReason: ImprovementRejectionReason | null
    attempt: {
      verificationAudit: {
        id: string
        completedAt: Date | null
        runCost: { estimatedCostUsd: CostValue } | null
      } | null
    } | null
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
  verifiedWorthwhileImprovementsPerActiveProduct: number
  activeProductCount: number
  productsWithSecondCycle: number
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

function costNumber(value: CostValue): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return value.toNumber()
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
  const allReviewCosts = new Map<string, number>()
  const outcomeReviewCosts = new Map<string, number>()
  const projectCycles = new Map<string, ImprovementValueCycleRow[]>()
  let generated = 0
  let recommended = 0
  let accepted = 0
  let acceptedExplicit = 0
  let acceptedInferred = 0
  let attempted = 0
  let outcomeIssued = 0
  let improved = 0
  let worthwhileImproved = 0

  for (const row of rows) {
    const cycles = projectCycles.get(row.projectId) ?? []
    cycles.push(row)
    projectCycles.set(row.projectId, cycles)
    allReviewCosts.set(
      row.sourceAudit.id,
      costNumber(row.sourceAudit.runCost?.estimatedCostUsd),
    )
    for (const child of row.sourceAudit.monitoringAudits ?? []) {
      allReviewCosts.set(child.id, costNumber(child.runCost?.estimatedCostUsd))
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
    const improvedEvent = firstEvent(row, ['IMPROVED'])

    if (generatedEvent) generated += 1
    if (recommendedEvent) recommended += 1
    if (explicitEvent) acceptedExplicit += 1
    if (inferredEvent) acceptedInferred += 1
    if (acceptedEvent) accepted += 1
    if (attemptedEvent) attempted += 1
    if (outcomeEvent) {
      outcomeIssued += 1
      if (outcomeEvent.outcome) outcomes[outcomeEvent.outcome] += 1
    }
    if (improvedEvent) {
      improved += 1
      if (recommendedEvent && explicitEvent) worthwhileImproved += 1
      productToImproved.push(
        improvedEvent.occurredAt.getTime() - row.project.createdAt.getTime(),
      )
    }

    for (const event of row.events) {
      if (event.type === 'REJECTED' && event.rejectionReason) {
        rejections[event.rejectionReason] += 1
      }
      const verificationAudit = event.attempt?.verificationAudit
      if (!verificationAudit) continue
      const cost = costNumber(verificationAudit.runCost?.estimatedCostUsd)
      allReviewCosts.set(verificationAudit.id, cost)
      if (event.type === 'OUTCOME_ISSUED') outcomeReviewCosts.set(verificationAudit.id, cost)
    }

    if (row.occurrence) {
      firstEvidenceDurations.push(
        row.occurrence.flag.createdAt.getTime() - row.sourceAudit.createdAt.getTime(),
      )
    }
    if (recommendedEvent && acceptedEvent) {
      recommendationToAcceptance.push(
        acceptedEvent.occurredAt.getTime() - recommendedEvent.occurredAt.getTime(),
      )
    }
    if (acceptedEvent && attemptedEvent) {
      acceptanceToAttempt.push(
        attemptedEvent.occurredAt.getTime() - acceptedEvent.occurredAt.getTime(),
      )
    }
    if (attemptedEvent && outcomeEvent) {
      attemptToOutcome.push(
        outcomeEvent.occurredAt.getTime() - attemptedEvent.occurredAt.getTime(),
      )
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
    improved,
    outcomes,
    rejections,
    urlToFirstEvidence: durationDistribution(firstEvidenceDurations),
    recommendationToAcceptance: durationDistribution(recommendationToAcceptance),
    acceptanceToAttempt: durationDistribution(acceptanceToAttempt),
    attemptToOutcome: durationDistribution(attemptToOutcome),
    productToImproved: durationDistribution(productToImproved),
    fullyLoadedReviewCostPerImprovedUsd: improved > 0
      ? [...allReviewCosts.values()].reduce((sum, cost) => sum + cost, 0) / improved
      : null,
    outcomeReviewCostPerOutcomeUsd: outcomeIssued > 0
      ? [...outcomeReviewCosts.values()].reduce((sum, cost) => sum + cost, 0) / outcomeIssued
      : null,
    verifiedWorthwhileImprovementsPerActiveProduct:
      options.activeProductCount > 0 ? worthwhileImproved / options.activeProductCount : 0,
    activeProductCount: options.activeProductCount,
    productsWithSecondCycle,
  }
}
