import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { readExecutionSpec } from './domain/execution-spec'
import type { CoverageFact } from './coverage'
import { SITE_COVERAGE_MAX_AGE_MS, siteCoverageIsStale } from './evidence-freshness'
import type { SiteCardArea } from './card-areas'
import type { CustomerOutcomeState } from './outcome-state'
import { FLAG_COMPARISON_TARGET, readFlagComparison, comparisonEvidenceComplete } from '@/lib/audit/flag-comparison'
import { isCustomerFlag, hasUnresolvedFlagEvidence, type CustomerFlagInput } from '@/lib/audit/attention'
import { taskArtifactSchema } from '@/lib/audit/progressive/contracts'
import { accountResultSchema } from './accounts/contracts'
import type { SiteAssessment, AssessmentGap } from './assessment-contract'
import type { uptimeAssessment } from '@/lib/uptime/status'
export type { SiteAssessment, AssessmentGap } from './assessment-contract'

/** Historical run conclusions use immutable comparison receipts. Mutable Flag
 * lifecycle state describes current attention, not what an earlier run found.
 * comparisonComplete establishes publication independently of historical
 * inconclusive recoveries, which can later receive an independent repair. */
export function recordedRunFlags(input: { executionSpec: unknown; audit: {
  id: string; parentId: string | null; flags: CustomerFlagInput[];
  verifierExecutions: Array<{ targetKey: string; status: string; detail?: unknown }>;
} | null }): { flags: CustomerFlagInput[]; complete: boolean; comparisonComplete: boolean; evidenceComplete: boolean } {
  const spec = readExecutionSpec(input.executionSpec)
  if (spec?.engine !== 'progressive-v1' || !['SITE', 'CATEGORY'].includes(spec.scope)) {
    const evidenceComplete = !(input.audit?.flags ?? []).some(hasUnresolvedFlagEvidence)
    return { flags: input.audit?.flags ?? [], complete: evidenceComplete, comparisonComplete: true, evidenceComplete }
  }
  const receipt = input.audit?.verifierExecutions.find(record => record.targetKey === FLAG_COMPARISON_TARGET && record.status === 'COMPLETED')
  if (!receipt || !input.audit) return { flags: [], complete: false, comparisonComplete: false, evidenceComplete: false }
  try {
    const comparison = readFlagComparison(receipt.detail, { auditId: input.audit.id, parentAuditId: input.audit.parentId })
    const retained = comparison.inconclusive.filter(isCustomerFlag)
    const evidenceComplete = comparisonEvidenceComplete(comparison)
    return { flags: [...comparison.newIssues, ...comparison.unchanged, ...comparison.regressed, ...retained],
      complete: retained.length === 0 && evidenceComplete, comparisonComplete: true, evidenceComplete }
  } catch { return { flags: [], complete: false, comparisonComplete: false, evidenceComplete: false } }
}

export type DiagnosticAttemptReceipt = {
  id: string; sourceAuditId: string; verificationAuditId: string | null;
  comparable: boolean | null; outcome: string | null; evidenceReference: unknown;
}

/** A diagnostic conclusion belongs to the admitted attempt and its original
 * source. Unrelated findings and later attempts cannot certify this repair. */
export function recordedDiagnosticConclusion(input: { executionSpec: unknown; audit: {
  id: string; parentId: string | null; verificationAttempts: DiagnosticAttemptReceipt[];
} | null }): { state: CustomerOutcomeState; complete: boolean } | null {
  const spec = readExecutionSpec(input.executionSpec)
  if (spec?.scope !== 'DIAGNOSTIC') return null
  const target = spec.verificationTarget
  if (target?.kind !== 'DIAGNOSTIC' || !input.audit || input.audit.parentId !== target.parentAuditId)
    return { state: 'COULD_NOT_VERIFY', complete: false }
  const receipt = input.audit.verificationAttempts.find(attempt => attempt.id === target.attemptId &&
    attempt.sourceAuditId === target.parentAuditId && attempt.verificationAuditId === input.audit!.id)
  const reference = receipt?.evidenceReference as { beforeAuditId?: unknown; afterAuditId?: unknown } | null | undefined
  if (!receipt || receipt.comparable !== true || reference?.beforeAuditId !== target.parentAuditId ||
    reference.afterAuditId !== input.audit.id || !['IMPROVED', 'UNCHANGED', 'REGRESSED'].includes(receipt.outcome ?? ''))
    return { state: 'COULD_NOT_VERIFY', complete: false }
  return { state: receipt.outcome === 'IMPROVED' ? 'CLEAR' : 'FLAG', complete: true }
}

/** Only a committed account task supplies a run conclusion. Configuration
 * readiness or the absence of account Flags is never successful execution. */
export function recordedAccountConclusion(executionSpec: unknown, taskResult: unknown): { state: CustomerOutcomeState; complete: boolean } | null {
  const spec = readExecutionSpec(executionSpec)
  if (spec?.scope !== 'ACCOUNT_CHECKS') return null
  const artifact = taskArtifactSchema.safeParse(taskResult)
  const observations = accountResultSchema.safeParse({ observations: artifact.success ? artifact.data.data.observations : null })
  if (!artifact.success || artifact.data.kind !== 'automatic-accounts' || !observations.success ||
    observations.data.observations.some(item => new URL(item.pageUrl).origin !== new URL(spec.accountChecks?.siteUrl ?? spec.targetUrl).origin ||
      spec.accountChecks?.mode === 'cleanup' && item.kind !== 'deletion'))
    return { state: 'COULD_NOT_VERIFY', complete: false }
  const complete = observations.data.observations.every(item => ['verified', 'failed'].includes(item.state))
  return { state: observations.data.observations.some(item => item.state === 'failed') ? 'FLAG'
    : complete ? 'CLEAR' : 'COULD_NOT_VERIFY', complete }
}

/** Historical broad analyses retain their original public responsibilities. */
export const LEGACY_BROAD_REQUIRED_AREAS: readonly SiteCardArea[] = ['conversion', 'security', 'search', 'performance', 'tracking']

export function requiredAreasForScope(executionSpec: unknown): SiteCardArea[] {
  const spec = readExecutionSpec(executionSpec)
  if (!spec) return [...LEGACY_BROAD_REQUIRED_AREAS]
  if (spec.category) return [spec.category.area]
  return [...new Set(Object.keys(spec.checks).flatMap(id => {
    const area = CHECK_REGISTRY[id]?.area
    return area && area !== 'site' ? [area] : []
  }))]
}

/** Callers supply recorded run findings or current active findings explicitly.
 * The conclusion is otherwise identical across run, board and list readers. */
export function projectSiteAssessment(input: {
  status: string | null;
  executionSpec?: unknown;
  requiredAreas?: readonly SiteCardArea[];
  coverage: CoverageFact[];
  flags: Array<{ severity?: string | null }>;
  now: Date;
  coverageMaxAgeMs?: number;
  pagesComplete?: boolean;
  checkedAt?: Date | null;
  assessmentComplete?: boolean;
  scopedConclusion?: { state: CustomerOutcomeState; complete: boolean; validUntil?: Date | null } | null;
  outcomes?: Array<{ id?: string; state: CustomerOutcomeState; enabled?: boolean; validUntil?: Date | null }>;
  uptime?: ReturnType<typeof uptimeAssessment>;
}): SiteAssessment {
  const requiredAreas = [...input.requiredAreas ?? requiredAreasForScope(input.executionSpec)]
  const watched = (input.outcomes ?? []).filter(outcome => outcome.enabled !== false)
  const gaps: AssessmentGap[] = []
  if (input.uptime?.state === 'COULD_NOT_VERIFY' || input.uptime?.observedState === 'unknown' || input.uptime?.observedState === 'checking')
    gaps.push({ area: 'uptime', reason: 'incomplete' })
  if (input.assessmentComplete === false) gaps.push({ area: null, reason: 'unassessed' })
  if (input.scopedConclusion && (!input.scopedConclusion.complete || input.scopedConclusion.state === 'COULD_NOT_VERIFY'))
    gaps.push({ area: null, reason: 'incomplete' })
  else if (input.scopedConclusion && (input.scopedConclusion.state === 'STALE' ||
    input.scopedConclusion.validUntil && input.scopedConclusion.validUntil <= input.now))
    gaps.push({ area: null, reason: 'stale' })
  const spec = readExecutionSpec(input.executionSpec)
  if (spec && Object.entries(spec.checks).some(([id, version]) => !CHECK_REGISTRY[id] || CHECK_REGISTRY[id].version !== version))
    gaps.push({ area: null, reason: 'unassessed' })
  for (const area of requiredAreas) {
    const fact = input.coverage.find(fact => fact.area === area)
    if (!fact) gaps.push({ area, reason: 'missing' })
    else if (!fact.evidenced || fact.state === 'unknown' || fact.incompleteReason) gaps.push({ area, reason: fact.stale ? 'stale' : 'incomplete' })
    else if (siteCoverageIsStale(fact.checkedAt, input.now, input.coverageMaxAgeMs)) gaps.push({ area, reason: 'stale' })
  }
  if (input.pagesComplete === false) gaps.push({ area: 'site', reason: 'pages' })
  for (const outcome of watched) if (outcome.state === 'STALE' || outcome.state === 'COULD_NOT_VERIFY')
    gaps.push({ area: null, ...(outcome.id ? { outcomeId: outcome.id } : {}), reason: outcome.state === 'STALE' ? 'stale' : 'incomplete' })
  if (requiredAreas.length === 0 && watched.length === 0 && !input.scopedConclusion) gaps.push({ area: null, reason: 'unassessed' })
  const settled = input.status === 'COMPLETED' || input.status === 'FAILED'
  const incomplete = gaps.some(gap => gap.reason !== 'stale')
  const result = !settled ? null : input.status === 'FAILED' ? 'FAILED'
    : input.flags.length > 0 || watched.some(outcome => outcome.state === 'FLAG') || input.scopedConclusion?.state === 'FLAG' || input.uptime?.state === 'FLAG' ? 'FLAG'
      : incomplete ? 'COULD_NOT_VERIFY' : gaps.length > 0 ? 'STALE' : 'CLEAR'
  const dates = requiredAreas.flatMap(area => {
    const date = input.coverage.find(fact => fact.area === area)?.checkedAt
    return date && Number.isFinite(Date.parse(date)) ? [Date.parse(date) + (input.coverageMaxAgeMs ?? SITE_COVERAGE_MAX_AGE_MS)] : []
  })
  for (const outcome of watched) if (outcome.validUntil) dates.push(outcome.validUntil.getTime())
  if (input.scopedConclusion?.validUntil) dates.push(input.scopedConclusion.validUntil.getTime())
  if (input.uptime?.validUntil) dates.push(input.uptime.validUntil.getTime())
  return { result, completeness: !settled ? 'PENDING' : input.status === 'FAILED' || incomplete ? 'PARTIAL' : 'FULL',
    requiredAreas, gaps, checkedAt: input.checkedAt?.toISOString() ?? null,
    validUntil: dates.length ? new Date(Math.min(...dates)).toISOString() : null }
}
