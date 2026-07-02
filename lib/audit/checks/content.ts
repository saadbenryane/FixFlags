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
        fix: '1. Replace the generic H1 with a benefit-driven headline\n2. Name the audience and the outcome ("Build X for Y teams")\n3. Test that the headline communicates value within 3 seconds',
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
      fix: '1. Add a primary CTA button above the fold\n2. Use an outcome-led label: "Get started free", "Start your trial"\n3. Make it visually distinct (high contrast, larger touch target)',
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
      fix: '1. Add H2 headings for each major section (features, pricing, FAQ)\n2. Make H2s scannable and descriptive\n3. Maintain a logical heading hierarchy (H1 → H2 → H3)',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.forms > 0 && meta.formInputsMissingValidation > 0) {
    const missingRatio = meta.totalFormInputs > 0
      ? meta.formInputsMissingValidation / meta.totalFormInputs
      : 1
    findings.push({
      checkId: 'form-missing-validation',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: missingRatio >= 0.5 ? 'IMPORTANT' : 'POLISH',
      problem: `${meta.formInputsMissingValidation} of ${meta.totalFormInputs} form field${meta.totalFormInputs > 1 ? 's' : ''} allow${meta.formInputsMissingValidation === 1 ? 's' : ''} submission without inline validation`,
      evidence: `${meta.forms} form${meta.forms > 1 ? 's' : ''} on the page with ${meta.formInputsMissingValidation} input${meta.formInputsMissingValidation > 1 ? 's' : ''} missing required, aria-required, or pattern attributes`,
      fix: '1. Add required or aria-required to mandatory form fields\n2. Use pattern attribute for format validation (email, phone, etc.)\n3. Display inline error messages on submit so users know what to fix',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
