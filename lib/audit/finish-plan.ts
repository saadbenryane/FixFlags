import type { ProductContract } from '@/lib/audit/product-contract'
import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
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
  recommendedChange: string
  protectedScope: string | null
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

export const MAX_FINISH_PLAN_ITEMS = 3

export interface FixArtifacts {
  fixList: FixList
  finishPlan: FinishPlan
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
  limit?: number
}

function unresolvedFlags(flags: FixListFlag[]): FixListFlag[] {
  return flags.filter((flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED')
}

function buildRankedFixes(input: PlanInput): {
  items: FinishPlanItem[]
  rankedFlags: RankableFlag[]
  visiblePromptCount: number
} {
  const unresolved = consolidateFlagsByCheck(unresolvedFlags(input.flags), {
    demonstratedFlagId: input.demonstratedFlag?.id,
  })
  const ranked = rankFlagsByPriority(
    unresolved,
    input.rubricRows ?? [],
    unresolved.length,
    input.contract ?? null
  )
  const demonstratedId = input.demonstratedFlag?.id
  let demonstratedPromptUsed = false

  const items = ranked.map(({ flag, rubricName }) => {
    const source = flag.id === demonstratedId ? input.demonstratedFlag ?? flag : flag
    const mayShowPrompt =
      input.promptAccess === 'all' ||
      (input.promptAccess === 'one' && !demonstratedPromptUsed && flag.id === demonstratedId)
    // Expert-shaped prompt (Why / Evidence / Fix / Verify) so the anonymous
    // demonstrated fix is agent-ready without an extra LLM call. Same path
    // for signed-in full access so copy-paste quality stays consistent.
    const prompt = mayShowPrompt && resolveFixPrompt(source) ? buildExpertFixPrompt(source) : null
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
      recommendedChange: flag.fix ?? '',
      protectedScope: input.contract?.criticalOutcomes.length
        ? `Keep these Product outcomes unchanged: ${input.contract.criticalOutcomes.join('; ')}`
        : null,
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
  return {
    items,
    rankedFlags: ranked.map(({ flag }) => flag),
    visiblePromptCount,
  }
}

function copyPromptFor(
  input: PlanInput,
  rankedFlags: RankableFlag[]
): string | null {
  if (input.promptAccess === 'none') return null
  const flags =
    input.promptAccess === 'one'
      ? rankedFlags.filter((flag) => flag.id === input.demonstratedFlag?.id)
      : rankedFlags
  const prompt = buildPlanModePrompt(flags, {
    url: input.url,
    contract: input.contract ?? null,
  })
  return prompt || null
}

/** Build the complete Fix List and bounded Finish Plan from one ranking pass. */
export function buildFixArtifacts(input: PlanInput): FixArtifacts {
  const ranked = buildRankedFixes(input)
  const selectedCount = Math.min(
    Math.max(input.limit ?? MAX_FINISH_PLAN_ITEMS, 1),
    MAX_FINISH_PLAN_ITEMS
  )
  const worthwhile = ranked.items.flatMap((item, index) => {
    const flag = ranked.rankedFlags[index]
    if (!flag) return []
    if (
      item.severity === 'POLISH' ||
      (flag.confidence ?? 1) < 0.65 ||
      item.recommendedChange.trim().length === 0
    ) return []
    return [{ item, flag }]
  })
  const finishItems = worthwhile.slice(0, selectedCount).map(({ item }) => item)
  const finishFlags = worthwhile.slice(0, selectedCount).map(({ flag }) => flag)
  const finishVisiblePromptCount = finishItems.filter((item) => item.prompt).length

  return {
    fixList: {
      items: ranked.items,
      copyPrompt: copyPromptFor(input, ranked.rankedFlags),
      visiblePromptCount: ranked.visiblePromptCount,
      totalCount: ranked.items.length,
    },
    finishPlan: {
      items: finishItems,
      copyPrompt: copyPromptFor(input, finishFlags),
      visiblePromptCount: finishVisiblePromptCount,
    },
  }
}

/**
 * Canonical complete, ranked fix list. Prompt access is applied per item so
 * anonymous reports can keep every problem and evidence summary visible.
 */
export function buildFixList(input: PlanInput): FixList {
  return buildFixArtifacts(input).fixList
}

/** Canonical highest-leverage one-to-three item Finish Plan. */
export function buildFinishPlan(input: PlanInput): FinishPlan {
  return buildFixArtifacts(input).finishPlan
}
