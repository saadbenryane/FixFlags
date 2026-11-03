/** Provider records are independent. Invalid optional fields cannot supply a
 * measurement, and cannot invalidate another audit in the same response. */
export function lighthouseRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function lighthouseAuditMeasured(value: unknown): boolean {
  const audit = lighthouseRecord(value)
  if (!audit) return false
  if (audit.errorMessage !== undefined && (typeof audit.errorMessage !== 'string' || audit.errorMessage.length > 0)) return false
  if (audit.notApplicable !== undefined && audit.notApplicable !== false) return false
  return audit.scoreDisplayMode === undefined || typeof audit.scoreDisplayMode === 'string' &&
    !['error', 'notApplicable', 'manual', 'informative'].includes(audit.scoreDisplayMode)
}

export function lighthouseScore(value: unknown): number | null {
  const score = lighthouseRecord(value)?.score
  return lighthouseAuditMeasured(value) && typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1 ? score : null
}

export function lighthouseMetric(value: unknown): number | null {
  const metric = lighthouseRecord(value)?.numericValue
  return lighthouseAuditMeasured(value) && typeof metric === 'number' && Number.isFinite(metric) && metric >= 0 ? metric : null
}
