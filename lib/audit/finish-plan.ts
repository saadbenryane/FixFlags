import type { ProductContract } from '@/lib/audit/product-contract'
import {
  buildPlanModePrompt,
  rankFlagsByPriority,
  resolveFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'

export type FinishPlanPromptAccess = 'all' | 'one' | 'none'

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

/** Explicit export path for every prompt. This is not a Finish Plan. */
export function buildAllFixPrompts(input: {
  flags: RankableFlag[]
  url?: string | null
  contract?: ProductContract | null
}): string {
  return buildPlanModePrompt(input.flags, {
    url: input.url,
    limit: input.flags.length,
    contract: input.contract ?? null,
  })
}

/** Authoritative ranking, cap, Contract bias, and prompt-redaction contract. */
export function buildFinishPlan(input: {
  flags: RankableFlag[]
  rubricRows?: Array<{ name: string; grade: string | null }>
  url?: string | null
  contract?: ProductContract | null
  promptAccess: FinishPlanPromptAccess
  demonstratedFlag?: RankableFlag | null
}): FinishPlan {
  const ranked = rankFlagsByPriority(
    input.flags,
    input.rubricRows ?? [],
    3,
    input.contract ?? null
  )
  const demonstratedId = input.demonstratedFlag?.id
  const orderedRanked =
    input.promptAccess === 'one' && demonstratedId
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
      ? buildPlanModePrompt(input.flags, {
          url: input.url,
          limit: 3,
          contract: input.contract ?? null,
        })
      : null

  return { items, copyPrompt, visiblePromptCount }
}
