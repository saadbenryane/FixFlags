import { PageMetadata } from '../metadata'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from './index'

export function runVisualHierarchyChecks(
  meta: PageMetadata,
  captureMetrics: CaptureMetrics | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const bodyText = (meta.pageText ?? '').slice(0, 6000)
  const h1s = meta.h1s ?? []
  const h2s = meta.h2s ?? []

  if (captureMetrics) {
    if (captureMetrics.competingPrimaryCtaCount >= 2) {
      findings.push({
        checkId: 'hierarchy-competing-actions',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: `${captureMetrics.competingPrimaryCtaCount} equally prominent CTAs compete above the fold`,
        evidence: `Multiple high-intent CTAs with similar visual weight: ${captureMetrics.competingPrimaryCtaLabels.slice(0, 4).map((l) => `"${l}"`).join(', ')}. Users may experience choice paralysis.`,
        fix: '1. Designate one primary CTA as the dominant action (filled button, larger size)\n2. Make secondary actions visually distinct (outline/ghost styling, smaller)\n3. Remove CTAs that serve non-primary goals from above the fold\n4. Use visual hierarchy: primary > secondary > text link for descending prominence',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }

    if (captureMetrics.uniqueFontFamilies > 3) {
      findings.push({
        checkId: 'hierarchy-too-many-fonts',
        rubric: 'EXPERIENCE',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: `${captureMetrics.uniqueFontFamilies} font families reduce visual cohesion`,
        evidence: `Page uses ${captureMetrics.uniqueFontFamilies} distinct font families: ${captureMetrics.fontFamilySample?.join(', ') ?? 'N/A'}. Multiple fonts fragment the visual hierarchy.`,
        fix: '1. Use exactly 2 font families: one for headings (display/serif) and one for body (sans-serif)\n2. Use font weight and size for hierarchy instead of font changes\n3. Remove font imports from third-party widgets that don\'t match the design system\n4. Define a type scale with 4-6 sizes rather than ad-hoc font usage',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
    }
  }

  const totalHeadings = h1s.length + h2s.length
  if (totalHeadings > 0 && h2s.length === 0 && h1s.length <= 1) {
    findings.push({
      checkId: 'hierarchy-no-sections',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Page has a headline but no visible section headings',
      evidence: `${h1s.length} H1 found but no H2 section headings. Content below the hero may not be scannable.`,
      fix: '1. Add H2 section headings to break content into scannable sections\n2. Use descriptive H2s that tell the user what each section is about\n3. Maintain hierarchy: H1 → H2 → H3 → body text\n4. Each section heading should promise a specific benefit or answer a question',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const h1Count = h1s.length
  if (h1Count === 0) {
    const hasVisibleText = bodyText.length > 50
    if (hasVisibleText) {
      findings.push({
        checkId: 'hierarchy-no-headline',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'No visible H1 headline found on the page',
        evidence: 'No H1 element detected in the page HTML. Without a clear headline, visitors cannot immediately understand the page purpose.',
        fix: '1. Add an H1 element as the primary page heading\n2. Make the H1 visible (not display:none or off-screen)\n3. Place the H1 at the top of the main content, above the hero\n4. The H1 should name the product AND the outcome for the visitor',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  const aboveFoldTextLength = h1s.concat(h2s).join(' ').split(/\s+/).length
  if (aboveFoldTextLength > 0 && aboveFoldTextLength > 80) {
    findings.push({
      checkId: 'hierarchy-information-density',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Above-the-fold content has high information density',
      evidence: `Headings and subheadings above the fold total ~${aboveFoldTextLength} words. Users scanning the page may miss the key message.`,
      fix: '1. Lead with ONE clear headline and ONE supporting subhead\n2. Move secondary messages below the fold or into visual cards\n3. Use whitespace to separate key value propositions\n4. Apply the 3-second test: can a visitor understand the value in 3 seconds?',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
