import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from './index'

export function runMeasurementChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!meta.hasAnalytics) {
    findings.push({
      checkId: 'measurement-ga-gtm-posthog-missing',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      severity: 'IMPORTANT',
      problem: 'No web analytics (GA4, GTM, or PostHog) detected on this site',
      evidence: 'No analytics script tags or measurement snippets found in page HTML.',
      fix: 'Add Google Analytics 4, Google Tag Manager, or PostHog for conversion tracking and business intelligence.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasCookieConsent) {
    findings.push({
      checkId: 'measurement-consent-blocking-incomplete',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      severity: 'POLISH',
      problem: 'No cookie consent or privacy controls detected alongside analytics',
      evidence: `Analytics were ${meta.hasAnalytics ? 'detected' : 'not detected'} but no consent banner or privacy control elements found.`,
      fix: 'If you serve EU/EEA visitors, add a consent management platform (CMP) such as Cookiebot or Osano that blocks analytics until consent is given.',
      confidence: 0.75,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}