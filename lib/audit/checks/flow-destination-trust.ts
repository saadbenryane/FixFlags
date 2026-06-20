import type { FlowScanResult } from '../flow/run-flow-scan'
import { DeterministicFlag } from './index'

export function runDestinationTrustChecks(result: FlowScanResult): DeterministicFlag[] {
  const trust = result.destinationTrust
  if (!trust || result.status !== 'success') return []

  const missing: string[] = []
  if (!trust.isHttps) missing.push('HTTPS')
  if (!trust.hasPrivacyPolicy) missing.push('privacy policy link')
  if (!trust.hasContactInfo) missing.push('contact information')

  if (missing.length === 0) return []

  return [
    {
      checkId: 'flow-cta-destination-no-trust',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'CTA destination page lacks trust signals',
      evidence: `After clicking the primary CTA, the destination at ${result.finalUrl} is missing: ${missing.join(', ')}.`,
      fix: 'Add privacy policy, contact email, and HTTPS on signup/checkout pages. Visitors need reassurance before entering personal data.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    },
  ]
}
