import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'
import { deduplicateTriageFlags } from '@/lib/audit/deduplicate'
import {
  assertValidRubrics,
  assertRubricConsistency,
  assertValidLaunchChecklist,
} from './judge-utils'

const LAUNCH_GATE_CHECK_IDS: Record<string, string[]> = {
  https: ['no-https'],
  'social-preview': [
    'og-image-missing',
    'og-image-broken',
    'og-title-missing',
    'og-description-missing',
  ],
  'mobile-cta': [
    'cta-below-fold-mobile',
    'no-cta-detected',
    'flow-no-cta-found',
    'flow-cta-unclickable',
  ],
  'console-errors': ['console-errors-critical', 'console-errors-some'],
  'privacy-contact': [
    'no-privacy-policy',
    'no-contact-info',
    'trust-no-direct-contact',
  ],
}

export function reconcileLaunchChecklist(
  checklist: TriageOutput['launchChecklist'],
  deterministicFlags: DeterministicFlag[]
): TriageOutput['launchChecklist'] {
  const checkIds = new Set(deterministicFlags.map((flag) => flag.checkId))
  return checklist.map((item) => ({
    ...item,
    passed: !(LAUNCH_GATE_CHECK_IDS[item.id] ?? []).some((checkId) => checkIds.has(checkId)),
  }))
}

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
    launchChecklist: reconcileLaunchChecklist(output.launchChecklist, deterministicFlags),
  }
}
