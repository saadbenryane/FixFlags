import type { DeterministicFinding } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge'
import { AREA_ORDER } from '@/lib/audit/constants'
import { LAUNCH_CHECKLIST_IDS } from '@/lib/audit/rubric'

const AREA_NAMES = new Set<string>(AREA_ORDER)
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
  deterministicFindings: DeterministicFinding[]
): JudgeOutput {
  if (output.areas.length !== AREA_ORDER.length) {
    throw new JudgeContractError(`expected exactly ${AREA_ORDER.length} areas`)
  }

  const areaNames = output.areas.map((area) => area.name)
  assertUnique(areaNames, 'area names')
  if (areaNames.some((name) => !AREA_NAMES.has(name))) {
    throw new JudgeContractError('received an unsupported area')
  }
  if (AREA_ORDER.some((name) => !areaNames.includes(name))) {
    throw new JudgeContractError('one or more required areas are missing')
  }

  for (const area of output.areas) {
    if (area.assessmentState === 'ASSESSED' && area.score === null) {
      throw new JudgeContractError(`${area.name} is assessed but has no score`)
    }
    if (area.assessmentState !== 'ASSESSED' && area.score !== null) {
      throw new JudgeContractError(`${area.name} has a score without assessed evidence`)
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

  const requiredEnrichments = deterministicFindings.map((finding) => finding.checkId)
  const enrichmentIds = output.enrichments.map((item) => item.checkId)
  assertUnique(enrichmentIds, 'enrichment check ids')
  if (
    enrichmentIds.length !== requiredEnrichments.length ||
    requiredEnrichments.some((id) => !enrichmentIds.includes(id))
  ) {
    throw new JudgeContractError('expected exactly one enrichment per deterministic finding')
  }

  return output
}

export function buildAiFindingMatchKey(problem: string, area: string): string {
  return `${area}::${problem.toLowerCase().replace(/\s+/g, ' ').trim()}`
}
