import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

/**
 * Measurement scan (REACH): can the team tell whether the page actually
 * converts? Today this flags the absence of any analytics/measurement tag.
 * Provider detection lives in metadata.ts (`hasAnalytics`).
 */
export function runMeasurementChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!meta.hasAnalytics) {
    findings.push({
      checkId: 'analytics-missing',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      severity: 'IMPORTANT',
      problem: 'No analytics or measurement tag detected',
      evidence:
        'No Google Analytics, GTM, Plausible, Fathom, Segment, or Mixpanel snippet was found in the page HTML',
      fix: 'Install an analytics tag (GA4, Plausible, or PostHog) and track your primary conversion event so you can tell whether a change increased signups or quietly broke them.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
