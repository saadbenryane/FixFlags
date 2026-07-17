import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'
import { deduplicateTriageFlags } from '@/lib/audit/deduplicate'
import {
  assertValidRubrics,
  assertRubricConsistency,
  assertValidLaunchChecklist,
} from './judge-utils'

export function validateTriageOutput(
  output: TriageOutput,
  deterministicFlags: DeterministicFlag[]
): TriageOutput {
  assertValidRubrics(output.rubrics)
  assertRubricConsistency(output.rubrics)
  assertValidLaunchChecklist(output.launchChecklist)

  return {
    ...output,
    newFlags: deduplicateTriageFlags(deterministicFlags, output.newFlags),
  }
}
