export const IMPROVEMENT_REJECTION_REASONS = [
  'WRONG',
  'ALREADY_KNOWN',
  'LOW_IMPACT',
  'POOR_TIMING',
  'TOO_COSTLY',
  'WEAK_RECOMMENDATION',
  'MISUNDERSTOOD_PRODUCT_CONTEXT',
] as const

export type ImprovementRejectionReason = (typeof IMPROVEMENT_REJECTION_REASONS)[number]

const LEGACY_REJECTION_REASON_MAP = {
  incorrect: 'WRONG',
  intentional: 'MISUNDERSTOOD_PRODUCT_CONTEXT',
  low_priority: 'LOW_IMPACT',
  duplicate: 'WEAK_RECOMMENDATION',
} as const satisfies Record<string, ImprovementRejectionReason>

export function normalizeImprovementRejectionReason(
  value: string | null | undefined,
): ImprovementRejectionReason | null {
  if (!value || value === 'already_fixed') return null
  if ((IMPROVEMENT_REJECTION_REASONS as readonly string[]).includes(value)) {
    return value as ImprovementRejectionReason
  }
  return LEGACY_REJECTION_REASON_MAP[value as keyof typeof LEGACY_REJECTION_REASON_MAP] ?? null
}
