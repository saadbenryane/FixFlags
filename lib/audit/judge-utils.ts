/**
 * Shared audit judge utilities: error class, dedup key builder, assertion helpers.
 *
 * Extracted from validate-judge-output.ts to break circular imports and provide
 * a single import point for the error class used across the pipeline.
 */
import { RUBRIC_ORDER } from '@/lib/audit/constants'

export class JudgeContractError extends Error {
  constructor(message: string) {
    super(`Invalid AI assessment: ${message}`)
    this.name = 'JudgeContractError'
  }
}

export function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new JudgeContractError(`${label} must be unique`)
  }
}

/**
 * Build a stable dedup key for matching AI-generated flags against
 * deterministic flags by rubric + normalized problem text.
 */
export function buildAiFlagMatchKey(problem: string, rubric: string): string {
  return `${rubric}::${problem.toLowerCase().replace(/\s+/g, ' ').trim()}`
}

const RUBRIC_NAMES = new Set<string>(RUBRIC_ORDER)

/**
 * Shared rubric validation: correct count, unique names, all required
 * rubrics present. Used by both triage and prescription validators.
 */
export function assertValidRubrics(rubrics: Array<{ name: string }>): void {
  if (rubrics.length !== RUBRIC_ORDER.length) {
    throw new JudgeContractError(`expected exactly ${RUBRIC_ORDER.length} rubrics`)
  }
  const names = rubrics.map((r) => r.name)
  assertUnique(names, 'rubric names')
  if (names.some((name) => !RUBRIC_NAMES.has(name))) {
    throw new JudgeContractError('received an unsupported rubric')
  }
  if (RUBRIC_ORDER.some((name) => !names.includes(name))) {
    throw new JudgeContractError('one or more required rubrics are missing')
  }
}

/**
 * Shared rubric score/assessment consistency check.
 */
export function assertRubricConsistency(
  rubrics: Array<{ name: string; assessmentState: string; score: number | null }>
): void {
  for (const rubric of rubrics) {
    if (rubric.assessmentState === 'ASSESSED' && rubric.score === null) {
      throw new JudgeContractError(`${rubric.name} is assessed but has no score`)
    }
    if (rubric.assessmentState !== 'ASSESSED' && rubric.score !== null) {
      throw new JudgeContractError(`${rubric.name} has a score without assessed evidence`)
    }
  }
}

const LAUNCH_CHECKLIST_IDS = new Set([
  'https',
  'social-preview',
  'mobile-cta',
  'console-errors',
  'privacy-contact',
])

/**
 * Shared launch checklist validation: exactly 5 items, unique IDs, valid set.
 */
export function assertValidLaunchChecklist(
  checklist: Array<{ id: string }>
): void {
  if (checklist.length !== 5) {
    throw new JudgeContractError('launch checklist must contain exactly five checks')
  }
  const ids = checklist.map((item) => item.id)
  assertUnique(ids, 'launch checklist ids')
  if (ids.some((id) => !LAUNCH_CHECKLIST_IDS.has(id))) {
    throw new JudgeContractError('launch checklist contains an unsupported check')
  }
}
