import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'

export function runTrustChecks(
  url: string,
  meta: PageMetadata,
  consoleErrors: Array<{ type: string; text: string }>
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!url.startsWith('https://')) {
    findings.push({
      checkId: 'no-https',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'Site is not served over HTTPS',
      evidence: `URL: ${url}`,
      fix: '1. Enable HTTPS on your hosting provider (Railway, Vercel, Netlify offer free SSL)\n2. Set up a 301 redirect from HTTP to HTTPS\n3. Update all internal links to use https:// URLs',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasPrivacyPolicy) {
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

  if (!meta.hasContactInfo) {
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

  if (meta.hasCookieBasedAnalytics && !meta.hasCookieConsent) {
    findings.push({
      checkId: 'cookie-consent-absent',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Analytics detected but no cookie consent found',
      evidence: 'Analytics script found but no cookie consent banner or cookie management found',
      fix: '1. Add a cookie consent banner (Cookiebot, CookieYes, or Osano)\n2. Block analytics and tracking scripts until consent is given\n3. Include a cookie settings link in the footer for preference changes',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  const criticalErrors = consoleErrors.filter(
    (error) =>
      error.type === 'error' &&
      !/net::ERR_BLOCKED_BY_CLIENT\.Inspector\b/i.test(error.text)
  )
  if (criticalErrors.length >= 3) {
    findings.push({
      checkId: 'console-errors-critical',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: `${criticalErrors.length} JavaScript console errors detected`,
      evidence: `Console errors: ${criticalErrors.slice(0, 2).map((e) => e.text.slice(0, 80)).join('; ')}`,
      fix: '1. Open Chrome DevTools Console tab\n2. Resolve each error by fixing the source code causing it\n3. Verify all errors are gone after the fix',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (criticalErrors.length > 0) {
    findings.push({
      checkId: 'console-errors-some',
      rubric: 'EXPERIENCE',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: `${criticalErrors.length} JavaScript console error${criticalErrors.length > 1 ? 's' : ''} detected`,
      evidence: `Console errors: ${criticalErrors.map((e) => e.text.slice(0, 80)).join('; ')}`,
      fix: '1. Open Chrome DevTools Console tab and inspect the errors\n2. Trace each error to the source and fix accordingly\n3. Test the affected features after fixing',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
