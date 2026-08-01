import type { ProductContract } from '@/lib/audit/product-contract'
import {
  buildPlanModePrompt,
  rankFlagsByPriority,
  resolveFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import { consolidateFlagsByCheck } from '@/lib/audit/consolidate-flags'

export type FinishPlanPromptAccess = 'all' | 'one' | 'none'
type FixListFlag = RankableFlag & { status?: string | null }

export interface FinishPlanItem {
  id: string
  checkId?: string | null
  rubric: string
  rubricName: string
  severity: string
  impactTag?: string | null
  problem: string
  evidence: string
  whyItMatters?: string | null
  verificationRule?: string | null
  pageUrl?: string | null
  pageUrls: string[]
  occurrenceCount: number
  prompt: string | null
  toolPrompts: {
    universal?: string | null
    cursor?: string | null
    claude?: string | null
    windsurf?: string | null
    lovable?: string | null
    bolt?: string | null
  } | null
}

export interface FinishPlan {
  items: FinishPlanItem[]
  copyPrompt: string | null
  visiblePromptCount: number
}

export interface FixList extends FinishPlan {
  totalCount: number
}

/** Explicit export path for every prompt. This is not a Finish Plan. */
export function buildAllFixPrompts(input: {
  flags: FixListFlag[]
  url?: string | null
  contract?: ProductContract | null
}): string {
  const flags = consolidateFlagsByCheck(unresolvedFlags(input.flags))
  return buildPlanModePrompt(flags, {
    url: input.url,
    limit: flags.length,
    contract: input.contract ?? null,
  })
}

type PlanInput = {
  flags: FixListFlag[]
  rubricRows?: Array<{ name: string; grade: string | null }>
  url?: string | null
  contract?: ProductContract | null
  promptAccess: FinishPlanPromptAccess
  demonstratedFlag?: RankableFlag | null
  /** Cap for buildFinishPlan only. buildFixList ignores this and returns all unresolved flags. */
  limit?: number
}

function unresolvedFlags(flags: FixListFlag[]): FixListFlag[] {
  return flags.filter((flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED')
}

function buildRankedFixes(
  input: PlanInput,
  options: { limit: number; demonstratedFirst: boolean }
): FinishPlan {
  const unresolved = consolidateFlagsByCheck(unresolvedFlags(input.flags), {
    demonstratedFlagId: input.demonstratedFlag?.id,
  })
  const ranked = rankFlagsByPriority(
    unresolved,
    input.rubricRows ?? [],
    options.limit,
    input.contract ?? null
  )
  const demonstratedId = input.demonstratedFlag?.id
  const orderedRanked =
    options.demonstratedFirst && input.promptAccess === 'one' && demonstratedId
      ? [
          ...ranked.filter(({ flag }) => flag.id === demonstratedId),
          ...ranked.filter(({ flag }) => flag.id !== demonstratedId),
        ]
      : ranked
  let demonstratedPromptUsed = false

  const items = orderedRanked.map(({ flag, rubricName }) => {
    const source = flag.id === demonstratedId ? input.demonstratedFlag ?? flag : flag
    const mayShowPrompt =
      input.promptAccess === 'all' ||
      (input.promptAccess === 'one' && !demonstratedPromptUsed && flag.id === demonstratedId)
    const prompt = mayShowPrompt ? resolveFixPrompt(source) : null
    if (prompt && input.promptAccess === 'one') demonstratedPromptUsed = true

    return {
      id: flag.id,
      checkId: flag.checkId,
      rubric: flag.rubric,
      rubricName,
      severity: flag.severity,
      impactTag: flag.impactTag,
      problem: flag.problem,
      evidence: flag.evidence ?? '',
      whyItMatters: flag.whyItMatters,
      verificationRule: flag.verificationRule,
      pageUrl: flag.pageUrl,
      pageUrls: flag.occurrencePageUrls,
      occurrenceCount: flag.occurrenceCount,
      prompt,
      toolPrompts: prompt
        ? {
            universal: source.agentPrompt,
            cursor: source.cursorPrompt,
            claude: source.claudePrompt,
            windsurf: source.windsurfPrompt,
            lovable: source.lovablePrompt,
            bolt: source.boltPrompt,
          }
        : null,
    }
  })

  const visiblePromptCount = items.filter((item) => item.prompt).length
  const copyPrompt =
    input.promptAccess === 'all' && visiblePromptCount > 0
      ? buildAllFixPrompts({
          flags: input.flags,
          url: input.url,
          contract: input.contract ?? null,
        })
      : null

  return { items, copyPrompt, visiblePromptCount }
}

/**
 * Canonical complete, ranked fix list. Prompt access is applied per item so
 * anonymous reports can keep every problem and evidence summary visible.
 */
export function buildFixList(input: PlanInput): FixList {
  const totalCount = consolidateFlagsByCheck(unresolvedFlags(input.flags)).length
  const plan = buildRankedFixes(input, {
    limit: totalCount,
    demonstratedFirst: false,
  })
  return { ...plan, totalCount }
}

/**
 * Deprecated compatibility artifact for integrations that still expect the
 * historical three-item Finish Plan. New product surfaces use buildFixList().
 */
export function buildFinishPlan(input: PlanInput): FinishPlan {
  return buildRankedFixes(input, {
    limit: input.limit ?? 3,
    demonstratedFirst: true,
  })
}
