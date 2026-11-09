/** Provider records are independent. Invalid optional fields cannot supply a
 * measurement, and cannot invalidate another audit in the same response. */
export function lighthouseRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function measuredLighthouseAudit(value: unknown, id: string): Record<string, unknown> | undefined {
  const audit = lighthouseRecord(value)
  if (!audit || audit.id !== undefined && audit.id !== id) return undefined
  if (audit.errorMessage !== undefined && audit.errorMessage !== '' ||
    audit.notApplicable !== undefined && audit.notApplicable !== false) return undefined
  const mode = audit.scoreDisplayMode
  return mode === undefined || mode === 'binary' || mode === 'numeric' || mode === 'metricSavings' ? audit : undefined
}

export function lighthouseScore(value: unknown, id: string): number | null {
  const score = measuredLighthouseAudit(value, id)?.score
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1 ? score : null
}

export function lighthouseMetric(value: unknown, id: string, unit: 'millisecond' | 'unitless'): number | null {
  const audit = measuredLighthouseAudit(value, id)
  if (!audit || audit.numericUnit !== undefined && audit.numericUnit !== unit) return null
  const metric = audit.numericValue
  return typeof metric === 'number' && Number.isFinite(metric) && metric >= 0 ? metric : null
}
