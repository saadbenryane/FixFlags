import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

export function runContentChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (meta.h1s.length > 0) {
    const h1 = meta.h1s[0]
    const genericPhrases = ['home', 'welcome', 'welcome to', 'untitled', 'coming soon', 'hello world']
    const categoryHeadlinePatterns = [
      /build something (amazing|great|beautiful|incredible|awesome)/i,
      /create something (amazing|great|beautiful)/i,
      /make something (amazing|great|beautiful)/i,
      /\bthe next-generation\b/i,
      /\bship faster\.?$/i,
      /\bwith AI\.?$/i,
      /\bpowered by AI\.?$/i,
    ]
    const isGeneric =
      genericPhrases.some((p) => h1.toLowerCase().includes(p)) ||
      categoryHeadlinePatterns.some((p) => p.test(h1))

    if (isGeneric) {
      findings.push({
        checkId: 'h1-generic',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Hero headline is generic and does not lead with a visitor outcome',
        evidence: `H1: "${h1}"`,
        fix: 'Replace the generic H1 with a benefit-driven headline that names who it is for and what they get after signing up.',
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

  if (meta.h1s.length > 0 && meta.h2s.length === 0) {
    findings.push({
      checkId: 'heading-hierarchy-missing',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Page has a headline but no section headings (H2)',
      evidence: `H1: "${meta.h1s[0]}"; no H2 elements found`,
      fix: 'Add H2 headings for each major section (features, pricing, FAQ) so visitors can scan the page.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
