import type { FlowScanResult } from '../flow/run-flow-scan'
import { DeterministicFlag } from './index'

export function runFlowChecks(result: FlowScanResult): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const ctaLabel = result.ctaText ? `"${result.ctaText}"` : 'Primary CTA'

  switch (result.status) {
    case 'no_cta':
      findings.push({
        checkId: 'flow-no-cta-found',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'No clickable primary CTA found in the viewport',
        evidence: 'Flow scan could not find a signup, pricing, or get-started control above the fold.',
        fix: 'Add a visible primary CTA button or link in the hero section with clear action text.',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
      break
    case 'unclickable':
      findings.push({
        checkId: 'flow-cta-unclickable',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'CRITICAL',
        problem: 'Primary CTA could not be clicked',
        evidence: `${ctaLabel} was detected but the click action failed or the element was not interactable.`,
        fix: 'Ensure the CTA is not covered by overlays, cookie banners, or disabled states. Test the click in Chrome DevTools.',
        confidence: 0.95,
        source: 'DETERMINISTIC',
      })
      break
    case 'error_response':
      findings.push({
        checkId: 'flow-cta-404',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'CRITICAL',
        problem: 'Primary CTA leads to an error page',
        evidence: `After clicking ${ctaLabel}, the page returned HTTP ${result.httpStatus ?? 'error'} at ${result.finalUrl}`,
        fix: 'Fix the CTA destination URL. Confirm the route exists and returns 200 in production.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
      break
    case 'dead_end':
      findings.push({
        checkId: 'flow-cta-dead-end',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Primary CTA click did not navigate anywhere',
        evidence: `Clicking ${ctaLabel} left the browser on the same URL with no meaningful page change.`,
        fix: 'Wire the CTA to a real route or action. Replace placeholder buttons and hash-only links.',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
      break
    case 'external_leave':
      findings.push({
        checkId: 'flow-cta-external-leave',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'POLISH',
        problem: 'Primary CTA sends users off your domain unexpectedly',
        evidence: `After clicking ${ctaLabel}, the browser navigated to ${result.finalUrl}`,
        fix: 'Prefer same-origin signup or pricing pages. If external checkout is intentional, make the destination obvious in the CTA copy.',
        confidence: 0.75,
        source: 'DETERMINISTIC',
      })
      break
    case 'timeout':
    case 'skipped':
    case 'success':
      break
  }

  return findings
}
