import { isConsentControl } from '../consent-controls'
import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'

/** These observations establish captured public signals, never policy quality,
 * reachable contact destinations, consent enforcement or legal compliance. */
export function publicTrustObservations(meta: PageMetadata): Record<'privacy-link' | 'contact-information' | 'cookie-consent-signals', CheckAssertion> {
  const consentControls = meta.renderedCopy?.consentControls
  const hasConsent = consentControls ? consentControls.some(isConsentControl) : meta.hasCookieConsent
  const consentComplete = hasConsent || meta.renderedCopy?.consentControlsComplete !== false
  // An unread laid-out page does not prove a link is absent. A parsed page without rendered copy still does.
  const captureIncomplete = meta.renderedCopy?.complete === false
  const privacyKnown = !captureIncomplete || meta.hasPrivacyPolicy
  const contactKnown = !captureIncomplete || meta.hasContactInfo
  return {
    'privacy-link': { key: 'privacy-link', name: 'Privacy policy link', expected: 'A privacy policy link is present in the captured page',
      observed: privacyKnown ? meta.hasPrivacyPolicy ? 'Privacy policy link detected in captured page links' : 'No privacy policy link detected in captured page links'
        : 'The laid-out page was not captured, so a privacy policy link was not established',
      passed: privacyKnown && meta.hasPrivacyPolicy, complete: privacyKnown },
    'contact-information': { key: 'contact-information', name: 'Contact information', expected: 'Contact information is present in the captured page',
      observed: contactKnown ? meta.hasContactInfo ? 'Contact information detected in captured content or structured data' : 'No contact information detected in captured content or structured data'
        : 'The laid-out page was not captured, so contact information was not established',
      passed: contactKnown && meta.hasContactInfo, complete: contactKnown },
    'cookie-consent-signals': { key: 'cookie-consent-signals', name: 'Cookie-consent signals',
      expected: 'Detected cookie-based analytics is accompanied by consent signals in the captured page',
      observed: !meta.hasCookieBasedAnalytics ? 'No known cookie-based analytics detected in captured markup; consent obligations were not evaluated'
        : !consentComplete ? 'Consent control collection was incomplete; consent presence was not established'
        : hasConsent ? 'Cookie-based analytics and consent signals detected; consent enforcement was not evaluated'
          : 'Cookie-based analytics detected without consent signals in the captured page',
      passed: !meta.hasCookieBasedAnalytics || hasConsent, complete: !meta.hasCookieBasedAnalytics || consentComplete,
      ...(!meta.hasCookieBasedAnalytics && !hasConsent ? { disposition: 'observed' as const } : {}) },
  }
}

export function runTrustChecks(
  _url: string,
  meta: PageMetadata,
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const observations = publicTrustObservations(meta)

  if (observations['privacy-link'].complete !== false && !observations['privacy-link'].passed) {
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

  if (observations['contact-information'].complete !== false && !observations['contact-information'].passed) {
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

  if (observations['cookie-consent-signals'].complete && !observations['cookie-consent-signals'].passed) {
    findings.push({
      checkId: 'cookie-consent-absent',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Analytics detected without a recorded consent control',
      evidence: 'Known cookie-based analytics markup was detected, but no recognized consent control was recorded in this page scope. Consent enforcement and legal obligations were not evaluated.',
      fix: '1. Confirm the intended analytics behavior and applicable consent requirements\n2. If consent controls are required, provide clear choices and ensure the implementation honors them before enabling the relevant tracking\n3. Provide a working settings control so visitors can review and change their choices\n4. Recheck the public controls and test enforcement separately',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
