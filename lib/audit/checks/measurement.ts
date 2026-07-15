import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from './index'

export function runMeasurementChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!meta.hasAnalytics) {
    findings.push({
      checkId: 'measurement-ga-gtm-posthog-missing',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      // POLISH, not IMPORTANT: analytics can load via a tag manager, a first-party
      // proxy, or only after consent, none of which are visible in the initial
      // HTML. Absence in HTML is a hint, not a blocker, so this must not lead a
      // report. Whether to measure at all is also the owner's call.
      severity: 'POLISH',
      problem: 'No web analytics detected in the page HTML',
      evidence:
        'No analytics snippet (GA4, GTM, PostHog, Segment, Plausible, Vercel, etc.) was found in the page HTML. If you load analytics through a tag manager, a first-party proxy, or after cookie consent, it may not appear here.',
      fix: '1. If you have no analytics yet, add one (GA4, PostHog, or Plausible are common)\n2. Put the snippet in the <head> of every page\n3. Confirm events fire in the browser Network tab',
      confidence: 0.6,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag missing consent when analytics ARE present: a consent banner exists
  // to gate tracking, so complaining about its absence on a site with no detected
  // analytics is circular and confusing.
  if (meta.hasAnalytics && !meta.hasCookieConsent) {
    findings.push({
      checkId: 'measurement-consent-blocking-incomplete',
      rubric: 'REACH',
      impactTag: 'MEASUREMENT',
      severity: 'POLISH',
      problem: 'Analytics load without a detected cookie consent control',
      evidence:
        'Analytics were detected but no consent banner or cookie control was found. In the EU/UK, tracking cookies generally require prior consent.',
      fix: '1. Add a consent management platform (Cookiebot, Osano, or CookieYes)\n2. Block analytics scripts from loading until consent is given\n3. Link to the privacy policy and include a cookie settings button in the footer',
      confidence: 0.6,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}