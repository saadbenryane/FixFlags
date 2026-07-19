/**
 * Judge output normalization and validation.
 *
 * Re-exports JudgeContractError and buildAiFlagMatchKey from judge-utils.ts
 * for backward compatibility with existing import sites.
 */
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge-schema'
import {
  JudgeContractError,
  assertValidRubrics,
  assertRubricConsistency,
  assertValidLaunchChecklist,
  assertUnique,
} from './judge-utils'

export { JudgeContractError } from './judge-utils'
export { buildAiFlagMatchKey } from './judge-utils'

type JudgeEnrichmentDraft = {
  checkId?: string
  whyItMatters?: string
  agentPrompt?: string
  cursorPrompt?: string
  claudePrompt?: string
  lovablePrompt?: string
  boltPrompt?: string
  verificationRule?: string | null
}

/** Fill arrays and enrichments the LLM sometimes omits before schema validation. */
export function normalizeJudgeRawOutput(
  raw: Record<string, unknown>,
  deterministicFlags: DeterministicFlag[]
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...raw }
  if (!Array.isArray(normalized.newFlags)) normalized.newFlags = []

  const enrichments = Array.isArray(normalized.enrichments)
    ? [...(normalized.enrichments as JudgeEnrichmentDraft[])]
    : []
  const seenCheckIds = new Set(
    enrichments.map((item) => item.checkId).filter((id): id is string => Boolean(id))
  )

  for (const flag of deterministicFlags) {
    if (seenCheckIds.has(flag.checkId)) continue
    enrichments.push({
      checkId: flag.checkId,
      whyItMatters: `Fixing this issue improves the page before launch: ${flag.problem}`,
      agentPrompt: flag.fix,
      verificationRule: `Re-run FixFlags and confirm ${flag.checkId} no longer fails.`,
    })
    seenCheckIds.add(flag.checkId)
  }

  normalized.enrichments = enrichments
  return normalized
}

export function validateJudgeOutput(
  output: JudgeOutput,
  deterministicFlags: DeterministicFlag[]
): JudgeOutput {
  assertValidRubrics(output.rubrics)
  assertRubricConsistency(output.rubrics)
  assertValidLaunchChecklist(output.launchChecklist)

  const requiredEnrichments = deterministicFlags.map((flag) => flag.checkId)
  const enrichmentIds = output.enrichments.map((item) => item.checkId)
  assertUnique(enrichmentIds, 'enrichment check ids')
  if (
    enrichmentIds.length !== requiredEnrichments.length ||
    requiredEnrichments.some((id) => !enrichmentIds.includes(id))
  ) {
    throw new JudgeContractError('expected exactly one enrichment per deterministic flag')
  }

  return output
}
