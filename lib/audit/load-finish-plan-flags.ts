import type { RankableFlag } from '@/lib/audit/priority-flags'
import { loadRepoFlagsForAudit } from '@/lib/audit/repo-rankable-flags'
import type { ProductContract } from '@/lib/audit/product-contract'
import {
  buildFinishPlan,
  buildFixList,
  type FinishPlan,
  type FinishPlanPromptAccess,
  type FixList,
} from '@/lib/audit/finish-plan'

type LiveFlag = {
  id: string
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string | null
  whyItMatters: string | null
  fix: string | null
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt: string | null
  windsurfPrompt: string | null
  lovablePrompt: string | null
  boltPrompt: string | null
  verificationRule: string | null
  pageUrl: string | null
  confidence: number | null
  source?: string | null
  status?: string | null
}

export function toRankableFlag(flag: LiveFlag): RankableFlag {
  return {
    id: flag.id,
    checkId: flag.checkId,
    rubric: flag.rubric,
    severity: flag.severity,
    impactTag: flag.impactTag,
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters,
    fix: flag.fix,
    agentPrompt: flag.agentPrompt,
    cursorPrompt: flag.cursorPrompt,
    claudePrompt: flag.claudePrompt,
    windsurfPrompt: flag.windsurfPrompt,
    lovablePrompt: flag.lovablePrompt,
    boltPrompt: flag.boltPrompt,
    verificationRule: flag.verificationRule,
    pageUrl: flag.pageUrl,
    confidence: flag.confidence,
    source: flag.source ?? 'DETERMINISTIC',
    status: flag.status,
  } as RankableFlag
}

/** Live page flags plus Agency repo findings for one shared Finish Plan ranking. */
export async function loadFinishPlanFlags(input: {
  userId: string | null
  auditUrl: string
  flags: LiveFlag[]
}): Promise<RankableFlag[]> {
  const live = input.flags.map(toRankableFlag)
  const repo = await loadRepoFlagsForAudit({
    userId: input.userId,
    auditUrl: input.auditUrl,
  })
  return [...live, ...repo]
}

type UnifiedPlanInput = {
  userId: string | null
  auditUrl: string
  flags: LiveFlag[]
  rubricRows?: Array<{ name: string; grade: string | null }>
  contract?: ProductContract | null
  promptAccess: FinishPlanPromptAccess
  demonstratedFlag?: RankableFlag | null
  limit?: number
}

/** Shared ≤3 Finish Plan ranking for compatibility surfaces. */
export async function buildUnifiedFinishPlan(input: UnifiedPlanInput): Promise<FinishPlan> {
  const flags = await loadFinishPlanFlags({
    userId: input.userId,
    auditUrl: input.auditUrl,
    flags: input.flags,
  })
  return buildFinishPlan({
    flags,
    rubricRows: input.rubricRows,
    url: input.auditUrl,
    contract: input.contract ?? null,
    promptAccess: input.promptAccess,
    demonstratedFlag: input.demonstratedFlag,
    limit: input.limit,
  })
}

/** Shared complete Fix List ranking including Agency repo findings. */
export async function buildUnifiedFixList(input: UnifiedPlanInput): Promise<FixList> {
  const flags = await loadFinishPlanFlags({
    userId: input.userId,
    auditUrl: input.auditUrl,
    flags: input.flags,
  })
  return buildFixList({
    flags,
    rubricRows: input.rubricRows,
    url: input.auditUrl,
    contract: input.contract ?? null,
    promptAccess: input.promptAccess,
    demonstratedFlag: input.demonstratedFlag,
  })
}
