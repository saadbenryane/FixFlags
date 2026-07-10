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
      fix: '1. Add Google Analytics 4, Google Tag Manager, or PostHog\n2. Add the tracking snippet to the <head> of every page\n3. Verify events are firing by checking the browser\'s Network tab',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasCookieConsent) {
    findings.push({
      checkId: 'measurement-consent-blocking-incomplete',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      severity: meta.hasAnalytics ? 'IMPORTANT' : 'POLISH',
      problem: 'No cookie consent or privacy controls detected alongside analytics',
      evidence: `Analytics were ${meta.hasAnalytics ? 'detected' : 'not detected'} but no consent banner or privacy control elements found.`,
      fix: '1. Add a consent management platform (Cookiebot, Osano, or CookieYes)\n2. Block analytics scripts from loading until consent is given\n3. Link to the privacy policy and include a cookie settings button in the footer',
      confidence: 0.75,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}