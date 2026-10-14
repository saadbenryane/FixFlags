import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'

/** These observations establish captured public signals, never policy quality,
 * reachable contact destinations, consent enforcement or legal compliance. */
export function publicTrustObservations(meta: PageMetadata): Record<'privacy-link' | 'contact-information' | 'cookie-consent-signals', CheckAssertion> {
  return {
    'privacy-link': { key: 'privacy-link', name: 'Privacy policy link', expected: 'A privacy policy link is present in the captured page',
      observed: meta.hasPrivacyPolicy ? 'Privacy policy link detected in captured page links' : 'No privacy policy link detected in captured page links',
      passed: meta.hasPrivacyPolicy, complete: true },
    'contact-information': { key: 'contact-information', name: 'Contact information', expected: 'Contact information is present in the captured page',
      observed: meta.hasContactInfo ? 'Contact information detected in captured content or structured data' : 'No contact information detected in captured content or structured data',
      passed: meta.hasContactInfo, complete: true },
    'cookie-consent-signals': { key: 'cookie-consent-signals', name: 'Cookie-consent signals',
      expected: 'Detected cookie-based analytics is accompanied by consent signals in the captured page',
      observed: !meta.hasCookieBasedAnalytics ? 'No known cookie-based analytics detected in captured markup; consent obligations were not evaluated'
        : meta.hasCookieConsent ? 'Cookie-based analytics and consent signals detected; consent enforcement was not evaluated'
          : 'Cookie-based analytics detected without consent signals in the captured page',
      passed: !meta.hasCookieBasedAnalytics || meta.hasCookieConsent, complete: true,
      ...(!meta.hasCookieBasedAnalytics && !meta.hasCookieConsent ? { disposition: 'observed' as const } : {}) },
  }
}

export function runTrustChecks(
  _url: string,
  meta: PageMetadata,
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const observations = publicTrustObservations(meta)

  if (!observations['privacy-link'].passed) {
    findings.push({
      checkId: 'no-privacy-policy',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'No privacy policy link found',
      evidence: 'No link with "privacy" in text or href found in page links',
      fix: '1. Create a privacy policy page covering data collection, cookies, and rights\n2. Add a link in the footer ("Privacy" or "Privacy Policy")\n3. Include contact info for data inquiries (email or form)',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (!observations['contact-information'].passed) {
    findings.push({
      checkId: 'no-contact-info',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'No contact information found',
      evidence: 'No email, phone number, or "contact" link found in page text or structured data',
      fix: '1. Add an email address, contact form link, or social links to the page\n2. Place contact information in the footer for consistency\n3. Make the contact method functional (test the link or email)',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  if (!observations['cookie-consent-signals'].passed) {
    findings.push({
      checkId: 'cookie-consent-absent',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Analytics detected but no cookie consent found',
      evidence: 'Analytics script found but no cookie consent banner or cookie management found',
      fix: '1. Add a cookie consent banner (first-party Accept/Reject, or Cookiebot/CookieYes/Osano)\n2. Default analytics denied; load Google Tag Manager / GA only after consent (Consent Mode v2 if using Google)\n3. Include a Cookie settings link in the footer so visitors can change preferences',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
