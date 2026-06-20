import type { FlowScanResult } from '../flow/run-flow-scan'
import { isAuthUtilityLink } from '../flow/link-scoring'
import { DeterministicFlag } from './index'

function formatCtaEvidence(result: FlowScanResult): string {
  const label = result.ctaText ? `"${result.ctaText}"` : 'Primary CTA'
  const href = result.ctaHref ? ` (href="${result.ctaHref}")` : ''
  return `${label}${href}`
}

function runMultiStepFlowChecks(result: FlowScanResult): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const probes = result.multiStep
  if (!probes) return findings

  if (probes.pricingNav === 'broken') {
    const label = probes.pricingNavLabel ? `"${probes.pricingNavLabel}"` : 'Pricing'
    const href = probes.pricingNavHref ? ` (href="${probes.pricingNavHref}")` : ''
    findings.push({
      checkId: 'flow-pricing-nav-broken',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Pricing nav link does not reach a pricing section or page',
      evidence: `Clicking ${label}${href} in the header nav did not scroll to a valid section or open a pricing page.`,
      fix: 'Add an id="pricing" section on the page or link the nav item to your real /pricing route.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (probes.mobileMenu === 'broken') {
    findings.push({
      checkId: 'flow-mobile-menu-broken',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Mobile menu does not reveal navigation links',
      evidence:
        'At 375px width, header nav links were hidden and the menu toggle did not make them reachable.',
      fix: 'Wire the hamburger/menu button to open the nav drawer. Confirm Pricing and Features links are tappable on mobile.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (probes.formValidation === 'broken') {
    const label = probes.formLabel ? `"${probes.formLabel}"` : 'conversion form'
    findings.push({
      checkId: 'flow-form-no-validation',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Empty form submit shows no validation feedback',
      evidence: `Submitting ${label} with empty fields did not trigger HTML5 validation or visible error messages.`,
      fix: 'Add required attributes and visible error messages on empty submit. Use aria-invalid and role="alert" for screen readers.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}

export function runFlowChecks(result: FlowScanResult): DeterministicFlag[] {
  const findings: DeterministicFlag[] = [...runMultiStepFlowChecks(result)]
  const ctaLabel = formatCtaEvidence(result)

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
      if (result.ctaText && result.ctaHref && isAuthUtilityLink(result.ctaHref, result.ctaText)) {
        break
      }
      findings.push({
        checkId: 'flow-cta-dead-end',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Primary CTA click did not navigate anywhere',
        evidence: `Clicking ${ctaLabel} left the browser on the same URL with no meaningful page change.`,
        fix: 'Wire the hero CTA to a real route or action. Replace placeholder buttons and hash-only links that target missing sections.',
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
