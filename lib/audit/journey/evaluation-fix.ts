import { formatInspectionGuidance } from '@/lib/improvements/repair-guidance'
import { QUALITATIVE_GUIDANCE_COPY as C } from '@/lib/marketing/copy/qualitative-guidance'
import type {
  AccessibilityBarrier,
  FrictionPoint,
} from '@/lib/audit/journey/evaluator-schema'

function clipEvidence(evidence: string, max = 160): string {
  const trimmed = evidence.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

/** Match conditional repair guidance to the recorded review scope. */
export function frictionFix(fp: FrictionPoint): string {
  const plan = C.friction[fp.type as keyof typeof C.friction] ?? C.friction.default
  return formatInspectionGuidance({ inspection: `${plan.inspection}: ${clipEvidence(fp.evidence)}`,
    changeCondition: plan.condition, changeIfConfirmed: plan.change, preserve: C.frictionPreserve })
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

/** Review the current condition before changing semantics or interactions. */
export function accessibilityBarrierFix(ab: AccessibilityBarrier): string {
  const kind = classifyAccessibilityBarrier(ab.barrier, ab.evidence)
  const plan = C.barrier[kind]
  return formatInspectionGuidance({
    inspection: C.barrierInspection(ab.element, clipEvidence(ab.evidence)),
    changeCondition: plan.condition, changeIfConfirmed: plan.change, preserve: C.barrierPreserve,
  })
}
