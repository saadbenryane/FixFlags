import { recordedRunFlags } from '../assessment'
import { buildCoverageFacts, type CoverageExecution } from '../coverage'
import { siteCoverageMaxAgeMs } from '../evidence-freshness'
import type { WatchInterval } from '../watch-schedule'
import { applicableCategoryEvidence, overlayCategoryCoverage, type CategoryEvidenceAudit } from './category-evidence'

type EvidenceAudit = {
  id: string; parentId?: string | null; status: string; createdAt: Date; completedAt: Date | null;
  executionSpec?: unknown; evidenceCoverage: unknown; failedModules?: unknown; failureCode?: string | null;
  triageAt?: Date | null; aiReviewAt?: Date | null; verifierExecutions?: CoverageExecution[];
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
  const facts = (audit: EvidenceAudit | null) => ({ auditStatus: audit?.status ?? 'QUEUED', completedAt: audit?.completedAt ?? null,
    evidenceCoverage: audit?.evidenceCoverage, failedModules: audit?.failedModules, failureCode: audit?.failureCode,
    triageCompleted: Boolean(audit?.triageAt), extraReviewCompleted: Boolean(audit?.aiReviewAt),
    verifierExecutions: audit?.verifierExecutions, flags, now: input.now, coverageMaxAgeMs })
  const lastKnown = input.prior ? buildCoverageFacts(facts(input.prior)) : null
  const categoryEvidence = applicableCategoryEvidence(input.categories, input.audit)
  const coverage = overlayCategoryCoverage(buildCoverageFacts({ ...facts(input.audit), lastKnown,
    retainLastKnownWhileChecking: Boolean(lastKnown) }), categoryEvidence, input.now, flags, coverageMaxAgeMs)
  const published = recordedRunFlags({ executionSpec: input.audit?.executionSpec, audit: input.audit ? {
    id: input.audit.id, parentId: input.audit.parentId ?? null, flags: [], verifierExecutions: input.audit.verifierExecutions ?? [],
  } : null })
  return { coverage, coverageMaxAgeMs, categoryEvidence, hasLastKnown: Boolean(lastKnown),
    assessmentComplete: published.comparisonComplete && published.evidenceComplete && input.evidenceComplete !== false }
}
