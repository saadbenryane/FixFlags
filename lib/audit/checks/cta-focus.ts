import type { CaptureMetrics } from '../capture-metrics'
import { DeterministicFlag } from './index'

/** Three or more equally-weighted primary CTAs above the fold dilute focus. */
const COMPETING_CTA_THRESHOLD = 3

/**
 * CTA focus scan (MESSAGE): a landing page converts best with one obvious primary
 * action above the fold. Flags when several high-intent CTAs compete for it.
 */
export function runCtaFocusChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null || metrics.competingPrimaryCtaCount < COMPETING_CTA_THRESHOLD) {
    return []
  }

  const labels = metrics.competingPrimaryCtaLabels.filter(Boolean)
  const evidence =
    labels.length > 0
      ? `Competing CTAs above the fold: ${labels.map((l) => `"${l}"`).join(', ')}`
      : `${metrics.competingPrimaryCtaCount} high-intent CTAs detected above the fold`

  return [
    {
      checkId: 'competing-ctas',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${metrics.competingPrimaryCtaCount} competing primary CTAs above the fold`,
      evidence,
      fix: 'Choose one primary action and make it the visually dominant button above the fold. Demote the rest to secondary (ghost/text) styling or move them further down the page.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    },
  ]
}
