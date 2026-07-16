import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from './index'

export function runFlowUXChecks(flowScan: FlowScanResult | null): DeterministicFlag[] {
  if (!flowScan) return []

  const findings: DeterministicFlag[] = []
  const ux = flowScan.destinationUX

  if (flowScan.status === 'success' && ux) {
    if (!ux.hasClearHeadline) {
      findings.push({
        checkId: 'flow-destination-no-headline',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Destination page lacks a clear value proposition',
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}", the destination page has no prominent headline that explains what the user gets. CTA leads to: ${flowScan.finalUrl}`,
        fix: '1. Add a clear H1 headline on the destination that reinforces the CTA promise\n2. Match the headline to the CTA text - if CTA says "Start free trial", the destination should lead with the offer\n3. Use a subheadline that explains the next step in one sentence',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }

    if (!ux.hasPrimaryCTA && ux.frictionSignals.ctaCount === 0) {
      findings.push({
        checkId: 'flow-destination-no-cta',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'CRITICAL',
        problem: 'Destination page has no next-step CTA for the user',
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}" to ${flowScan.finalUrl}, the destination page offers no clear next action. The user has reached the end of the journey.`,
        fix: '1. Add a primary CTA on the destination page that continues the user journey\n2. Ensure the CTA matches the context - signup, book demo, start trial, learn more\n3. Include at least one secondary action for users not ready to commit',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
    }

    if (!ux.ctaPromisesMatch && ux.headline && flowScan.ctaText) {
      findings.push({
        checkId: 'flow-cta-message-mismatch',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'CTA text and destination page headline send different messages',
        evidence: `CTA says "${flowScan.ctaText}" but destination headline is "${ux.headline}". The user may feel misled or confused. CTA leads to: ${flowScan.finalUrl}`,
        fix: '1. Align the CTA text with the destination page\'s headline\n2. If the CTA promises one thing, the destination page should deliver that thing\n3. Avoid generic CTAs that require the user to "figure it out" on the next page\n4. Test the flow as a first-time visitor to catch mismatches',
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (ux.frictionSignals.tooManyCTAs) {
      const competing = ux.frictionSignals.distinctCtaCount ?? ux.frictionSignals.ctaCount
      findings.push({
        checkId: 'flow-destination-cta-overload',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: `Destination page has ${competing} competing calls-to-action`,
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}", the user lands on a page with ${competing} distinct high-intent CTAs. Choice overload reduces conversion. Destination: ${flowScan.finalUrl}`,
        fix: '1. Designate one primary action per page - everything else is secondary or tertiary\n2. Use visual hierarchy: filled btn for primary, outline/ghost for secondary, text links for tertiary\n3. Remove or demote CTAs that compete with the main conversion goal\n4. Group related actions in a single location rather than scattered across the page',
        confidence: 0.75,
        source: 'DETERMINISTIC',
      })
    }

    if (ux.loadQuality.hadStuckLoading) {
      findings.push({
        checkId: 'flow-destination-stuck-loading',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Destination page has persistent loading UI after navigation',
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}", the destination showed skeleton screens or spinners for over 2 seconds. Users may abandon before content appears. Destination: ${flowScan.finalUrl}`,
        fix: '1. Server-render the hero section so the first screen is immediately visible\n2. Reserve loading states for below-the-fold content only\n3. Aim for under 1 second of loading UI on the primary content\n4. Use streaming or progressive rendering for slower sections',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }

    if (!ux.trustSignals.hasPrivacyPolicy && ux.frictionSignals.formRequiredForValue) {
      findings.push({
        checkId: 'flow-destination-no-privacy',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'Form on destination page asks for information but has no privacy policy',
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}", the user lands on a page with a form but no visible privacy policy link. Users are less likely to submit personal information. Destination: ${flowScan.finalUrl}`,
        fix: '1. Add a privacy policy link near any form that collects personal data\n2. Include a brief "We respect your privacy" note with the link\n3. Link to a real privacy policy page that explains data handling\n4. Consider adding trust badges or security seals near the form',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }

    if (ux.loadQuality.timeToContentMs > 3000) {
      findings.push({
        checkId: 'flow-destination-slow-load',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: `Destination page takes ${(ux.loadQuality.timeToContentMs / 1000).toFixed(1)}s to show content`,
        evidence: `After clicking "${flowScan.ctaText ?? 'CTA'}", meaningful content appeared after ${(ux.loadQuality.timeToContentMs / 1000).toFixed(1)}s. Users may abandon during the wait. Destination: ${flowScan.finalUrl}`,
        fix: '1. Reduce Time to First Byte by optimizing server response\n2. Inline critical CSS and defer non-essential JavaScript\n3. Server-render the hero section with streaming\n4. Target under 2.5s for LCP on the destination page',
        confidence: 0.8,
        source: 'DETERMINISTIC',
      })
    }
  }

  return findings
}
