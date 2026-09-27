import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'
import { deduplicateTriageFlags } from '@/lib/audit/deduplicate'
import {
  assertValidRubrics,
  assertRubricConsistency,
  assertValidLaunchChecklist,
} from './judge-utils'
import { groundedReportVerdict } from './verdict'
import type { PagePurpose } from './page-purpose'

/**
 * AI triage flags are a single LLM read over screenshots + page text, so a
 * CRITICAL claim must clear a higher bar than a rule-based deterministic
 * finding. A CRITICAL severity with confidence below this threshold is
 * downgraded to IMPORTANT instead of outranking corroborated evidence.
 */
const AI_CRITICAL_MIN_CONFIDENCE = 0.9

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

function enforceAiConfidenceGates(
  newFlags: TriageOutput['newFlags']
): TriageOutput['newFlags'] {
  return newFlags.map((flag) => {
    if (flag.severity === 'CRITICAL' && flag.confidence < AI_CRITICAL_MIN_CONFIDENCE) {
      return { ...flag, severity: 'IMPORTANT' }
    }
    return flag
  })
}

export function validateTriageOutput(
  output: TriageOutput,
  deterministicFlags: DeterministicFlag[],
  pagePurpose: PagePurpose = 'unknown'
): TriageOutput {
  assertValidRubrics(output.rubrics)
  assertRubricConsistency(output.rubrics)
  assertValidLaunchChecklist(output.launchChecklist)

  const deduplicatedFlags = deduplicateTriageFlags(deterministicFlags, output.newFlags)
  // A positively identified placeholder has no product funnel to critique.
  // Keep captured deterministic facts, but reject model-invented conversion,
  // navigation, or trust priorities for a page whose job is to be minimal.
  const purposeGroundedFlags = pagePurpose === 'placeholder' ? [] : deduplicatedFlags
  const newFlags = enforceAiConfidenceGates(purposeGroundedFlags)
  return {
    ...output,
    // The verdict is a public judgment surface. Anchor it to the same highest-
    // priority Flag that survives validation so an unsupported model claim can
    // never contradict the persisted evidence.
    verdict: groundedReportVerdict(
      [...deterministicFlags, ...newFlags],
      output.rubrics.map((rubric) => ({ name: rubric.name, grade: rubric.grade }))
    ),
    newFlags,
    launchChecklist: reconcileLaunchChecklist(output.launchChecklist, deterministicFlags),
  }
}
