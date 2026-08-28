import type { OverlayBlockerInfo } from '../browser/overlay-probe'
import {
  formatOverlayEvidence,
  isDismissibleConsentChrome,
  severityForOverlayBlocker,
} from '../browser/overlay-probe'
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
  })
}

export type OverlayBlockTarget = 'nav' | 'cta' | 'form'

export function runOverlayBlockerChecks(
  target: OverlayBlockTarget,
  overlay: OverlayBlockerInfo | null | undefined,
  contextLabel?: string
): DeterministicFlag[] {
  if (!overlay) return []
  if (isDismissibleConsentChrome(overlay)) return []

  const severity = severityForOverlayBlocker(overlay)
  if (!severity) return []

  const checkId =
    target === 'nav'
      ? 'overlay-blocks-nav'
      : target === 'form'
        ? 'overlay-blocks-form'
        : 'overlay-blocks-cta'

  const targetLabel =
    target === 'nav' ? 'primary navigation' : target === 'form' ? 'form controls' : 'primary CTA'

  const coverageNote =
    typeof overlay.coverageFraction === 'number' && overlay.coverageFraction < 0.85
      ? ' Partial coverage - edges of the target may still be clickable.'
      : ''

  return [
    {
      checkId,
      rubric: 'EXPERIENCE',
      severity,
      impactTag: 'CONVERSION',
      problem:
        severity === 'CRITICAL'
          ? `Overlay blocks ${targetLabel}`
          : `Overlay partially covers ${targetLabel}`,
      evidence: `${formatOverlayEvidence(overlay)}${contextLabel ? ` · ${contextLabel}` : ''}.${coverageNote}`,
      fix: `1. Ensure modals and sticky ads do not cover ${targetLabel} without a clear dismiss control.\n2. Lower z-index or relocate the overlay so primary actions stay clickable.\n3. Re-check the click path after the change.`,
      confidence: severity === 'CRITICAL' ? 0.92 : 0.8,
      source: 'DETERMINISTIC',
    },
  ]
}
