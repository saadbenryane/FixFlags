import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildCoverageFacts, isAuditInFlight, type CoverageFact, type CoverageExecution } from '../coverage'
import { readExecutionSpec, type CategoryArea } from '../domain/execution-spec'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'
import { categoryCoverageExecutionSelect } from './site-execution'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'

const categorySelect = {
  id: true, projectId: true, executionSpec: true, status: true, createdAt: true, completedAt: true,
  evidenceCoverage: true, failedModules: true, failureCode: true,
  verifierExecutions: categoryCoverageExecutionSelect,
  pages: { select: { url: true, status: true } },
} satisfies Prisma.AuditSelect
export type CategoryEvidenceAudit = Prisma.AuditGetPayload<{ select: typeof categorySelect }>

export function categoryCoverageFact(audit: Pick<CategoryEvidenceAudit, 'executionSpec' | 'status' | 'completedAt' | 'evidenceCoverage' | 'failedModules' | 'failureCode' | 'pages'> &
  { verifierExecutions: Array<CoverageExecution & { workState?: string | null }> }, now: Date,
  flags: Array<{ checkId: string | null; rubric: string; severity: string; impactTag: string | null }> = []): CoverageFact | null {
  const spec = readExecutionSpec(audit.executionSpec)
  if (!spec?.category) return null
  const fact = buildCoverageFacts({ auditStatus: audit.status, completedAt: audit.completedAt, now,
    evidenceCoverage: audit.evidenceCoverage, failedModules: audit.failedModules,
    failureCode: audit.failureCode, verifierExecutions: audit.verifierExecutions, flags })
    .find(fact => fact.area === spec.category!.area)!
  const pagesComplete = spec.category.pages.every(url => audit.pages.some(page => page.url === url && page.status === 'COMPLETED'))
  const requiredWorkFailed = Array.isArray(audit.failedModules) && audit.failedModules.length > 0
  const requiredWorkComplete = initialTaskPlan(spec).filter(task => task.kind !== 'finalize').every(task =>
    audit.verifierExecutions.some(record => record.targetKey === 'task:' + task.key &&
      (record.workState === 'COMPLETED' || record.status === 'NOT_APPLICABLE')))
  if (audit.status !== 'COMPLETED' || !pagesComplete || requiredWorkFailed || !requiredWorkComplete) return { ...fact,
    state: fact.openFlagCount ? fact.state : 'unknown', evidenced: false, incompleteReason: fact.incompleteReason ?? SITE_ASSESSMENT_COPY.categoryIncomplete,
    label: isAuditInFlight(audit.status) ? SITE_ASSESSMENT_COPY.checkingCategory(spec.category.area) : fact.openFlagCount ? fact.label : SITE_ASSESSMENT_COPY.category.COULD_NOT_VERIFY }
  return fact
}

/** One latest attempt per project and category. Failed and unfinished attempts
 * are included so an older successful recheck cannot conceal a current gap. */
export async function loadCategoryEvidence(projectIds: string[]): Promise<CategoryEvidenceAudit[]> {
  if (!projectIds.length) return []
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ON ("projectId", "executionSpec"#>>'{category,area}') "id"
    FROM "audits" WHERE "projectId" IN (${Prisma.join(projectIds)})
      AND "executionSpec"->>'scope' = 'CATEGORY'
    ORDER BY "projectId", "executionSpec"#>>'{category,area}', "createdAt" DESC, "id" DESC`
  if (!ids.length) return []
  return prisma.audit.findMany({ where: { id: { in: ids.map(row => row.id) }, projectId: { in: projectIds } }, select: categorySelect })
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
  flags: Array<{ checkId: string | null; rubric: string; severity: string; impactTag: string | null }> = []): CoverageFact[] {
  return base.map(previous => {
    const audit = audits.get(previous.area as CategoryArea)
    const spec = audit && readExecutionSpec(audit.executionSpec)
    if (!audit || !spec?.category) return previous
    const fact = categoryCoverageFact(audit, now, flags)!
    return { ...fact, checkedAt: fact.checkedAt ?? previous.checkedAt }
  })
}
