import { renderedContentMetadata } from '../browser/rendered-copy'
import { PageMetadata } from '../metadata'
import { type PagePurposeResult, isProductPage } from '../page-purpose'
import type { DeterministicFlag } from '../flag-types'
import { recordObservation, type CheckRecorder } from './assertion'

export function runContentChecks(
  meta: PageMetadata,
  purpose: PagePurposeResult = { purpose: 'marketing', reasons: [] },
  record?: CheckRecorder,
): DeterministicFlag[] {
  meta = renderedContentMetadata(meta)
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
      /\bnext-gen\b/i,
    ]
    const isGeneric =
      genericPhrases.some((p) => h1.toLowerCase().includes(p)) ||
      categoryHeadlinePatterns.some((p) => p.test(h1))

    recordObservation(record, 'headline-specificity', 'Headline wording', 'Captured H1 does not match a generic starter phrase',
      `Captured H1: ${h1}`, !isGeneric, true)

    if (isGeneric) {
      findings.push({
        checkId: 'h1-generic',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'POLISH',
        problem: 'Headline contains a generic phrase',
        evidence: `H1: "${h1}". A phrase match does not establish visitor comprehension or a conversion failure.`,
        fix: '1. Replace the generic H1 with a benefit-driven headline\n2. Name the audience and the outcome ("Build X for Y teams")\n3. Test that the headline communicates value within 3 seconds',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (meta.h1s.length === 0) recordObservation(record, 'headline-specificity', 'Headline wording',
    'A captured H1 can be evaluated', 'No H1 was captured.', undefined, true)

  if (productPage) recordObservation(record, 'cta-presence', 'Recognized action labels',
    'Captured product-page controls include a recognized action label', `${meta.ctaTexts.length} recognized action labels captured.`,
    meta.ctaTexts.length > 0, true)

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
      severity: 'POLISH',
      problem: 'No captured action label matched the recognized phrases',
      evidence: `No links or buttons matched CTA keywords (get started, sign up, try, etc.). Found: ${sampleLinks || 'no links'}. Unrecognized labels and runtime actions were not established as missing or broken.`,
      fix: 'Review the page’s intended visitor action and its visible label. Confirm the existing controls before adding another call to action. Use a descriptive label when it helps visitors understand what happens next.',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  // Skip definitive "no H2" claims on sparse DOM samples (SPA shells / pre-hydration)
  // where H1 may exist in the shell while section headings render later.
  const pageTextLen = (meta.pageText ?? '').trim().length
  const headingSampleComplete = pageTextLen >= 200
  recordObservation(record, 'section-headings', 'Section headings', 'Captured content with an H1 includes H2 section headings',
    `${meta.h1s.length} H1 and ${meta.h2s.length} H2 headings in ${pageTextLen} captured characters.`,
    meta.h1s.length > 0 && headingSampleComplete ? meta.h2s.length > 0 : undefined, true)

  if (meta.forms > 0) recordObservation(record, 'form-validation-attributes', 'Declared form validation',
    'Captured input fields declare HTML validation attributes',
    `${meta.formInputsMissingValidation} of ${meta.totalFormInputs} captured fields lack validation attributes. Runtime validation was not tested.`,
    meta.totalFormInputs > 0 ? meta.formInputsMissingValidation === 0 : undefined, true)
  if (meta.h1s.length > 0 && meta.h2s.length === 0 && headingSampleComplete) {
    findings.push({
      checkId: 'heading-hierarchy-missing',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Page has a headline but no section headings (H2)',
      evidence: `H1: "${meta.h1s[0]}"; no H2 elements found in the captured DOM`,
      fix: '1. Add H2 headings for each major section (features, pricing, FAQ)\n2. Make H2s scannable and descriptive\n3. Maintain a logical heading hierarchy (H1 → H2 → H3)',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.forms > 0 && meta.formInputsMissingValidation > 0) {
    findings.push({
      checkId: 'form-missing-validation',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: `${meta.formInputsMissingValidation} of ${meta.totalFormInputs} form field${meta.totalFormInputs > 1 ? 's' : ''} lack${meta.formInputsMissingValidation === 1 ? 's' : ''} HTML validation attributes`,
      evidence: `${meta.forms} form${meta.forms === 1 ? '' : 's'} with ${meta.totalFormInputs} input${meta.totalFormInputs === 1 ? '' : 's'}; ${meta.formInputsMissingValidation} lack native validation declarations. Required-field semantics and runtime validation were not established.`,
      fix: 'Review which fields are mandatory and how the application validates them. Use native validation where appropriate, and make application errors accessible. Missing attributes alone do not establish broken submissions; aria-required does not enforce validation.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
