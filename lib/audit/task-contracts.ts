import type { AuditAttribution } from '@/lib/leads/attribution'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
import { pollAuditUntilDone } from '@/lib/audit/poll-audit'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { parseProductContract } from '@/lib/audit/product-contract'
import { buildUnifiedFinishPlan } from '@/lib/audit/load-finish-plan-flags'

export interface TaskRubricSummary {
  name: string
  status: string
  flagCount: number
  criticalCount: number
  importantCount: number
}

export interface TaskFinishPlanItem {
  flagId: string
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  impactTag: string | null
  fixPrompt: string | null
}

export interface TaskFinishPlan {
  reportId: string
  url: string
  items: TaskFinishPlanItem[]
  planPrompt: string
}

export interface CheckAndPlanOutcome {
  reportId: string
  reportUrl: string
  status: string
  score?: number | null
  verdict?: string | null
  rubrics?: TaskRubricSummary[]
  finishPlan?: TaskFinishPlan
}

export interface RecheckAndCompareOutcome {
  parentReportId: string
  reportId: string
  reportUrl: string
  status: string
  diff: {
    fixed: number
    remaining: number
    newIssues: number
    regressed: number
  } | null
  nextFinishPlan?: TaskFinishPlan
}

interface TaskQueueOptions {
  waitForCompletion?: boolean
  delayMs?: number
  signal?: AbortSignal
}

function reportUrl(reportId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'
  return `${appUrl.replace(/\/$/, '')}/report/${reportId}`
}

export async function loadCompletedOutcome(reportId: string): Promise<{
  score: number | null
  verdict: string | null
  rubrics: TaskRubricSummary[]
  finishPlan: TaskFinishPlan
}> {
  const audit = await prisma.audit.findUnique({
    where: { id: reportId },
    include: {
      flags: { orderBy: { position: 'asc' } },
      rubrics: {
        orderBy: { name: 'asc' },
        include: { flags: { select: { severity: true } } },
      },
    },
  })
  if (!audit) throw new Error('Report not found')
  if (audit.status !== 'COMPLETED') {
    throw new Error(`Report is ${audit.status}, not COMPLETED`)
  }

  const rubricSources = audit.rubrics.map((rubric) => ({
    name: rubric.name,
    grade: rubric.grade,
    score: rubric.score,
    flags: rubric.flags.map((flag) => ({ severity: flag.severity })),
  }))
  const rubrics = computeRubricsFromRows(
    rubricSources,
    audit.flags.map((flag) => ({ severity: flag.severity, rubric: flag.rubric }))
  ).map((rubric) => ({
    name: rubric.name,
    status: rubric.status,
    flagCount: rubric.flagCount,
    criticalCount: rubric.criticalCount,
    importantCount: rubric.importantCount,
  }))

  const contract = parseProductContract(audit.productContract)
  const plan = await buildUnifiedFinishPlan({
    userId: audit.userId,
    auditUrl: audit.url,
    flags: audit.flags,
    rubricRows: audit.rubrics,
    contract,
    promptAccess: 'all',
  })
  const items = plan.items.map((item) => ({
    flagId: item.id,
    checkId: item.checkId ?? null,
    problem: item.problem,
    rubric: item.rubricName,
    severity: item.severity,
    impactTag: item.impactTag ?? null,
    fixPrompt: item.prompt,
  }))

  return {
    score: audit.score,
    verdict: audit.verdict,
    rubrics,
    finishPlan: {
      reportId,
      url: audit.url,
      items,
      planPrompt: plan.copyPrompt ?? '',
    },
  }
}

export async function loadCompletedTaskOutcome(reportId: string): Promise<CheckAndPlanOutcome & {
  parentReportId?: string
  diff?: RecheckAndCompareOutcome['diff']
  nextFinishPlan?: TaskFinishPlan
}> {
  const audit = await prisma.audit.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, parentId: true },
  })
  if (!audit) throw new Error('Report not found')
  if (audit.status !== 'COMPLETED') {
    return { reportId, reportUrl: reportUrl(reportId), status: audit.status }
  }
  const completed = await loadCompletedOutcome(reportId)
  if (!audit.parentId) {
    return { reportId, reportUrl: reportUrl(reportId), status: 'COMPLETED', ...completed }
  }
  const diff = await getFlagDiffSummary(audit.parentId, reportId)
  return {
    reportId,
    reportUrl: reportUrl(reportId),
    status: 'COMPLETED',
    ...completed,
    parentReportId: audit.parentId,
    diff: {
      fixed: diff.fixed.length,
      remaining: diff.unchanged.length,
      newIssues: diff.newIssues.length,
      regressed: diff.regressed.length,
    },
    nextFinishPlan: completed.finishPlan,
  }
}

export async function checkAndPlan(options: TaskQueueOptions & {
  url: string
  userId: string | null
  parentId?: string
  clientId?: string
  auditMode?: 'SINGLE' | 'CRITICAL_PATH'
  attribution?: AuditAttribution
  scanAccess?: import('@/lib/audit/scan-access').ScanAccessConfig | null
}): Promise<CheckAndPlanOutcome> {
  const { auditId, status: initialStatus } = await createAndEnqueueAudit({
    url: options.url,
    userId: options.userId,
    parentId: options.parentId,
    clientId: options.clientId,
    auditMode: options.auditMode ?? 'CRITICAL_PATH',
    delayMs: options.delayMs,
    attribution: options.attribution,
    scanAccess: options.scanAccess ?? null,
  })

  let status: string = initialStatus
  if (options.waitForCompletion) {
    status = (await pollAuditUntilDone({ auditId, signal: options.signal })).status
  }

  const base = { reportId: auditId, reportUrl: reportUrl(auditId), status }
  if (!options.waitForCompletion || status !== 'COMPLETED') return base
  return { ...base, ...(await loadCompletedOutcome(auditId)) }
}

export async function recheckAndCompare(options: TaskQueueOptions & {
  parentReportId: string
  user: User
}): Promise<RecheckAndCompareOutcome> {
  const started = await startMonitoringAudit(options.parentReportId, options.user, {
    delayMs: options.delayMs,
  })
  if (!started.ok) {
    const error = new Error(started.error) as Error & {
      status?: number
      code?: string
      action?: string
    }
    error.status = started.status
    error.code = started.code
    error.action = started.action
    throw error
  }

  const reportId = started.result.auditId
  let status: string = started.result.status
  if (options.waitForCompletion) {
    status = (await pollAuditUntilDone({ auditId: reportId, signal: options.signal })).status
  }

  const base = {
    parentReportId: options.parentReportId,
    reportId,
    reportUrl: reportUrl(reportId),
    status,
    diff: null,
  }
  if (!options.waitForCompletion || status !== 'COMPLETED') return base

  const [completed, diff] = await Promise.all([
    loadCompletedOutcome(reportId),
    getFlagDiffSummary(options.parentReportId, reportId),
  ])
  return {
    ...base,
    diff: {
      fixed: diff.fixed.length,
      remaining: diff.unchanged.length,
      newIssues: diff.newIssues.length,
      regressed: diff.regressed.length,
    },
    nextFinishPlan: completed.finishPlan,
  }
}
