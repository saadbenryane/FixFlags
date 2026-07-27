import { PageMetadata } from '../metadata'
import { type PagePurposeResult, isProductPage } from '../page-purpose'
import type { DeterministicFlag } from '../flag-types'

export function runContentChecks(
  meta: PageMetadata,
  purpose: PagePurposeResult = { purpose: 'marketing', reasons: [] }
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const productPage = isProductPage(purpose.purpose)

  if (meta.h1s.length > 0) {
    const h1 = meta.h1s[0]
    const genericPhrases = ['welcome', 'welcome to', 'untitled', 'coming soon', 'hello world']
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

  // "No CTA" only matters on a real marketing/product page. Placeholder
  // domains, docs, articles, and OSS project pages legitimately have no
  // conversion CTA, and flagging them pollutes the report with non-actionable
  // IMPORTANT findings above real issues.
  if (productPage && meta.ctaTexts.length === 0) {
    const sampleLinks = meta.links.slice(0, 5).map((l) => `"${l.text || l.href}"`).join(', ')
    findings.push({
      checkId: 'no-cta-detected',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'No call-to-action buttons or links found',
      evidence: `No links or buttons matched CTA keywords (get started, sign up, try, etc.). Found: ${sampleLinks || 'no links'}`,
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
      problem: `${meta.formInputsMissingValidation} of ${meta.totalFormInputs} form field${meta.totalFormInputs > 1 ? 's' : ''} lack${meta.formInputsMissingValidation === 1 ? 's' : ''} HTML validation attributes`,
      evidence: `${meta.forms} form with ${meta.totalFormInputs} input${meta.totalFormInputs > 1 ? 's' : ''}; ${meta.formInputsMissingValidation} missing required, aria-required, or pattern`,
      fix: 'Add required or aria-required to mandatory fields. Use pattern for format validation. If validation is handled client-side (e.g. React Hook Form), ensure error messages are announced with aria-invalid and role="alert".',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
