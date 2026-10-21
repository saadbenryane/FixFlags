import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildCoverageFacts, isAuditInFlight, type CoverageFact, type CoverageExecution } from '../coverage'
import { readExecutionSpec, type CategoryArea } from '../domain/execution-spec'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'
import { categoryCoverageExecutionSelect } from './site-execution'
import { recordedWorkComplete, type RecordedCompletionTask } from '@/lib/audit/progressive/recorded-completeness'
import { executionPageCoverage } from '../page-coverage'
import { recordedRunFlags } from '../assessment'
import { analysisEnvironmentValueSql } from './analysis-scope'

const categorySelect = {
  id: true, parentId: true, projectId: true, executionSpec: true, status: true, createdAt: true, completedAt: true,
  evidenceCoverage: true, failedModules: true, failureCode: true,
  verifierExecutions: categoryCoverageExecutionSelect,
  pages: { select: { url: true, status: true } },
} satisfies Prisma.AuditSelect
export type CategoryEvidenceAudit = Prisma.AuditGetPayload<{ select: typeof categorySelect }>

export function categoryCoverageFact(audit: Pick<CategoryEvidenceAudit, 'id' | 'parentId' | 'executionSpec' | 'status' | 'completedAt' | 'evidenceCoverage' | 'failedModules' | 'failureCode' | 'pages'> &
  { verifierExecutions: Array<CoverageExecution & RecordedCompletionTask> }, now: Date,
  flags: Array<{ checkId: string | null; rubric: string; severity: string; impactTag: string | null }> = [], coverageMaxAgeMs?: number): CoverageFact | null {
  const spec = readExecutionSpec(audit.executionSpec)
  if (!spec?.category) return null
  const fact = buildCoverageFacts({ auditStatus: audit.status, completedAt: audit.completedAt, now, coverageMaxAgeMs,
    evidenceCoverage: audit.evidenceCoverage, failedModules: audit.failedModules,
    failureCode: audit.failureCode, verifierExecutions: audit.verifierExecutions, flags })
    .find(fact => fact.area === spec.category!.area)!
  const pagesComplete = executionPageCoverage({ executionSpec: audit.executionSpec, pages: audit.pages, executions: audit.verifierExecutions }).complete
  const requiredWorkFailed = Array.isArray(audit.failedModules) && audit.failedModules.length > 0
  const requiredWorkComplete = recordedWorkComplete(audit.verifierExecutions)
  const publication = recordedRunFlags({ executionSpec: audit.executionSpec, audit: { ...audit, flags: [] } })
  const published = publication.comparisonComplete && publication.evidenceComplete
  if (audit.status !== 'COMPLETED' || !pagesComplete || requiredWorkFailed || !requiredWorkComplete || !published) return { ...fact,
    state: fact.openFlagCount ? fact.state : 'unknown', evidenced: false, incompleteReason: fact.incompleteReason ?? SITE_ASSESSMENT_COPY.categoryIncomplete,
    label: isAuditInFlight(audit.status) ? SITE_ASSESSMENT_COPY.checkingCategory(spec.category.area) : fact.openFlagCount ? fact.label : SITE_ASSESSMENT_COPY.category.COULD_NOT_VERIFY }
  return fact
}

/** Select the latest attempt for each requested broad source and category.
 * A newer recheck of another inventory cannot retire the relevant attempt.
 * Failed and unfinished attempts remain authoritative about their own gaps. */
export async function loadCategoryEvidence(baselines: Array<{ projectId: string; auditId: string }>): Promise<CategoryEvidenceAudit[]> {
  if (!baselines.length) return []
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ON (requested."projectId", requested."auditId", candidate."executionSpec"#>>'{category,area}') candidate."id"
    FROM (VALUES ${Prisma.join(baselines.map(baseline => Prisma.sql`(${baseline.projectId}::text, ${baseline.auditId}::text)`))}) requested("projectId", "auditId")
    JOIN "audits" "source" ON "source"."projectId" = requested."projectId" AND "source"."id" = requested."auditId"
    JOIN "audits" candidate ON candidate."projectId" = requested."projectId"
      AND candidate."executionSpec"#>>'{category,sourceAuditId}' = requested."auditId"
    WHERE "source"."status" = 'COMPLETED' AND candidate."executionSpec"->>'scope' = 'CATEGORY'
      AND candidate."createdAt" >= "source"."createdAt"
      AND candidate."executionSpec"->'environment' = to_jsonb(${analysisEnvironmentValueSql})
    ORDER BY requested."projectId", requested."auditId", candidate."executionSpec"#>>'{category,area}', candidate."createdAt" DESC, candidate."id" DESC`
  if (!ids.length) return []
  return prisma.audit.findMany({ where: { id: { in: ids.map(row => row.id) }, projectId: { in: baselines.map(baseline => baseline.projectId) } }, select: categorySelect })
}

export function applicableCategoryEvidence(audits: CategoryEvidenceAudit[], baseline: { id: string; status: string; createdAt: Date } | null) {
  const selected = new Map<CategoryArea, CategoryEvidenceAudit>()
  if (baseline?.status !== 'COMPLETED') return selected
  for (const audit of audits) {
    const spec = readExecutionSpec(audit.executionSpec)
    if (spec?.category?.sourceAuditId !== baseline.id || audit.createdAt < baseline.createdAt) continue
    const area = spec.category.area, previous = selected.get(area)
    if (!previous || previous.createdAt < audit.createdAt || previous.createdAt.getTime() === audit.createdAt.getTime() && previous.id < audit.id)
      selected.set(area, audit)
  }
  return selected
}

/** Replace exactly one area's current evidence. The broad inventory, other
 * areas and their timestamps remain tied to the full-site execution. */
export function overlayCategoryCoverage(base: CoverageFact[], audits: Map<CategoryArea, CategoryEvidenceAudit>, now: Date,
  flags: Array<{ checkId: string | null; rubric: string; severity: string; impactTag: string | null }> = [], coverageMaxAgeMs?: number): CoverageFact[] {
  return base.map(previous => {
    const audit = audits.get(previous.area as CategoryArea)
    const spec = audit && readExecutionSpec(audit.executionSpec)
    if (!audit || !spec?.category) return previous
    const fact = categoryCoverageFact(audit, now, flags, coverageMaxAgeMs)!
    return { ...fact, checkedAt: fact.checkedAt ?? previous.checkedAt }
  })
}
