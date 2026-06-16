import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

export function runContentChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (meta.h1s.length > 0) {
    const h1 = meta.h1s[0]
    const genericPhrases = ['home', 'welcome', 'welcome to', 'untitled', 'coming soon', 'hello world']
    if (genericPhrases.some((p) => h1.toLowerCase().includes(p))) {
      findings.push({
        checkId: 'h1-generic',
        rubric: 'MESSAGE',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'H1 heading is generic and non-descriptive',
        evidence: `H1: "${h1}"`,
        fix: 'Replace the generic H1 with a benefit-driven headline that communicates your unique value proposition.',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (meta.ctaTexts.length === 0) {
    findings.push({
      checkId: 'no-cta-detected',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'No call-to-action buttons found',
      evidence: 'No buttons or links with CTA text found',
      fix: 'Add a primary CTA button above the fold. Common CTAs: "Get started free", "Start your trial", "See how it works".',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
