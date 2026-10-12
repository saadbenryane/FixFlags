import { loadSiteAnalysisSelection } from './legacy-analysis'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { monitoringHistoryMetadata, type MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import type { SiteRecord } from '@/lib/sites/types'
import { siteAnalysisAuditWhere } from './analysis-scope'
import { completeOutcomeEvidence } from '../domain/outcome-proof'
import { categoryCoverageFact } from './category-evidence'
import { projectSiteAssessment, recordedRunFlags, recordedDiagnosticConclusion, recordedAccountConclusion } from '../assessment'
import { readExecutionSpec } from '../domain/execution-spec'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'
import { categoryCoverageExecutionSelect } from './site-execution'
import { currentOutcomeState } from '../outcome-state'

const historySelect = {
  id: true, parentId: true, status: true, failureCode: true, failedModules: true, evidenceCoverage: true, pages: { select: { url: true, status: true } }, completedAt: true, updatedAt: true, executionSpec: true, recheckTrigger: true,
  runRequests: { orderBy: { requestedAt: 'desc' }, take: 1, select: {
    source: true, executionSpec: true, verificationTarget: true,
    selections: { select: { outcome: { select: { name: true } } } },
    assessments: { select: { outcomeId: true, state: true, validUntil: true, coverage: true, evidence: true } },
  } },
  verificationAttempts: { take: 12, orderBy: { createdAt: 'desc' }, select: { id: true, outcome: true, comparable: true,
    handoffReference: true, sourceAuditId: true, verificationAuditId: true, evidenceReference: true } },
  verifierExecutions: { where: { OR: [{ workKind: 'automatic-accounts', workState: 'COMPLETED' },
    { audit: { executionSpec: { path: ['scope'], equals: 'CATEGORY' } }, OR: [...categoryCoverageExecutionSelect.where.OR, { targetKey: FLAG_COMPARISON_TARGET }] }] },
    select: categoryCoverageExecutionSelect.select },
  flags: { select: { id: true, problem: true, severity: true, confidence: true, impactTag: true, checkId: true } },
} satisfies Prisma.AuditSelect

export function projectHistory(audit: Prisma.AuditGetPayload<{ select: typeof historySelect }>, legacyIds: string[], proofFlags: Array<{ id: string; problem: string; auditId: string }> = [], accountTaskResult?: unknown): MonitoringHistoryEntry {
  const flags = audit.flags.filter(isCustomerFlag)
  const metadata = monitoringHistoryMetadata({ ...audit, legacySiteAnalysis: legacyIds.includes(audit.id), flagCount: flags.length })
  const target = (audit.executionSpec as { verificationTarget?: { attemptId?: string } } | null)?.verificationTarget
    ?? audit.runRequests[0]?.verificationTarget as { attemptId?: string } | null | undefined
  const attempt = audit.verificationAttempts.find(item => item.id === target?.attemptId)
  const sourceId = attempt?.handoffReference?.startsWith('flag:') ? attempt.handoffReference.slice(5) : null
  const proof = sourceId ? proofFlags.find(item => item.id === sourceId && item.auditId === attempt?.sourceAuditId) : null
  const linkedFlags = [...flags.map(flag => ({ id: flag.id, title: flag.problem })),
    ...(proof && !flags.some(flag => flag.problem === proof.problem) ? [{ id: proof.id, title: proof.problem }] : [])]
  const selected = audit.runRequests[0]
  const accountOnly = (audit.executionSpec as { scope?: string } | null)?.scope === 'ACCOUNT_CHECKS'
  const accountConclusion = recordedAccountConclusion(audit.executionSpec, accountTaskResult)
  if (accountOnly) {
    metadata.scope = 'OUTCOMES'; metadata.targetLabel = 'Automatic account checks'
    metadata.result = accountConclusion?.state === 'FLAG' ? 'FLAG' : accountConclusion?.state === 'CLEAR' ? 'CLEAR' : 'COULD_NOT_VERIFY'
  }
  const completedScope = accountOnly ? accountConclusion?.complete === true : metadata.scope === 'OUTCOMES'
    ? Boolean(selected?.assessments.length && selected.assessments.length === selected.selections.length && selected.assessments.every(assessment =>
      ['CLEAR', 'FLAG'].includes(assessment.state) && completeOutcomeEvidence(assessment.coverage, assessment.evidence)))
    : metadata.scope === 'DIAGNOSTIC' && recordedDiagnosticConclusion({ executionSpec: audit.executionSpec, audit })?.complete === true
  let completionState: MonitoringHistoryEntry['completionState'] = audit.status === 'FAILED' ? 'FAILED' : !audit.completedAt || audit.failureCode ||
    (!completedScope && Array.isArray(audit.failedModules) && audit.failedModules.length > 0) ||
    (!completedScope && (!audit.pages.length || audit.pages.some(page => page.status !== 'COMPLETED'))) ? 'PARTIAL' : 'COMPLETED'
  const spec = readExecutionSpec(audit.executionSpec)
  if (accountOnly) completionState = audit.status === 'FAILED' ? 'FAILED' : accountConclusion?.complete ? 'COMPLETED' : 'PARTIAL'
  if (metadata.scope === 'DIAGNOSTIC') {
    const diagnostic = recordedDiagnosticConclusion({ executionSpec: audit.executionSpec, audit })
    const assessment = projectSiteAssessment({ status: audit.status, executionSpec: audit.executionSpec,
      requiredAreas: [], coverage: [], flags: [], now: audit.completedAt ?? audit.updatedAt,
      scopedConclusion: diagnostic, assessmentComplete: diagnostic?.complete ?? false, checkedAt: audit.completedAt })
    metadata.result = assessment.result === 'CLEAR' ? 'CLEAR' : assessment.result === 'FLAG' ? 'FLAG' : 'COULD_NOT_VERIFY'
    completionState = audit.status === 'FAILED' ? 'FAILED' : assessment.completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL'
  }
  if (spec?.category) {
    const evidenceAt = audit.completedAt ?? audit.updatedAt
    const fact = categoryCoverageFact(audit, evidenceAt)!
    const recorded = recordedRunFlags({ executionSpec: audit.executionSpec, audit })
    const assessment = projectSiteAssessment({ status: audit.status, executionSpec: audit.executionSpec,
      coverage: [fact], now: evidenceAt, flags: recorded.flags.filter(flag => isCustomerFlag({ ...flag, status: undefined })),
      assessmentComplete: recorded.complete, checkedAt: audit.completedAt,
      outcomes: spec.outcomes.map(outcome => ({ id: outcome.id, state: currentOutcomeState(selected?.assessments.find(item => item.outcomeId === outcome.id) ?? null, evidenceAt) })) })
    metadata.result = assessment.result === 'FLAG' ? 'FLAG' : assessment.result === 'CLEAR' ? 'CLEAR' : 'COULD_NOT_VERIFY'
    completionState = audit.status === 'FAILED' ? 'FAILED' : assessment.completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL'
  }
  return {
    completionState,
    id: audit.id, checkedAt: (audit.completedAt ?? audit.updatedAt).toISOString(),
    evidenceAt: audit.status === 'COMPLETED' ? audit.completedAt?.toISOString() ?? null : null,
    status: audit.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', flagCount: flags.length,
    flags: linkedFlags,
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
  const sourceIds = [...new Set(timeline.flatMap(audit => audit.verificationAttempts.flatMap(attempt =>
    attempt.handoffReference?.startsWith('flag:') ? [attempt.handoffReference.slice(5)] : [])))]
  const proofs = sourceIds.length ? await prisma.flag.findMany({ where: { id: { in: sourceIds }, audit: { projectId: site.projectId } },
    select: { id: true, problem: true, auditId: true } }) : []
  const accountAuditIds = [...new Set([...timeline, ...trend].filter(audit => readExecutionSpec(audit.executionSpec)?.scope === 'ACCOUNT_CHECKS').map(audit => audit.id))]
  const accountTasks = accountAuditIds.length ? await prisma.auditVerifierExecution.findMany({ where: { auditId: { in: accountAuditIds }, targetKey: 'task:automatic-accounts', workKind: 'automatic-accounts', workState: 'COMPLETED' },
    select: { auditId: true, workResult: true } }) : []
  const accountResults = new Map(accountTasks.map(task => [task.auditId, task.workResult]))
  return { timeline: timeline.map(audit => projectHistory(audit, scoped.legacyIds, proofs, accountResults.get(audit.id))),
    trend: trend.toReversed().map(audit => projectHistory(audit, scoped.legacyIds, [], accountResults.get(audit.id))) }
}
