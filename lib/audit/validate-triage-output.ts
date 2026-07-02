import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { LAUNCH_CHECKLIST_IDS } from '@/lib/audit/rubric'
import { deduplicateTriageFlags } from '@/lib/audit/deduplicate'
import { JudgeContractError } from '@/lib/audit/validate-judge-output'

const RUBRIC_NAMES = new Set<string>(RUBRIC_ORDER)
const LAUNCH_CHECK_IDS = new Set<string>(LAUNCH_CHECKLIST_IDS)

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new JudgeContractError(`${label} must be unique`)
  }
}

export function validateTriageOutput(
  output: TriageOutput,
  deterministicFlags: DeterministicFlag[]
): TriageOutput {
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

  return {
    ...output,
    newFlags: deduplicateTriageFlags(deterministicFlags, output.newFlags),
  }
}
