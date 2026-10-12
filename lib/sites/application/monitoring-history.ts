import { loadSiteAnalysisSelection } from './legacy-analysis'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { monitoringHistoryMetadata, type MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import type { SiteRecord } from '@/lib/sites/types'
import { siteAnalysisAuditWhere } from './analysis-scope'
import { completeOutcomeEvidence } from '../domain/outcome-proof'

const historySelect = {
  id: true, status: true, failureCode: true, failedModules: true, pages: { select: { status: true } }, completedAt: true, updatedAt: true, executionSpec: true, recheckTrigger: true,
  runRequests: { orderBy: { requestedAt: 'desc' }, take: 1, select: {
    source: true, executionSpec: true, verificationTarget: true,
    selections: { select: { outcome: { select: { name: true } } } },
    assessments: { select: { state: true, coverage: true, evidence: true } },
  } },
  verificationAttempts: { select: { id: true, outcome: true, comparable: true } },
  flags: { select: { id: true, problem: true, severity: true, confidence: true, impactTag: true, checkId: true } },
} satisfies Prisma.AuditSelect

export function projectHistory(audit: Prisma.AuditGetPayload<{ select: typeof historySelect }>, legacyIds: string[]): MonitoringHistoryEntry {
  const flags = audit.flags.filter(isCustomerFlag)
  const metadata = monitoringHistoryMetadata({ ...audit, legacySiteAnalysis: legacyIds.includes(audit.id), flagCount: flags.length })
  const selected = audit.runRequests[0]
  const completedScope = metadata.scope === 'OUTCOMES'
    ? Boolean(selected?.assessments.length && selected.assessments.length === selected.selections.length && selected.assessments.every(assessment =>
      ['CLEAR', 'FLAG'].includes(assessment.state) && completeOutcomeEvidence(assessment.coverage, assessment.evidence)))
    : metadata.scope === 'DIAGNOSTIC' && audit.verificationAttempts.some(attempt => attempt.comparable === true &&
      ['IMPROVED', 'UNCHANGED', 'REGRESSED'].includes(attempt.outcome ?? ''))
  const completionState = audit.status === 'FAILED' ? 'FAILED' : !audit.completedAt || audit.failureCode ||
    (!completedScope && Array.isArray(audit.failedModules) && audit.failedModules.length > 0) ||
    (!completedScope && (!audit.pages.length || audit.pages.some(page => page.status !== 'COMPLETED'))) ? 'PARTIAL' : 'COMPLETED'
  return {
    completionState,
    id: audit.id, checkedAt: (audit.completedAt ?? audit.updatedAt).toISOString(),
    evidenceAt: audit.status === 'COMPLETED' ? audit.completedAt?.toISOString() ?? null : null,
    status: audit.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', flagCount: flags.length,
    flags: flags.map(flag => ({ id: flag.id, title: flag.problem })),
    ...metadata,
  }
}

/** Read the broad trend independently so scoped activity cannot evict broad evidence. */
export async function loadMonitoringHistory(site: SiteRecord, selection?: Awaited<ReturnType<typeof loadSiteAnalysisSelection>>) {
  const scoped = selection ?? await loadSiteAnalysisSelection(site)
  if (!site.projectId) return { timeline: [], trend: [] }
  const base = { projectId: site.projectId, status: { in: ['COMPLETED', 'FAILED'] as Array<'COMPLETED' | 'FAILED'> } }
  const [timeline, trend] = await Promise.all([
    prisma.audit.findMany({ where: { ...base, ...siteAnalysisAuditWhere }, orderBy: { createdAt: 'desc' }, take: 8, select: historySelect }),
    prisma.audit.findMany({ where: { ...base, ...scoped.where }, orderBy: { createdAt: 'desc' }, take: 8, select: historySelect }),
  ])
  return { timeline: timeline.map(audit => projectHistory(audit, scoped.legacyIds)), trend: trend.toReversed().map(audit => projectHistory(audit, scoped.legacyIds)) }
}
