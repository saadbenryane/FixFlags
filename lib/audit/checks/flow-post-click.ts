import type { PostClickMetrics } from '../flow/post-click-probes'
import { DeterministicFlag } from './index'

const BLANK_DESTINATION_MS = 3_000
const STUCK_LOADING_MS = 2_000

export function runPostClickFlowChecks(metrics: PostClickMetrics | undefined): DeterministicFlag[] {
  if (!metrics) return []

  const findings: DeterministicFlag[] = []

  if (metrics.blankScreenMs > BLANK_DESTINATION_MS || metrics.timeToFirstContentMs > BLANK_DESTINATION_MS) {
    findings.push({
      checkId: 'flow-cta-blank-destination',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Primary CTA destination stayed blank too long after click',
      evidence: `After clicking the primary CTA, meaningful content appeared after ${metrics.timeToFirstContentMs}ms (blank for ${metrics.blankScreenMs}ms).`,
      fix: 'Show hero copy, form, or a loading state within 3 seconds on the CTA destination. Avoid long blank screens while JavaScript bundles load.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (metrics.stuckLoading) {
    const label = metrics.stuckLoadingLabel ? `"${metrics.stuckLoadingLabel}"` : 'loading UI'
    findings.push({
      checkId: 'flow-cta-stuck-loading',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading or skeleton UI persisted on the CTA destination',
      evidence: `Visible ${label} remained on the destination page for more than ${STUCK_LOADING_MS}ms after navigation.`,
      fix: 'Hide skeletons and spinners once the destination content loads. Swap loading placeholders for real copy and CTAs.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
