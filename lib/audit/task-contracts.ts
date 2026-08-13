import type { AuditAttribution } from '@/lib/leads/attribution'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
import { pollAuditUntilDone } from '@/lib/audit/poll-audit'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { parseProductContract } from '@/lib/audit/product-contract'
import { findHighestSeverityFlagWithFix } from '@/lib/audit/report-access'
import { rankFlagsByPriority } from '@/lib/audit/priority-flags'
import {
  buildUnifiedPlanBundle,
} from '@/lib/audit/load-finish-plan-flags'
import type { FinishPlanPromptAccess } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'
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
  improvementId: string | null
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  impactTag: string | null
  evidence: string
  rationale: string | null
  recommendedChange: string
  protectedScope: string | null
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
  finishPlan?: TaskFinishPlan
  technologyProfile?: TechnologyProfile
  /** Deterministic check modules that threw; their findings were dropped. */
  failedModules?: string[]
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
    inconclusive: number
    remaining: number
    newIssues: number
    regressed: number
    flags: {
      cleared: FlagDiffSummaryItem[]
      inconclusive: FlagDiffSummaryItem[]
      remaining: FlagDiffSummaryItem[]
      new: FlagDiffSummaryItem[]
      regressed: FlagDiffSummaryItem[]
    }
  } | null
  nextFixList?: TaskFixList
  nextFinishPlan?: TaskFinishPlan
  technologyProfile?: TechnologyProfile
  verificationReceipts?: VerificationReceipt[]
  nextAction?: TaskNextAction
  error?: TaskOutcomeError
}

export interface VerificationReceipt {
  improvementId: string
  improvement: string
  attemptId: string
  builder: string
  changeSummary: string | null
  testedCondition: string
  outcome: 'IMPROVED' | 'UNCHANGED' | 'REGRESSED' | 'INCONCLUSIVE'
  comparable: boolean | null
  verificationCoverage: unknown
  verificationReason: string | null
  evidenceReference: unknown
  remainingRisk: string | null
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

function parseFailedModules(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
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
    recommendedChange: string
    protectedScope: string | null
    verificationRule?: string | null
    pageUrl?: string | null
    toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>> | null
  }>,
  reportId: string,
  tool: PromptToolKey,
  improvementIds: Map<string, string>
): TaskFinishPlanItem[] {
  return items.map((item, index) => {
    const selectedPrompt = resolveToolPrompt(item.toolPrompts ?? undefined, tool, item.prompt)
    return {
      rank: index + 1,
      flagId: item.id,
      improvementId: improvementIds.get(item.id) ?? null,
      checkId: item.checkId ?? null,
      problem: item.problem,
      rubric: item.rubricName,
      severity: item.severity,
      impactTag: item.impactTag ?? null,
      evidence: item.evidence,
      rationale: item.whyItMatters ?? null,
      recommendedChange: item.recommendedChange,
      protectedScope: item.protectedScope,
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
  tool: PromptToolKey = 'universal',
  promptAccess?: FinishPlanPromptAccess,
  demonstratedFlag?: RankableFlag | null,
  finishPlanLimit?: number
): Promise<{
  score: number | null
  verdict: string | null
  rubrics: TaskRubricSummary[]
  fixList: TaskFixList
  finishPlan: TaskFinishPlan
  technologyProfile: TechnologyProfile
  failedModules: string[]
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
  // The curated sample's demonstrated prompt uses the same ranking as the
  // report. Live anonymous outcomes always pass promptAccess='none'.
  const resolvedDemonstratedFlag =
    demonstratedFlag ??
    (promptAccess === 'one'
      ? findHighestSeverityFlagWithFix(
          rankFlagsByPriority(
            audit.flags.filter((flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED'),
            audit.rubrics,
            audit.flags.length,
            contract
          ).map(({ flag }) => flag)
        )
      : null)
  const planInput = {
    userId: audit.userId,
    auditUrl: audit.url,
    flags: audit.flags,
    rubricRows: audit.rubrics,
    contract,
    promptAccess: promptAccess ?? 'all',
    demonstratedFlag: resolvedDemonstratedFlag,
    limit: finishPlanLimit,
  }
  const [{ fixList, finishPlan }, technologyProfile] = await Promise.all([
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
  const occurrences = await prisma.improvementOccurrence.findMany({
    where: { flagId: { in: fixList.items.map((item) => item.id) } },
    select: { flagId: true, improvementId: true },
  })
  const improvementIds = new Map(
    occurrences.map((occurrence) => [occurrence.flagId, occurrence.improvementId])
  )

  return {
    score: audit.score,
    verdict: audit.verdict,
    rubrics,
    technologyProfile,
    failedModules: parseFailedModules(audit.failedModules),
    fixList: {
      reportId,
      url: audit.url,
      items: toTaskItems(fixList.items, reportId, tool, improvementIds),
      planPrompt: fixList.copyPrompt ?? '',
      totalCount: fixList.totalCount,
    },
    finishPlan: {
      reportId,
      url: audit.url,
      items: toTaskItems(finishPlan.items, reportId, tool, improvementIds),
      planPrompt: finishPlan.copyPrompt ?? '',
    },
  }
}

export interface TaskOutcomeAccessOptions {
  promptAccess?: FinishPlanPromptAccess
  /** Demonstrated flag for the curated marketing sample only. */
  demonstratedFlag?: RankableFlag | null
  finishPlanLimit?: number
}

export async function loadCompletedTaskOutcome(
  reportId: string,
  tool: PromptToolKey = 'universal',
  access?: TaskOutcomeAccessOptions
): Promise<CheckAndPlanOutcome & {
  parentReportId?: string
  diff?: RecheckAndCompareOutcome['diff']
  nextFixList?: TaskFixList
  nextFinishPlan?: TaskFinishPlan
  verificationReceipts?: VerificationReceipt[]
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
  const completed = await loadCompletedOutcome(
    reportId,
    tool,
    access?.promptAccess,
    access?.demonstratedFlag,
    access?.finishPlanLimit
  )
  if (!audit.parentId) {
    return { reportId, reportUrl: reportUrl(reportId), status: 'COMPLETED', ...completed }
  }
  const [diff, attempts] = await Promise.all([
    getFlagDiffSummary(audit.parentId, reportId),
    prisma.improvementAttempt.findMany({
      where: { verificationAuditId: reportId, outcome: { not: null } },
      include: { improvement: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  return {
    reportId,
    reportUrl: reportUrl(reportId),
    status: 'COMPLETED',
    ...completed,
    parentReportId: audit.parentId,
    diff: {
      fixed: diff.fixed.length,
      inconclusive: diff.inconclusive.length,
      remaining: diff.unchanged.length,
      newIssues: diff.newIssues.length,
      regressed: diff.regressed.length,
      flags: {
        cleared: diff.fixed,
        inconclusive: diff.inconclusive,
        remaining: diff.unchanged,
        new: diff.newIssues,
        regressed: diff.regressed,
      },
    },
    nextFixList: completed.fixList,
    nextFinishPlan: completed.finishPlan,
    technologyProfile: completed.technologyProfile,
    verificationReceipts: attempts.flatMap((attempt) =>
      attempt.outcome && attempt.testedCondition
        ? [{
            improvementId: attempt.improvement.id,
            improvement: attempt.improvement.title,
            attemptId: attempt.id,
            builder: attempt.builder,
            changeSummary: attempt.changeSummary,
            testedCondition: attempt.testedCondition,
            outcome: attempt.outcome,
            comparable: attempt.comparable,
            verificationCoverage: attempt.verificationCoverage,
            verificationReason: attempt.verificationReason,
            evidenceReference: attempt.evidenceReference,
            remainingRisk: attempt.remainingRisk,
          }]
        : []
    ),
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
    // Anonymous first scans are teasers: single-page reduced pipeline. The
    // create path enforces the same subset; the contract layer makes the
    // CLI/transport scan-stage selection explicit for anonymous callers.
    auditMode:
      options.userId === null && !options.parentId
        ? 'SINGLE'
        : (options.auditMode ?? 'CRITICAL_PATH'),
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
  const anon = options.userId === null
  const outcome = await loadCompletedOutcome(auditId, options.tool, anon ? 'none' : undefined)
  return { ...base, ...outcome }
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
      inconclusive: diff.inconclusive.length,
      remaining: diff.unchanged.length,
      newIssues: diff.newIssues.length,
      regressed: diff.regressed.length,
      flags: {
        cleared: diff.fixed,
        inconclusive: diff.inconclusive,
        remaining: diff.unchanged,
        new: diff.newIssues,
        regressed: diff.regressed,
      },
    },
    nextFixList: completed.fixList,
    nextFinishPlan: completed.finishPlan,
    technologyProfile: completed.technologyProfile,
  }
}
