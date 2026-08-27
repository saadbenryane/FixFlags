import type {
  AccessibilityBarrier,
  FrictionPoint,
} from '@/lib/audit/journey/evaluator-schema'

function clipEvidence(evidence: string, max = 160): string {
  const trimmed = evidence.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

/** Type-specific remediation Tasks for journey friction (not a generic cognitive-load recipe). */
export function frictionFix(fp: FrictionPoint): string {
  const evidence = clipEvidence(fp.evidence)
  switch (fp.type) {
    case 'unclear-progress':
      return [
        `1. Address this progress gap: ${evidence}`,
        '2. Label the current step with its name (what this step asks for), not only Step N of M and a percent',
        '3. Show what is required before the visitor can advance',
      ].join('\n')
    case 'missing-feedback':
      return [
        `1. After this action, confirm acceptance immediately: ${evidence}`,
        '2. Show a loading, success, or in-view next state (scroll to form, aria-live, or disable the button)',
        '3. Do not leave the visitor on the same view with no change after click',
      ].join('\n')
    case 'too-many-steps':
      return [
        `1. Reduce perceived funnel length for: ${evidence}`,
        '2. Combine adjacent questions where possible, or clarify progress so each step has one job',
        '3. Do not invent pricing or signup pages; keep the existing conversion path',
      ].join('\n')
    case 'hesitation':
      return [
        `1. Resolve the hesitation signal: ${evidence}`,
        '2. Make the primary next action unmistakable at this step',
        '3. Remove or demote competing choices that stall the visitor',
      ].join('\n')
    case 'confusion':
      return [
        `1. Clarify the confusing moment: ${evidence}`,
        '2. Align the step headline and controls with the visitor’s next decision',
        '3. Add a short helper that states what to do and what happens next',
      ].join('\n')
    default:
      return [
        `1. Fix the friction described in evidence: ${evidence}`,
        '2. Add clearer visual feedback at this step',
        '3. Reduce choices so the next action is obvious',
      ].join('\n')
  }
}

type BarrierKind = 'heading' | 'name' | 'focus' | 'keyboard' | 'other'

export function classifyAccessibilityBarrier(barrier: string, evidence: string): BarrierKind {
  const text = `${barrier} ${evidence}`.toLowerCase()
  if (
    /\b(heading|h1|h2|h3|outline|skip(ped)?\s+level|hierarchy)\b/.test(text)
  ) {
    return 'heading'
  }
  if (/\b(accessible\s+name|aria-label|labelled|label|alt\s+text|unnamed)\b/.test(text)) {
    return 'name'
  }
  if (/\b(focus|focusable|focus\s+order|tab\s+order|tabindex)\b/.test(text)) {
    return 'focus'
  }
  if (/\b(keyboard|screen\s+reader|aria-|role=|trap)\b/.test(text)) {
    return 'keyboard'
  }
  return 'other'
}

/** Barrier-kind remediation so heading issues do not get keyboard/ARIA Tasks. */
export function accessibilityBarrierFix(ab: AccessibilityBarrier): string {
  const evidence = clipEvidence(ab.evidence)
  const element = ab.element.trim() || 'the affected control'
  const kind = classifyAccessibilityBarrier(ab.barrier, ab.evidence)

  switch (kind) {
    case 'heading':
      return [
        `1. Fix the heading structure issue: ${evidence}`,
        '2. Ensure a logical outline (h1 then h2 sections without skipped levels)',
        '3. Keep section titles visible or provide an equivalent accessible heading',
      ].join('\n')
    case 'name':
      return [
        `1. Give "${element}" an accessible name: ${evidence}`,
        '2. Prefer a visible label; otherwise aria-label that matches the visible purpose',
        '3. Re-check with a screen reader or accessibility tree that the name is announced',
      ].join('\n')
    case 'focus':
      return [
        `1. Fix focus order for "${element}": ${evidence}`,
        '2. Ensure the control is reachable in a sensible tab sequence',
        '3. Make focus visible and do not trap keyboard users',
      ].join('\n')
    case 'keyboard':
      return [
        `1. Make "${element}" operable from the keyboard: ${evidence}`,
        '2. Add proper roles and names only where native HTML is insufficient',
        '3. Test with keyboard and a screen reader on this step',
      ].join('\n')
    default:
      return [
        `1. Resolve this accessibility barrier on "${element}": ${evidence}`,
        '2. Match the fix to the barrier (structure, name, or interaction), not a generic ARIA pass',
        '3. Verify the journey step remains completable with assistive tech',
      ].join('\n')
  }
}
