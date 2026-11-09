import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { monitoringHistoryMetadata } from '@/lib/sites/monitoring-history'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { loadSiteAnalysisSelection } from './legacy-analysis'
import { analysisEvidenceTaskWhere } from '@/lib/audit/progressive/contracts'
import { FLAG_COMPARISON_TARGET, flagComparisonAuditScopeSelect } from '@/lib/audit/flag-comparison'
import { sameSiteRunAuditWhere } from './analysis-scope'

/** Prior observations omit comparison snapshots and full task artifacts. */
export const siteObservationExecutionSelect = {
  where: { OR: [{ targetKey: { startsWith: 'module:' } }, { workKind: 'keyboard' },
    { workKind: 'browser' }, { workKind: 'captures' }] },
  select: { recordKind: true, id: true, targetKey: true, scopeKey: true, status: true, pageUrl: true, taskId: true, workKind: true, workState: true, detail: true, updatedAt: true },
} satisfies Prisma.Audit$verifierExecutionsArgs

/** Current conclusions also read their comparison and unsettled scope. */
export const siteCoverageExecutionSelect = { ...siteObservationExecutionSelect,
  where: { OR: [...siteObservationExecutionSelect.where.OR, { targetKey: FLAG_COMPARISON_TARGET },
    { workKind: 'discovery' }, { workKind: { in: ['check', 'search', 'cross-page', 'flow'] }, status: { in: ['PENDING', 'RUNNING'] } }] },
} satisfies Prisma.Audit$verifierExecutionsArgs

export const categoryCoverageExecutionSelect = {
  where: { OR: [...siteCoverageExecutionSelect.where.OR, analysisEvidenceTaskWhere] },
  select: { ...siteCoverageExecutionSelect.select, workState: true, workDependencies: true },
} satisfies Prisma.Audit$verifierExecutionsArgs

export const siteEvidenceAuditSelect = {
  executionSpec: true,
  id: true,
  ...flagComparisonAuditScopeSelect,
  status: true,
  progress: true,
  reviewDepth: true,
  triageAt: true,
  aiReviewAt: true,
  includeAi: true,
  failedModules: true,
  reportCompleteness: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  pipelineEvents: { orderBy: { occurredAt: 'desc' }, take: 100, select: { stage: true, event: true, status: true, occurredAt: true } },
  failureCode: true,
  failureStage: true,
  evidenceCoverage: true,
  verifierExecutions: siteCoverageExecutionSelect,
  url: true,
} satisfies Prisma.AuditSelect

export async function resolveLatestAudit(site: SiteRecord, selection?: Awaited<ReturnType<typeof loadSiteAnalysisSelection>>) {
  const scoped = selection ?? await loadSiteAnalysisSelection(site)
  if (site.kind === 'project' && site.projectId) {
    return prisma.audit.findFirst({
      where: { projectId: site.projectId, ...scoped.where },
      orderBy: { createdAt: 'desc' },
      select: siteEvidenceAuditSelect,
    })
  }
  if (!site.primaryAuditId) return null
  return prisma.audit.findFirst({
    where: { id: site.primaryAuditId, ...scoped.where },
    select: siteEvidenceAuditSelect,
  })
}

export async function resolvePriorCompletedAudit(site: SiteRecord, currentId: string | null, selection?: Awaited<ReturnType<typeof loadSiteAnalysisSelection>>) {
  const scoped = selection ?? await loadSiteAnalysisSelection(site)
  if (site.kind === 'project' && site.projectId) {
    return prisma.audit.findFirst({
      where: {
        projectId: site.projectId,
        status: 'COMPLETED',
        ...scoped.where,
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      orderBy: { completedAt: 'desc' },
      select: { ...siteEvidenceAuditSelect, verifierExecutions: siteObservationExecutionSelect, pages: { select: { url: true } } },
    })
  }
  return null
}

export type ActiveSiteRun = {
  id: string
  auditId: string | null
  scope: 'SITE' | 'CATEGORY' | 'OUTCOMES' | 'DIAGNOSTIC' | 'UNKNOWN'
  targetLabel: string | null
  trigger: 'MANUAL' | 'SCHEDULED' | 'OTHER' | 'UNKNOWN'
  status: 'QUEUED' | 'RUNNING' | 'INTERRUPTED'
  requestedAt: string
  progress: number
}

export async function loadActiveSiteRuns(site: SiteRecord, now: Date): Promise<ActiveSiteRun[]> {
  if (!site.projectId) return []
  const runs = await prisma.runRequest.findMany({
    where: { projectId: site.projectId, status: { in: ['QUEUED', 'RUNNING'] }, ...sameSiteRunAuditWhere(site.projectId) },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true, auditId: true, source: true, executionSpec: true, verificationTarget: true,
      status: true, leaseUntil: true, requestedAt: true, audit: { select: { progress: true } },
      selections: { where: { outcome: { projectId: site.projectId } }, select: { outcome: { select: { name: true } } } },
    },
  })
  return runs.filter(run => readExecutionSpec(run.executionSpec)?.scope !== 'FIXTURE_SETUP').map(run => {
    const metadata = monitoringHistoryMetadata({ executionSpec: run.executionSpec, status: run.status, flagCount: 0,
      runRequests: [run] })
    return { id: run.id, auditId: run.auditId, scope: metadata.scope ?? 'UNKNOWN', targetLabel: metadata.targetLabel ?? null,
      trigger: metadata.trigger ?? 'UNKNOWN', status: !run.leaseUntil || run.leaseUntil <= now ? 'INTERRUPTED' : run.status === 'RUNNING' ? 'RUNNING' : 'QUEUED',
      requestedAt: run.requestedAt.toISOString(), progress: run.audit?.progress ?? 0 }
  })
}
