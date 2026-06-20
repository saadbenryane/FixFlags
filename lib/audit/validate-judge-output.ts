import type { DeterministicFlag } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge-schema'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { LAUNCH_CHECKLIST_IDS } from '@/lib/audit/rubric'

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

const RUBRIC_NAMES = new Set<string>(RUBRIC_ORDER)
const LAUNCH_CHECK_IDS = new Set<string>(LAUNCH_CHECKLIST_IDS)

export class JudgeContractError extends Error {
  constructor(message: string) {
    super(`Invalid AI assessment: ${message}`)
    this.name = 'JudgeContractError'
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new JudgeContractError(`${label} must be unique`)
  }
}

export function validateJudgeOutput(
  output: JudgeOutput,
  deterministicFlags: DeterministicFlag[]
): JudgeOutput {
  if (output.rubrics.length !== RUBRIC_ORDER.length) {
    throw new JudgeContractError(`expected exactly ${RUBRIC_ORDER.length} rubrics`)
  }

  const rubricNames = output.rubrics.map((rubric) => rubric.name)
  assertUnique(rubricNames, 'rubric names')
  if (rubricNames.some((name) => !RUBRIC_NAMES.has(name))) {
    throw new JudgeContractError('received an unsupported rubric')
  }
  if (RUBRIC_ORDER.some((name) => !rubricNames.includes(name))) {
    throw new JudgeContractError('one or more required rubrics are missing')
  }

  for (const rubric of output.rubrics) {
    if (rubric.assessmentState === 'ASSESSED' && rubric.score === null) {
      throw new JudgeContractError(`${rubric.name} is assessed but has no score`)
    }
    if (rubric.assessmentState !== 'ASSESSED' && rubric.score !== null) {
      throw new JudgeContractError(`${rubric.name} has a score without assessed evidence`)
    }
  }

  if (output.launchChecklist.length !== 5) {
    throw new JudgeContractError('launch checklist must contain exactly five checks')
  }
  const launchIds = output.launchChecklist.map((item) => item.id)
  assertUnique(launchIds, 'launch checklist ids')
  if (launchIds.some((id) => !LAUNCH_CHECK_IDS.has(id))) {
    throw new JudgeContractError('launch checklist contains an unsupported check')
  }

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

export function buildAiFlagMatchKey(problem: string, rubric: string): string {
  return `${rubric}::${problem.toLowerCase().replace(/\s+/g, ' ').trim()}`
}
