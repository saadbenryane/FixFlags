import { loadSiteAnalysisSelection } from './legacy-analysis'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { monitoringHistoryMetadata, type MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import type { SiteRecord } from '@/lib/sites/types'
import { siteAnalysisAuditWhere } from './analysis-scope'
import { completeOutcomeEvidence } from '../domain/outcome-proof'
import { projectSiteAssessment, recordedDiagnosticConclusion, recordedAccountConclusion } from '../assessment'
import { readExecutionSpec } from '../domain/execution-spec'
import { categoryCoverageExecutionSelect, siteCoverageExecutionSelect } from './site-execution'
import { executionPageCoverage } from '../page-coverage'
import { projectRecordedSiteResult } from './recorded-assessment'
import { analysisDidNotFinish } from '../analysis-completion'

const historySelect = {
  id: true, parentId: true, status: true, failureCode: true, failedModules: true, reportCompleteness: true, evidenceCoverage: true, pages: { select: { url: true, status: true } }, completedAt: true, updatedAt: true, executionSpec: true, recheckTrigger: true,
  runRequests: { orderBy: { requestedAt: 'desc' }, take: 1, select: {
    source: true, executionSpec: true, verificationTarget: true,
    selections: { select: { outcome: { select: { name: true } } } },
    assessments: { select: { outcomeId: true, state: true, validUntil: true, coverage: true, evidence: true } },
  } },
  verificationAttempts: { take: 12, orderBy: { createdAt: 'desc' }, select: { id: true, outcome: true, comparable: true,
    handoffReference: true, sourceAuditId: true, verificationAuditId: true, evidenceReference: true } },
  verifierExecutions: { select: categoryCoverageExecutionSelect.select },
  flags: { select: { id: true, problem: true, severity: true, confidence: true, impactTag: true, checkId: true, attentionPolicy: true } },
} satisfies Prisma.AuditSelect

const { verifierExecutions: historyExecutionRelation, ...historyAuditSelect } = historySelect
const historyExecutionSelect = { auditId: true, ...historyExecutionRelation.select } satisfies Prisma.AuditVerifierExecutionSelect

const sharedHistoryExecutionWhere: Prisma.AuditVerifierExecutionWhereInput[] = [
  { workKind: 'automatic-accounts', workState: 'COMPLETED' },
  { targetKey: { startsWith: 'task:' }, workKind: 'browser' },
]

/** Scope is read from the stored document. A snapshot that no longer parses still keeps its recorded scope. */
export function historyExecutionScope(executionSpec: unknown): 'SITE' | 'CATEGORY' | 'OTHER' {
  if (!executionSpec || typeof executionSpec !== 'object' || Array.isArray(executionSpec)) return 'OTHER'
  const scope = (executionSpec as { scope?: unknown }).scope
  return scope === 'SITE' || scope === 'CATEGORY' ? scope : 'OTHER'
}

/** Same rows the nested audit filter used to keep, without joining back through executionSpec. */
export function historyExecutionFilter(scope: 'SITE' | 'CATEGORY' | 'OTHER'): Prisma.AuditVerifierExecutionWhereInput[] {
  if (scope === 'SITE') return [...sharedHistoryExecutionWhere, ...siteCoverageExecutionSelect.where.OR]
  if (scope === 'CATEGORY') return [...sharedHistoryExecutionWhere, ...categoryCoverageExecutionSelect.where.OR]
  return sharedHistoryExecutionWhere
}

async function loadHistoryExecutions(audits: Array<{ id: string; executionSpec: unknown }>) {
  const ids: Record<'SITE' | 'CATEGORY' | 'OTHER', string[]> = { SITE: [], CATEGORY: [], OTHER: [] }
  const seenAudits = new Set<string>()
  for (const audit of audits) {
    if (seenAudits.has(audit.id)) continue
    seenAudits.add(audit.id)
    ids[historyExecutionScope(audit.executionSpec)].push(audit.id)
  }
  const scopes = (['SITE', 'CATEGORY', 'OTHER'] as const).filter(scope => ids[scope].length > 0)
  const rows = (await Promise.all(scopes.map(scope => prisma.auditVerifierExecution.findMany({
    where: { auditId: { in: ids[scope] }, OR: historyExecutionFilter(scope) },
    select: historyExecutionSelect,
  })))).flat()
  const byAudit = new Map<string, Array<Omit<(typeof rows)[number], 'auditId'>>>()
  const seenRows = new Set<string>()
  for (const row of rows) {
    if (seenRows.has(row.id)) continue
    seenRows.add(row.id)
    const { auditId, ...execution } = row
    const list = byAudit.get(auditId) ?? []
    list.push(execution)
    byAudit.set(auditId, list)
  }
  return byAudit
}

export function projectHistory(audit: Prisma.AuditGetPayload<{ select: typeof historySelect }>, legacyIds: string[], proofFlags: Array<{ id: string; problem: string; auditId: string }> = [], accountTaskResult?: unknown): MonitoringHistoryEntry {
  const flags = audit.flags.filter(isCustomerFlag)
  const metadata = monitoringHistoryMetadata({ ...audit, legacySiteAnalysis: legacyIds.includes(audit.id), flagCount: flags.length })
  const target = (audit.executionSpec as { verificationTarget?: { attemptId?: string } } | null)?.verificationTarget
    ?? audit.runRequests[0]?.verificationTarget as { attemptId?: string } | null | undefined
  const attempt = audit.verificationAttempts.find(item => item.id === target?.attemptId)
  const sourceId = attempt?.handoffReference?.startsWith('flag:') ? attempt.handoffReference.slice(5) : null
  const proof = sourceId ? proofFlags.find(item => item.id === sourceId && item.auditId === attempt?.sourceAuditId) : null
  let linkedFlags = [...flags.map(flag => ({ id: flag.id, title: flag.problem })),
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
  const pageCoverage = executionPageCoverage({ executionSpec: audit.executionSpec, pages: audit.pages, executions: audit.verifierExecutions })
  let completionState: MonitoringHistoryEntry['completionState'] = audit.status === 'FAILED' ? 'FAILED' : !audit.completedAt || audit.failureCode ||
    (!completedScope && Array.isArray(audit.failedModules) && audit.failedModules.length > 0) ||
    (!completedScope && !pageCoverage.complete) ? 'PARTIAL' : 'COMPLETED'
  const spec = readExecutionSpec(audit.executionSpec)
  let flagCount = flags.length
  if (accountOnly) completionState = audit.status === 'FAILED' ? 'FAILED' : accountConclusion?.complete ? 'COMPLETED' : 'PARTIAL'
  if (metadata.scope === 'DIAGNOSTIC') {
    const diagnostic = recordedDiagnosticConclusion({ executionSpec: audit.executionSpec, audit })
    const assessment = projectSiteAssessment({ status: audit.status, executionSpec: audit.executionSpec,
      requiredAreas: [], coverage: [], flags: [], now: audit.completedAt ?? audit.updatedAt,
      scopedConclusion: diagnostic, assessmentComplete: diagnostic?.complete ?? false, checkedAt: audit.completedAt })
    metadata.result = assessment.result === 'CLEAR' ? 'CLEAR' : assessment.result === 'FLAG' ? 'FLAG' : 'COULD_NOT_VERIFY'
    completionState = audit.status === 'FAILED' ? 'FAILED' : assessment.completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL'
  }
  if (spec?.scope === 'SITE' || spec?.category) {
    const evidenceAt = audit.completedAt ?? audit.updatedAt
    const { assessment, findings } = projectRecordedSiteResult({ audit, now: evidenceAt, assessments: selected?.assessments ?? [] })
    if (findings) {
      flagCount = findings.length
      linkedFlags = findings.flatMap(finding => finding.id ? [{ id: finding.id, title: finding.problem }] : [])
    }
    metadata.result = assessment.result === 'FLAG' ? 'FLAG' : assessment.result === 'CLEAR' ? 'CLEAR' : 'COULD_NOT_VERIFY'
    completionState = audit.status === 'FAILED' ? 'FAILED' : assessment.completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL'
  }
  return {
    executionState: audit.status === 'FAILED' ? 'FAILED' : !audit.completedAt || analysisDidNotFinish(audit) ? 'PARTIAL' : 'COMPLETED',
    completionState,
    id: audit.id, checkedAt: (audit.completedAt ?? audit.updatedAt).toISOString(),
    evidenceAt: audit.status === 'COMPLETED' ? audit.completedAt?.toISOString() ?? null : null,
    status: audit.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', flagCount,
    flags: linkedFlags,
    ...metadata,
  }
}

/** Read the broad trend independently so scoped activity cannot evict broad evidence. */
export async function loadMonitoringHistory(site: SiteRecord, selection?: Awaited<ReturnType<typeof loadSiteAnalysisSelection>>) {
  const scoped = selection ?? await loadSiteAnalysisSelection(site)
  // A creator can read only the primary analysis recorded on their provisional
  // Site. Null ownership predicates fence a claim that occurs during this read.
  const scope: Prisma.AuditWhereInput | null = site.projectId ? { projectId: site.projectId }
    : site.primaryAuditId ? { id: site.primaryAuditId, projectId: null, userId: null } : null
  if (!scope) return { timeline: [], trend: [] }
  const base = { ...scope, status: { in: ['COMPLETED', 'FAILED'] as Array<'COMPLETED' | 'FAILED'> } }
  const [timelineAudits, trendAudits] = await Promise.all([
    prisma.audit.findMany({ where: { ...base, ...siteAnalysisAuditWhere }, orderBy: { createdAt: 'desc' }, take: 8, select: historyAuditSelect }),
    prisma.audit.findMany({ where: { ...base, ...scoped.where }, orderBy: { createdAt: 'desc' }, take: 8, select: historyAuditSelect }),
  ])
  const executions = await loadHistoryExecutions([...timelineAudits, ...trendAudits])
  const timeline = timelineAudits.map(audit => ({ ...audit, verifierExecutions: executions.get(audit.id) ?? [] }))
  const trend = trendAudits.map(audit => ({ ...audit, verifierExecutions: executions.get(audit.id) ?? [] }))
  const sourceIds = [...new Set(timeline.flatMap(audit => audit.verificationAttempts.flatMap(attempt =>
    attempt.handoffReference?.startsWith('flag:') ? [attempt.handoffReference.slice(5)] : [])))]
  const proofs = sourceIds.length ? await prisma.flag.findMany({ where: { id: { in: sourceIds }, audit: scope },
    select: { id: true, problem: true, auditId: true } }) : []
  const accountAuditIds = [...new Set([...timeline, ...trend].filter(audit => readExecutionSpec(audit.executionSpec)?.scope === 'ACCOUNT_CHECKS').map(audit => audit.id))]
  const accountTasks = accountAuditIds.length ? await prisma.auditVerifierExecution.findMany({ where: { auditId: { in: accountAuditIds }, targetKey: 'task:automatic-accounts', workKind: 'automatic-accounts', workState: 'COMPLETED' },
    select: { auditId: true, workResult: true } }) : []
  const accountResults = new Map(accountTasks.map(task => [task.auditId, task.workResult]))
  return { timeline: timeline.map(audit => projectHistory(audit, scoped.legacyIds, proofs, accountResults.get(audit.id))),
    trend: trend.toReversed().map(audit => projectHistory(audit, scoped.legacyIds, [], accountResults.get(audit.id))) }
}
