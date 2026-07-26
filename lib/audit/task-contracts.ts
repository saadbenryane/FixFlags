import type { AuditAttribution } from '@/lib/leads/attribution'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
import { pollAuditUntilDone } from '@/lib/audit/poll-audit'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { parseProductContract } from '@/lib/audit/product-contract'
import {
  buildUnifiedPlanBundle,
} from '@/lib/audit/load-finish-plan-flags'
import {
  loadTechnologyProfile,
  type TechnologyProfile,
} from '@/lib/audit/technology-profile'
import {
  resolveToolPrompt,
  type PromptToolKey,
} from '@/lib/mcp/builders'
import type { FlagDiffSummaryItem } from '@/lib/audit/diff-flags'

export interface TaskRubricSummary {
  name: string
  status: string
  flagCount: number
  criticalCount: number
  importantCount: number
}

export interface TaskFinishPlanItem {
  rank: number
  flagId: string
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  impactTag: string | null
  evidence: string
  rationale: string | null
  verification: string | null
  pageUrl: string | null
  reportUrl: string
  selectedTool: PromptToolKey
  selectedPrompt: string | null
  fixPrompt: string | null
}

export interface TaskFinishPlan {
  reportId: string
  url: string
  items: TaskFinishPlanItem[]
  planPrompt: string
}

export interface TaskFixList extends TaskFinishPlan {
  totalCount: number
}

export interface CheckAndPlanOutcome {
  reportId: string
  reportUrl: string
  status: string
  score?: number | null
  verdict?: string | null
  rubrics?: TaskRubricSummary[]
  fixList?: TaskFixList
  technologyProfile?: TechnologyProfile
  /** @deprecated Use fixList. */
  finishPlan?: TaskFinishPlan
  nextAction?: TaskNextAction
  error?: TaskOutcomeError
}

export interface TaskNextAction {
  type: 'poll'
  tool: 'ff_get_check_status' | 'ff_get_report'
  reportId: string
  retryAfterSeconds: number
}

export interface TaskOutcomeError {
  code: 'AUDIT_FAILED' | 'AUDIT_CANCELLED' | 'WAIT_TIMEOUT'
  message: string
  recoverable: boolean
  action: 'retry' | 'poll'
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
    flags: {
      cleared: FlagDiffSummaryItem[]
      remaining: FlagDiffSummaryItem[]
      new: FlagDiffSummaryItem[]
      regressed: FlagDiffSummaryItem[]
    }
  } | null
  nextFinishPlan?: TaskFinishPlan
  nextFixList?: TaskFixList
  technologyProfile?: TechnologyProfile
  nextAction?: TaskNextAction
  error?: TaskOutcomeError
}

interface TaskQueueOptions {
  waitForCompletion?: boolean
  delayMs?: number
  signal?: AbortSignal
  tool?: PromptToolKey
}

function reportUrl(reportId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'
  return `${appUrl.replace(/\/$/, '')}/report/${reportId}`
}

function toTaskItems(
  items: Array<{
    id: string
    checkId?: string | null
    problem: string
    rubricName: string
    severity: string
    impactTag?: string | null
    prompt: string | null
    evidence: string
    whyItMatters?: string | null
    verificationRule?: string | null
    pageUrl?: string | null
    toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>> | null
  }>,
  reportId: string,
  tool: PromptToolKey
): TaskFinishPlanItem[] {
  return items.map((item, index) => {
    const selectedPrompt = resolveToolPrompt(item.toolPrompts ?? undefined, tool, item.prompt)
    return {
      rank: index + 1,
      flagId: item.id,
      checkId: item.checkId ?? null,
      problem: item.problem,
      rubric: item.rubricName,
      severity: item.severity,
      impactTag: item.impactTag ?? null,
      evidence: item.evidence,
      rationale: item.whyItMatters ?? null,
      verification: item.verificationRule ?? null,
      pageUrl: item.pageUrl ?? null,
      reportUrl: reportUrl(reportId),
      selectedTool: tool,
      selectedPrompt,
      fixPrompt: selectedPrompt,
    }
  })
}

export async function loadCompletedOutcome(
  reportId: string,
  tool: PromptToolKey = 'universal'
): Promise<{
  score: number | null
  verdict: string | null
  rubrics: TaskRubricSummary[]
  fixList: TaskFixList
  finishPlan: TaskFinishPlan
  technologyProfile: TechnologyProfile
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

  const contract = parseProductContract(audit.productContract)
  const planInput = {
    userId: audit.userId,
    auditUrl: audit.url,
    flags: audit.flags,
    rubricRows: audit.rubrics,
    contract,
    promptAccess: 'all' as const,
  }
  const [{ fixList, finishPlan: legacyPlan }, technologyProfile] = await Promise.all([
    buildUnifiedPlanBundle(planInput),
    loadTechnologyProfile(reportId, {
      score: audit.score,
      rubrics: audit.rubrics.map((rubric) => ({
        name: rubric.name,
        score: rubric.score,
      })),
      flags: audit.flags.map((flag) => ({
        rubric: flag.rubric,
        status: flag.status,
      })),
    }),
  ])
  const rubricSources = audit.rubrics.map((rubric) => ({
    name: rubric.name,
    grade: rubric.grade,
    score: rubric.score,
    flags: fixList.items
      .filter((flag) => flag.rubricName === rubric.name)
      .map((flag) => ({ severity: flag.severity })),
  }))
  const rubrics = computeRubricsFromRows(
    rubricSources,
    fixList.items.map((flag) => ({
      severity: flag.severity,
      rubric: flag.rubricName,
    }))
  ).map((rubric) => ({
    name: rubric.name,
    status: rubric.status,
    flagCount: rubric.flagCount,
    criticalCount: rubric.criticalCount,
    importantCount: rubric.importantCount,
  }))

  return {
    score: audit.score,
    verdict: audit.verdict,
    rubrics,
    technologyProfile,
    fixList: {
      reportId,
      url: audit.url,
      items: toTaskItems(fixList.items, reportId, tool),
      planPrompt: fixList.copyPrompt ?? '',
      totalCount: fixList.totalCount,
    },
    finishPlan: {
      reportId,
      url: audit.url,
      items: toTaskItems(legacyPlan.items, reportId, tool),
      planPrompt: legacyPlan.copyPrompt ?? '',
    },
  }
}

export async function loadCompletedTaskOutcome(
  reportId: string,
  tool: PromptToolKey = 'universal'
): Promise<CheckAndPlanOutcome & {
  parentReportId?: string
  diff?: RecheckAndCompareOutcome['diff']
  nextFinishPlan?: TaskFinishPlan
  nextFixList?: TaskFixList
}> {
  const audit = await prisma.audit.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, parentId: true },
  })
  if (!audit) throw new Error('Report not found')
  if (audit.status !== 'COMPLETED') {
    if (audit.status === 'FAILED') {
      return {
        reportId,
        reportUrl: reportUrl(reportId),
        status: audit.status,
        error: {
          code: 'AUDIT_FAILED',
          message: 'The check failed before a complete report was produced.',
          recoverable: true,
          action: 'retry',
        },
      }
    }
    return {
      reportId,
      reportUrl: reportUrl(reportId),
      status: audit.status,
      nextAction: {
        type: 'poll',
        tool: 'ff_get_report',
        reportId,
        retryAfterSeconds: 3,
      },
    }
  }
  const completed = await loadCompletedOutcome(reportId, tool)
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
      flags: {
        cleared: diff.fixed,
        remaining: diff.unchanged,
        new: diff.newIssues,
        regressed: diff.regressed,
      },
    },
    nextFinishPlan: completed.finishPlan,
    nextFixList: completed.fixList,
    technologyProfile: completed.technologyProfile,
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
  let timedOut = false
  if (options.waitForCompletion) {
    const poll = await pollAuditUntilDone({
      auditId,
      signal: options.signal,
      timeoutMs: 50_000,
    })
    status = poll.status
    timedOut = poll.timedOut
  }

  const base = { reportId: auditId, reportUrl: reportUrl(auditId), status }
  if (status === 'FAILED') {
    return {
      ...base,
      error: {
        code: 'AUDIT_FAILED',
        message: 'The check failed before a complete report was produced.',
        recoverable: true,
        action: 'retry',
      },
    }
  }
  if (!options.waitForCompletion || status !== 'COMPLETED') {
    return {
      ...base,
      nextAction: {
        type: 'poll',
        tool: 'ff_get_check_status',
        reportId: auditId,
        retryAfterSeconds: 3,
      },
      ...(timedOut
        ? {
            error: {
              code: 'WAIT_TIMEOUT' as const,
              message: 'The synchronous wait ended before the check completed.',
              recoverable: true,
              action: 'poll' as const,
            },
          }
        : {}),
    }
  }
  return { ...base, ...(await loadCompletedOutcome(auditId, options.tool)) }
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
  let timedOut = false
  if (options.waitForCompletion) {
    const poll = await pollAuditUntilDone({
      auditId: reportId,
      signal: options.signal,
      timeoutMs: 50_000,
    })
    status = poll.status
    timedOut = poll.timedOut
  }

  const base = {
    parentReportId: options.parentReportId,
    reportId,
    reportUrl: reportUrl(reportId),
    status,
    diff: null,
  }
  if (status === 'FAILED') {
    return {
      ...base,
      error: {
        code: 'AUDIT_FAILED',
        message: 'The re-check failed before a comparison was produced.',
        recoverable: true,
        action: 'retry',
      },
    }
  }
  if (!options.waitForCompletion || status !== 'COMPLETED') {
    return {
      ...base,
      nextAction: {
        type: 'poll',
        tool: 'ff_get_report',
        reportId,
        retryAfterSeconds: 3,
      },
      ...(timedOut
        ? {
            error: {
              code: 'WAIT_TIMEOUT' as const,
              message: 'The synchronous wait ended before the re-check completed.',
              recoverable: true,
              action: 'poll' as const,
            },
          }
        : {}),
    }
  }

  const [completed, diff] = await Promise.all([
    loadCompletedOutcome(reportId, options.tool),
    getFlagDiffSummary(options.parentReportId, reportId),
  ])
  return {
    ...base,
    diff: {
      fixed: diff.fixed.length,
      remaining: diff.unchanged.length,
      newIssues: diff.newIssues.length,
      regressed: diff.regressed.length,
      flags: {
        cleared: diff.fixed,
        remaining: diff.unchanged,
        new: diff.newIssues,
        regressed: diff.regressed,
      },
    },
    nextFinishPlan: completed.finishPlan,
    nextFixList: completed.fixList,
    technologyProfile: completed.technologyProfile,
  }
}
