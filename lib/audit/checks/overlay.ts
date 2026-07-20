import type { OverlayBlockerInfo } from '../browser/overlay-probe'
import { formatOverlayEvidence } from '../browser/overlay-probe'
import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'

const OVERLAY_CHECK_DESCRIPTORS = [
  { id: 'overlay-blocks-nav', severity: 'CRITICAL' as const },
  { id: 'overlay-blocks-cta', severity: 'CRITICAL' as const },
  { id: 'overlay-blocks-form', severity: 'CRITICAL' as const },
] as const

for (const descriptor of OVERLAY_CHECK_DESCRIPTORS) {
  registerCheck({
    id: descriptor.id,
    rubric: 'EXPERIENCE',
    impactTag: 'CONVERSION',
    severity: descriptor.severity,
    tags: ['requiresBrowser', 'overlay'],
    requiresBrowser: true,
    evaluate: () => null,
  })
}

export type OverlayBlockTarget = 'nav' | 'cta' | 'form'

export function runOverlayBlockerChecks(
  target: OverlayBlockTarget,
  overlay: OverlayBlockerInfo | null | undefined,
  contextLabel?: string
): DeterministicFlag[] {
  if (!overlay) return []

  const checkId =
    target === 'nav'
      ? 'overlay-blocks-nav'
      : target === 'form'
        ? 'overlay-blocks-form'
        : 'overlay-blocks-cta'

  const targetLabel =
    target === 'nav' ? 'primary navigation' : target === 'form' ? 'form controls' : 'primary CTA'

  return [
    {
      checkId,
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      impactTag: 'CONVERSION',
      problem: `Overlay blocks ${targetLabel}`,
      evidence: `${formatOverlayEvidence(overlay)}${contextLabel ? ` · ${contextLabel}` : ''}`,
      fix: `1. Ensure modals and sticky ads do not cover ${targetLabel} without a clear dismiss control.\n2. Lower z-index or relocate the overlay so primary actions stay clickable.\n3. Re-check the click path after the change.`,
      confidence: 0.92,
      source: 'DETERMINISTIC',
    },
  ]
}
