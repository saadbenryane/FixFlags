import { recordedRunFlags, requiredAreasForScope } from '../assessment'
import { buildCoverageFacts, isAuditInFlight, pendingCoverageAreas, type CoverageExecution } from '../coverage'
import { readExecutionSpec } from '../domain/execution-spec'
import { asReviewDepth } from '@/lib/audit/review-depth'
import { siteCoverageMaxAgeMs } from '../evidence-freshness'
import type { WatchInterval } from '../watch-schedule'
import { applicableCategoryEvidence, overlayCategoryCoverage, type CategoryEvidenceAudit } from './category-evidence'
import { recordedPageEvidenceScope, type RecordedPageEvidenceScope } from '../page-coverage'
import type { FlagComparisonAuditScope } from '@/lib/audit/flag-comparison'

type EvidenceAudit = FlagComparisonAuditScope & {
  id: string; status: string; createdAt: Date; completedAt: Date | null;
  executionSpec?: unknown; reviewDepth?: number; evidenceCoverage: unknown; failedModules?: unknown;
  verifierExecutions?: CoverageExecution[]; pages?: readonly { url?: string }[];
}
type CurrentFlag = { checkId: string | null; rubric: string; severity: string; impactTag: string | null }

/** Current Site readers share source selection. Historical findings stay in
 * their recorded run; independently verified repairs determine current flags. */
export function projectCurrentSiteEvidence(input: {
  audit: EvidenceAudit | null; prior: EvidenceAudit | null; categories: CategoryEvidenceAudit[];
  flags: CurrentFlag[]; now: Date;
  evidenceComplete?: boolean;
  watchInterval?: WatchInterval | null; watchEveryMinutes?: number | null;
}) {
  const coverageMaxAgeMs = siteCoverageMaxAgeMs(input.watchInterval ?? null, input.watchEveryMinutes)
  const flags = input.flags.map(flag => ({ ...flag, status: 'OPEN' }))
  const spec = isAuditInFlight(input.audit?.status) ? readExecutionSpec(input.audit?.executionSpec) : null
  const pendingAreas = spec?.engine === 'progressive-v1' && spec.scope === 'SITE'
    ? pendingCoverageAreas(input.audit?.verifierExecutions ?? [], asReviewDepth(spec.reviewDepth ?? input.audit?.reviewDepth) >= 2) : undefined
  if (pendingAreas) {
    const admitted = new Set(requiredAreasForScope(spec))
    for (const area of pendingAreas) if (!admitted.has(area)) pendingAreas.delete(area)
  }
  const pageScope = input.audit ? recordedPageEvidenceScope(input.audit) : undefined
  const facts = (audit: EvidenceAudit | null, pageScope?: RecordedPageEvidenceScope) => ({ auditStatus: audit?.status ?? 'QUEUED', completedAt: audit?.completedAt ?? null,
    evidenceCoverage: audit?.evidenceCoverage, failedModules: audit?.failedModules,
    verifierExecutions: audit?.verifierExecutions, pageScope, flags, now: input.now, coverageMaxAgeMs })
  const lastKnown = input.prior ? overlayCategoryCoverage(buildCoverageFacts(facts(input.prior, recordedPageEvidenceScope(input.prior))),
    applicableCategoryEvidence(input.categories, input.prior), input.now, flags, coverageMaxAgeMs) : null
  const categoryEvidence = applicableCategoryEvidence(input.categories, input.audit)
  const coverage = overlayCategoryCoverage(buildCoverageFacts({ ...facts(input.audit, pageScope), pendingAreas, lastKnown,
    retainLastKnownWhileChecking: Boolean(lastKnown) }), categoryEvidence, input.now, flags, coverageMaxAgeMs)
  const published = recordedRunFlags({ executionSpec: input.audit?.executionSpec, audit: input.audit ? {
    ...input.audit, flags: [], verifierExecutions: input.audit.verifierExecutions ?? [],
  } : null })
  return { coverage, coverageMaxAgeMs, categoryEvidence, pendingAreas, pageScope, hasLastKnown: Boolean(lastKnown),
    assessmentComplete: published.comparisonComplete && published.evidenceComplete && input.evidenceComplete !== false }
}
