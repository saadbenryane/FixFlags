import type { ImprovementRejectionReason, VerificationOutcome } from '@prisma/client'

type CostValue = number | string | { toNumber(): number } | null | undefined

export type ImprovementValueRow = {
  id: string
  projectId: string
  createdAt: Date
  acceptedAt: Date | null
  rejectionReason: ImprovementRejectionReason | null
  project: { createdAt: Date }
  occurrences: Array<{
    audit: { id: string; createdAt: Date }
    flag: { createdAt: Date }
  }>
  attempts: Array<{
    createdAt: Date
    outcome: VerificationOutcome | null
    sourceAudit: { id: string; runCost: { estimatedCostUsd: CostValue } | null }
    verificationAudit: {
      id: string
      completedAt: Date | null
      runCost: { estimatedCostUsd: CostValue } | null
    } | null
  }>
}

export type ImprovementValueMetrics = {
  recommended: number
  accepted: number
  attempted: number
  verified: number
  outcomes: Record<VerificationOutcome, number>
  rejections: Record<ImprovementRejectionReason, number>
  urlToFirstEvidenceHours: number | null
  urlToValuableRecommendationHours: number | null
  recommendationToAttemptHours: number | null
  productToVerifiedImprovementHours: number | null
  costPerVerifiedImprovementUsd: number | null
  verifiedMeaningfulImprovementsPerActiveProduct: number
}

function averageHours(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length / 3_600_000
}

function costNumber(value: CostValue): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return value.toNumber()
}

export function calculateImprovementValueMetrics(
  rows: ImprovementValueRow[],
): ImprovementValueMetrics {
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
  const evidenceDurations = new Map<string, number>()
  const acceptedDurations: number[] = []
  const attemptDurations: number[] = []
  const productVerifiedAt = new Map<string, { productCreatedAt: Date; verifiedAt: Date }>()
  const billedAudits = new Map<string, number>()
  let accepted = 0
  let attempted = 0
  let verified = 0

  for (const row of rows) {
    if (row.acceptedAt) {
      accepted += 1
      const sourceCreatedAt = row.occurrences
        .map((occurrence) => occurrence.audit.createdAt.getTime())
        .sort((a, b) => a - b)[0]
      if (sourceCreatedAt != null) acceptedDurations.push(row.acceptedAt.getTime() - sourceCreatedAt)
    }
    if (row.rejectionReason) rejections[row.rejectionReason] += 1

    const firstAttempt = [...row.attempts].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0]
    if (firstAttempt) {
      attempted += 1
      attemptDurations.push(firstAttempt.createdAt.getTime() - row.createdAt.getTime())
    }

    if (row.attempts.some((attempt) => attempt.outcome && attempt.verificationAudit?.completedAt)) {
      verified += 1
    }

    for (const occurrence of row.occurrences) {
      const duration = occurrence.flag.createdAt.getTime() - occurrence.audit.createdAt.getTime()
      const current = evidenceDurations.get(occurrence.audit.id)
      if (current == null || duration < current) evidenceDurations.set(occurrence.audit.id, duration)
    }

    for (const attempt of row.attempts) {
      if (attempt.outcome) outcomes[attempt.outcome] += 1
      if (attempt.outcome !== 'IMPROVED' || !attempt.verificationAudit?.completedAt) continue

      const existing = productVerifiedAt.get(row.projectId)
      if (!existing || attempt.verificationAudit.completedAt < existing.verifiedAt) {
        productVerifiedAt.set(row.projectId, {
          productCreatedAt: row.project.createdAt,
          verifiedAt: attempt.verificationAudit.completedAt,
        })
      }
      billedAudits.set(
        attempt.sourceAudit.id,
        costNumber(attempt.sourceAudit.runCost?.estimatedCostUsd),
      )
      billedAudits.set(
        attempt.verificationAudit.id,
        costNumber(attempt.verificationAudit.runCost?.estimatedCostUsd),
      )
    }
  }

  const verifiedImprovementCount = outcomes.IMPROVED
  const activeProducts = new Set(rows.map((row) => row.projectId)).size
  const productVerifiedDurations = [...productVerifiedAt.values()].map(
    ({ productCreatedAt, verifiedAt }) => verifiedAt.getTime() - productCreatedAt.getTime(),
  )

  return {
    recommended: rows.length,
    accepted,
    attempted,
    verified,
    outcomes,
    rejections,
    urlToFirstEvidenceHours: averageHours([...evidenceDurations.values()]),
    urlToValuableRecommendationHours: averageHours(acceptedDurations),
    recommendationToAttemptHours: averageHours(attemptDurations),
    productToVerifiedImprovementHours: averageHours(productVerifiedDurations),
    costPerVerifiedImprovementUsd:
      verifiedImprovementCount > 0
        ? [...billedAudits.values()].reduce((sum, cost) => sum + cost, 0) /
          verifiedImprovementCount
        : null,
    verifiedMeaningfulImprovementsPerActiveProduct:
      activeProducts > 0 ? verifiedImprovementCount / activeProducts : 0,
  }
}
