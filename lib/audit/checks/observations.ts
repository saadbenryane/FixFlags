import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CheckAssertion } from './assertion'
import { filterOutIframeAxeViolations, type AxeViolation } from './accessibility'

/** Positive observations come from inspected inputs, never from missing Flags. */
export function recordCheckObservations(module: string, input: {
  url: string; metadata: PageMetadata; headers?: Record<string, string> | null;
  desktop: PageSpeedResult | null; mobile: PageSpeedResult | null; axe?: AxeViolation[];
}): CheckAssertion[] {
  const result: CheckAssertion[] = []
  const record = (key: string, name: string, expected: string, observed: string, passed: boolean) => {
    result.push({ key, name, expected, observed, passed })
  }
  if (module === 'security') {
    const https = new URL(input.url).protocol === 'https:'
    record('https', 'Page uses HTTPS', 'The inspected page URL uses HTTPS', https ? 'HTTPS URL' : 'HTTP URL', https)
    if (https) {
      const insecure = input.metadata.images.filter(image => image.src.startsWith('http://')).length
      record('image-transport', 'Image transport', 'Captured image URLs do not use HTTP', `${insecure} HTTP image URLs in captured metadata`, insecure === 0)
    }
  }
  if (module === 'measurement') {
    record('analytics-markup', 'Analytics configuration in HTML', 'An analytics snippet is present in the captured HTML',
      input.metadata.hasAnalytics ? 'Analytics snippet detected' : 'No snippet detected; consent-delayed or proxied analytics may not appear here', input.metadata.hasAnalytics)
  }
  if (module === 'security-headers' && input.headers) {
    for (const [header, name] of [['content-security-policy', 'Content Security Policy'], ['x-content-type-options', 'Content type protection']] as const) {
      const value = input.headers[header]
      const passed = header === 'x-content-type-options' ? value?.toLowerCase() === 'nosniff' : Boolean(value)
      record(header, name, header === 'x-content-type-options' ? 'Response specifies nosniff' : 'An enforcing CSP header is present',
        value ? `${header} recorded` : `${header} absent`, Boolean(passed))
    }
  }
  if (module === 'accessibility' && input.axe !== undefined) {
    const violations = filterOutIframeAxeViolations(input.axe)
    record('automated-accessibility', 'Automated accessibility inspection', 'No axe violations in the inspected top-level page',
      `${violations.length} automated rule violations recorded; manual accessibility was not evaluated`, violations.length === 0)
  }
  if (module === 'performance' || module === 'mobile') {
    const data = module === 'mobile' ? input.mobile : input.desktop
    if (data) {
      if (typeof data.lcp === 'number' && Number.isFinite(data.lcp)) record('lcp', `${module === 'mobile' ? 'Mobile' : 'Desktop'} largest contentful paint`,
        'Measured LCP is at most 2500ms', `${Math.round(data.lcp)}ms in the recorded PageSpeed run`, data.lcp <= 2500)
      if (typeof data.cls === 'number' && Number.isFinite(data.cls)) record('cls', `${module === 'mobile' ? 'Mobile' : 'Desktop'} layout shift`,
        'Measured CLS is at most 0.1', `${data.cls} in the recorded PageSpeed run`, data.cls <= 0.1)
    }
  }
  return result
}
