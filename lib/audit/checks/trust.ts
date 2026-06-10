import { PageMetadata } from '../metadata'
import { DeterministicFinding } from './index'

export function runTrustChecks(
  url: string,
  meta: PageMetadata,
  consoleErrors: Array<{ type: string; text: string }>
): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []

  if (!url.startsWith('https://')) {
    findings.push({
      checkId: 'no-https',
      area: 'TRUST',
      severity: 'CRITICAL',
      problem: 'Site is not served over HTTPS',
      evidence: `URL: ${url}`,
      fix: 'Enable HTTPS. Most hosting providers (Railway, Vercel, Netlify) provide free SSL certificates.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasPrivacyPolicy) {
    findings.push({
      checkId: 'no-privacy-policy',
      area: 'TRUST',
      severity: 'MEDIUM',
      problem: 'No privacy policy link found',
      evidence: 'No link containing "privacy" found in the page',
      fix: 'Add a privacy policy page and link it in the footer. Required by GDPR/CCPA.',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasContactInfo) {
    findings.push({
      checkId: 'no-contact-info',
      area: 'TRUST',
      severity: 'MEDIUM',
      problem: 'No contact information found',
      evidence: 'No email address, phone number, or contact link found',
      fix: 'Add contact information (email, contact form link, or social links) to the page or footer.',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.hasAnalytics && !meta.hasCookieConsent) {
    findings.push({
      checkId: 'cookie-consent-absent',
      area: 'TRUST',
      severity: 'MEDIUM',
      problem: 'Analytics detected but no cookie consent found',
      evidence: 'Analytics script found but no cookie consent banner or cookie management found',
      fix: 'Add a cookie consent banner (e.g., Cookiebot, CookieYes) if you track EU users. Required by GDPR.',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  const criticalErrors = consoleErrors.filter((e) => e.type === 'error')
  if (criticalErrors.length >= 3) {
    findings.push({
      checkId: 'console-errors-critical',
      area: 'TRUST',
      severity: 'HIGH',
      problem: `${criticalErrors.length} JavaScript console errors detected`,
      evidence: `Console errors: ${criticalErrors.slice(0, 2).map((e) => e.text.slice(0, 80)).join('; ')}`,
      fix: 'Fix the JavaScript errors. Open DevTools in Chrome and resolve each error in the Console tab.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (criticalErrors.length > 0) {
    findings.push({
      checkId: 'console-errors-some',
      area: 'TRUST',
      severity: 'MEDIUM',
      problem: `${criticalErrors.length} JavaScript console error${criticalErrors.length > 1 ? 's' : ''} detected`,
      evidence: `Console errors: ${criticalErrors.map((e) => e.text.slice(0, 80)).join('; ')}`,
      fix: 'Investigate and fix the JavaScript errors. These may indicate broken functionality.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
