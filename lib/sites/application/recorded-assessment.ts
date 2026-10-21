import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { FLAG_COMPARISON_TARGET, readFlagComparisonFacts, comparisonEvidenceComplete, type FlagDiffSummary } from '@/lib/audit/flag-comparison'
import type { CustomerFlagInput } from '@/lib/audit/attention'
import { isCustomerFlag, hasUnavailableFlagEvidence } from '@/lib/audit/attention'
import { recordedSiteAssessmentSchema, type SiteAssessment } from '../assessment-contract'
import { projectSiteAssessment, recordedRunFlags } from '../assessment'
import { canonicalIntent, readExecutionSpec } from '../domain/execution-spec'
import { currentOutcomeState } from '../outcome-state'
import { buildCoverageFacts, type CoverageExecution } from '../coverage'
import { executionPageCoverage } from '../page-coverage'
import { categoryCoverageFact, type CategoryEvidenceAudit } from './category-evidence'
import { categoryCoverageExecutionSelect } from './site-execution'
import type { RecordedCompletionTask } from '@/lib/audit/progressive/recorded-completeness'

type AssessmentObservation = { outcomeId: string; state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'; validUntil: Date }
type RecordedAudit = Pick<CategoryEvidenceAudit, 'id' | 'parentId' | 'status' | 'completedAt' | 'executionSpec' |
  'evidenceCoverage' | 'failedModules' | 'failureCode' | 'pages'> & {
  verifierExecutions: Array<CoverageExecution & RecordedCompletionTask>;
  flags: CustomerFlagInput[];
}
function specHash(spec: unknown) { return createHash('sha256').update(canonicalIntent(spec)).digest('hex') }
const findingGroups = ['newIssues', 'unchanged', 'regressed', 'inconclusive'] as const
function customerReferences(summary: FlagDiffSummary) {
  return findingGroups.flatMap(group => summary[group].flatMap((flag, index) =>
    isCustomerFlag(group === 'inconclusive' ? flag : { ...flag, status: undefined }) ? [{ group, index }] : []))
}
type RecordedSiteResult = { assessment: SiteAssessment; findings: FlagDiffSummary['newIssues'] | null }

/** Read the published conclusion without applying today's detector definitions.
 * Legacy receipts retain the existing evidence-based interpretation. */
export function projectRecordedSiteResult(input: {
  audit: RecordedAudit; executionSpec?: Prisma.JsonValue; status?: string; assessments: AssessmentObservation[]; now: Date;
}): RecordedSiteResult {
  const { audit, now } = input, executionSpec = input.executionSpec ?? audit.executionSpec
  const spec = readExecutionSpec(executionSpec), status = input.status ?? audit.status
  const publication = audit.verifierExecutions.find(row => row.targetKey === FLAG_COMPARISON_TARGET && row.status === 'COMPLETED')
  let invalidSnapshot = false
  let findings: RecordedSiteResult['findings'] = null
  let facts: ReturnType<typeof readFlagComparisonFacts> | undefined
  if (publication) {
    try {
      facts = readFlagComparisonFacts(publication.detail, { auditId: audit.id, parentAuditId: audit.parentId })
      if (facts.siteAssessment !== undefined) {
        const saved = recordedSiteAssessmentSchema.parse(facts.siteAssessment)
        if (!spec || !['SITE', 'CATEGORY'].includes(spec.scope) || saved.specHash !== specHash(executionSpec) ||
          saved.assessment.checkedAt !== audit.completedAt?.toISOString()) throw new Error('Recorded assessment scope changed')
        const summary = facts.summary
        const savedFindings = saved.customerFlags.map(item => summary[item.group][item.index])
        if (savedFindings.some(item => !item || hasUnavailableFlagEvidence(item)) ||
          saved.assessment.completeness === 'FULL' && !comparisonEvidenceComplete(summary)) throw new Error('Recorded finding evidence changed')
        findings = savedFindings
        if (status === 'COMPLETED' && audit.status === 'COMPLETED') {
          const assessment: SiteAssessment = saved.assessment
          if (assessment.validUntil && Date.parse(assessment.validUntil) <= now.getTime() && !assessment.gaps.some(gap => gap.reason === 'stale'))
            return { assessment: { ...assessment, result: assessment.result === 'CLEAR' ? 'STALE' : assessment.result,
              gaps: [...assessment.gaps, { area: null, reason: 'stale' }] }, findings }
          return { assessment, findings }
        }
      }
    } catch { invalidSnapshot = true }
  }
  if (facts && findings === null) {
    const summary = facts.summary
    findings = customerReferences(summary).map(item => summary[item.group][item.index])
  }
  const coverage = spec?.category ? [categoryCoverageFact({ ...audit, executionSpec }, now)!] : buildCoverageFacts({
    auditStatus: audit.status, completedAt: audit.completedAt, now, evidenceCoverage: audit.evidenceCoverage,
    failedModules: audit.failedModules, failureCode: audit.failureCode, verifierExecutions: audit.verifierExecutions, flags: [],
  })
  const recorded = recordedRunFlags({ executionSpec, audit })
  const assessment = projectSiteAssessment({ status, executionSpec, coverage, now, checkedAt: audit.completedAt,
    pagesComplete: executionPageCoverage({ executionSpec, pages: audit.pages, executions: audit.verifierExecutions }).complete,
    flags: recorded.flags.filter(flag => isCustomerFlag({ ...flag, status: undefined })),
    assessmentComplete: recorded.complete && !invalidSnapshot,
    outcomes: spec?.outcomes.map(outcome => {
      const assessment = input.assessments.find(item => item.outcomeId === outcome.id)
      return { id: outcome.id, state: currentOutcomeState(assessment ?? null, now), validUntil: assessment?.validUntil }
    }),
  })
  return { assessment, findings }
}

/** Prepare a conclusion for the comparison being committed. Read-only callers
 * never backfill old publications or replace their original conclusions. */
export async function preparePublishedSiteAssessment(auditId: string, comparison: unknown) {
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: {
    id: true, parentId: true, status: true, completedAt: true, executionSpec: true,
    evidenceCoverage: true, failedModules: true, failureCode: true,
    pages: { select: { url: true, status: true } }, verifierExecutions: categoryCoverageExecutionSelect,
    outcomeAssessments: { select: { outcomeId: true, state: true, validUntil: true } },
  } })
  if (audit.status !== 'COMPLETED' || !audit.completedAt) throw new Error('A Site conclusion requires its completed observation')
  const facts = readFlagComparisonFacts(comparison, { auditId: audit.id, parentAuditId: audit.parentId })
  const { assessment } = projectRecordedSiteResult({
    audit: { ...audit, flags: [], verifierExecutions: [...audit.verifierExecutions.filter(row => row.targetKey !== FLAG_COMPARISON_TARGET),
      { targetKey: FLAG_COMPARISON_TARGET, status: 'COMPLETED', detail: comparison }] },
    assessments: audit.outcomeAssessments, now: audit.completedAt,
  })
  return recordedSiteAssessmentSchema.parse({ version: 1, specHash: specHash(audit.executionSpec),
    customerFlags: customerReferences(facts.summary), assessment })
}
