import type { FlowScanResult } from '../flow/run-flow-scan'
import { isAuthUtilityLink } from '../flow/link-scoring'
import { runPostClickFlowChecks } from './flow-post-click'
import { runDestinationTrustChecks } from './flow-destination-trust'
import { runFlowUXChecks } from './flow-ux'
import { DeterministicFlag } from './index'
import { registerCheck } from './registry'

const FLOW_CHECK_DESCRIPTORS = [
  { id: 'flow-no-cta-found', severity: 'IMPORTANT', tags: ['requiresBrowser', 'cta-flow'] },
  { id: 'flow-cta-unclickable', severity: 'CRITICAL', tags: ['requiresBrowser', 'cta-flow'] },
  { id: 'flow-cta-404', severity: 'CRITICAL', tags: ['requiresBrowser', 'cta-flow'] },
  { id: 'flow-cta-dead-end', severity: 'IMPORTANT', tags: ['requiresBrowser', 'cta-flow'] },
  { id: 'flow-cta-external-leave', severity: 'POLISH', tags: ['requiresBrowser', 'cta-flow'] },
  { id: 'flow-pricing-nav-broken', severity: 'IMPORTANT', tags: ['requiresBrowser', 'multi-step'] },
  { id: 'flow-mobile-menu-broken', severity: 'IMPORTANT', tags: ['requiresBrowser', 'multi-step'] },
  { id: 'flow-form-no-validation', severity: 'IMPORTANT', tags: ['requiresBrowser', 'multi-step'] },
  { id: 'flow-form-slow-feedback', severity: 'POLISH', tags: ['requiresBrowser', 'multi-step'] },
  { id: 'scroll-ghost-sections', severity: 'IMPORTANT', tags: ['requiresBrowser', 'multi-step'] },
  { id: 'flow-cta-blank-destination', severity: 'CRITICAL', tags: ['requiresBrowser', 'post-click'] },
  { id: 'flow-cta-stuck-loading', severity: 'CRITICAL', tags: ['requiresBrowser', 'post-click'] },
  {
    id: 'flow-cta-destination-no-trust',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-trust'],
  },
  {
    id: 'flow-destination-no-headline',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-destination-no-cta',
    severity: 'CRITICAL',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-cta-message-mismatch',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-destination-cta-overload',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-destination-stuck-loading',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-destination-no-privacy',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
  {
    id: 'flow-destination-slow-load',
    severity: 'IMPORTANT',
    tags: ['requiresBrowser', 'destination-ux'],
  },
] as const

for (const descriptor of FLOW_CHECK_DESCRIPTORS) {
  registerCheck({
    id: descriptor.id,
    rubric: 'EXPERIENCE',
    impactTag: 'CONVERSION',
    severity: descriptor.severity,
    tags: [...descriptor.tags],
    requiresBrowser: true,
    evaluate: () => null,
  })
}

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
      fix: '1. Add an id="pricing" section on the page or link the nav item to your real /pricing route\n2. Confirm the nav item points to the real pricing destination\n3. Test the header Pricing click on desktop and mobile',
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
      fix: '1. Wire the hamburger/menu button to open the nav drawer\n2. Ensure Pricing and Features links are visible inside the open menu\n3. Test the menu at 375px width and confirm links are tappable',
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
      fix: '1. Add required attributes to mandatory form fields\n2. Show visible error messages on empty submit\n3. Use aria-invalid and role="alert" so screen readers announce errors',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (
    probes.formValidation === 'ok' &&
    probes.formFeedbackMs != null &&
    probes.formFeedbackMs > 1_000
  ) {
    const label = probes.formLabel ? `"${probes.formLabel}"` : 'conversion form'
    findings.push({
      checkId: 'flow-form-slow-feedback',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Form validation feedback is too slow',
      evidence: `Submitting ${label} with empty fields showed feedback after ${probes.formFeedbackMs}ms (expected under 1000ms).`,
      fix: '1. Show inline validation immediately on submit\n2. Use HTML5 required attributes or synchronous client-side checks before any network call\n3. Confirm validation feedback appears within 1 second',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (probes.ghostSections != null && probes.ghostSections > 0) {
    const sample = probes.ghostSampleText
      ? `"${probes.ghostSampleText}"`
      : probes.ghostSampleSelector ?? 'section'
    findings.push({
      checkId: 'scroll-ghost-sections',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${probes.ghostSections} page section${probes.ghostSections > 1 ? 's' : ''} stay invisible after scroll`,
      evidence: `After scrolling, ${probes.ghostSections} section${probes.ghostSections > 1 ? 's' : ''} remained at opacity 0 or offset (sample: ${sample}).`,
      fix: '1. Fix scroll-triggered animations so sections become visible when they enter the viewport\n2. Ensure IntersectionObserver callbacks remove hidden or offset states\n3. Test by scrolling through the full page after a hard refresh',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}

export function runFlowChecks(result: FlowScanResult): DeterministicFlag[] {
  const findings: DeterministicFlag[] = [
    ...runMultiStepFlowChecks(result),
    ...runPostClickFlowChecks(result.postClickMetrics),
    ...runDestinationTrustChecks(result),
    ...runFlowUXChecks(result),
  ]
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
        fix: '1. Add a visible primary CTA button or link in the hero section\n2. Use clear action text tied to the next step\n3. Confirm the CTA appears in the initial desktop viewport',
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
        fix: '1. Remove overlays, cookie banners, or disabled states that block the CTA\n2. Ensure the CTA has a valid href or click handler\n3. Test the click in Chrome DevTools on the production URL',
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
        fix: '1. Fix the CTA destination URL\n2. Confirm the route exists and returns HTTP 200 in production\n3. Click the CTA from the live page and verify it reaches the intended screen',
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
        fix: '1. Wire the hero CTA to a real route or action\n2. Replace placeholder buttons and hash-only links that target missing sections\n3. Click the CTA and confirm the page changes meaningfully',
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
        fix: '1. Prefer a same-origin signup or pricing page for the primary CTA\n2. If external checkout is intentional, make that destination obvious in the CTA copy\n3. Click the CTA and confirm users understand why they left the site',
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
