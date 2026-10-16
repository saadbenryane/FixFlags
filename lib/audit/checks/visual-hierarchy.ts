import { renderedContentMetadata, type RenderedCopy } from '../browser/rendered-copy'
import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { recordObservation, type CheckRecorder } from './assertion'

export function runVisualHierarchyChecks(
  meta: PageMetadata | null,
  captureMetrics: CaptureMetrics | null,
  record?: CheckRecorder,
  renderedCopy?: RenderedCopy | null,
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const count = captureMetrics?.competingPrimaryCtaCount
  const validCount = count !== undefined && Number.isFinite(count) && count >= 0
  recordObservation(record, 'prominent-action-count', 'Sampled action hierarchy', 'Fewer than two equally prominent actions compete in the sampled mobile viewport',
    !validCount ? 'Prominent actions were not measured.' : `${count} equally prominent actions measured.${captureMetrics?.competingPrimaryCtaComplete === false ? ' Style coverage is incomplete.' : ''}`,
    validCount && captureMetrics?.competingPrimaryCtaComplete !== false ? count < 2 : undefined, true)

  if (captureMetrics) {
    if (validCount && captureMetrics.competingPrimaryCtaComplete !== false && count >= 2) {
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

  }

  const copy = meta ? meta.renderedCopy : renderedCopy
  if (!meta && !copy?.complete || copy !== undefined && !copy?.complete) {
    for (const [key, name] of [['section-headings', 'Captured section hierarchy'], ['headline-presence', 'Captured headline'], ['heading-word-count', 'Sampled heading density']])
      recordObservation(record, key, name, 'Readable page copy supports this observation', 'Complete page prose is unavailable.', undefined, true)
    return findings
  }
  const prose = renderedContentMetadata(meta ?? { pageText: copy!.pageText, h1s: copy!.h1s, h2s: copy!.h2s, renderedCopy: copy })
  const bodyText = (prose.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const h1s = prose.h1s ?? [], h2s = prose.h2s ?? []
  const totalHeadings = h1s.length + h2s.length
  recordObservation(record, 'section-headings', 'Captured section hierarchy', 'Captured heading structure includes sections beneath its headline',
    `${h1s.length} H1 and ${h2s.length} H2 headings recorded.`,
    totalHeadings > 0 && bodyText.trim().length >= 200 ? !(h2s.length === 0 && h1s.length <= 1) : undefined, true)
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
  recordObservation(record, 'headline-presence', 'Captured headline', 'Captured content includes an H1 heading',
    `${h1Count} H1 headings in ${bodyText.length} sampled characters.`, h1Count > 0 ? true : bodyText.length > 10 ? false : undefined, true)
  if (h1Count === 0) {
    const hasVisibleText = bodyText.length > 10
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

  // Approximate above-fold content: H1 is always visible; only the first 2 H2s
  // are likely above the fold on a typical page layout. Counting all H2s
  // over-counts on pages with many content sections below the fold.
  const aboveFoldHeadings = [h1s[0] ?? '', ...(h2s.slice(0, 2))]
  const aboveFoldTextLength = aboveFoldHeadings.join(' ').split(/\s+/).filter(Boolean).length
  recordObservation(record, 'heading-word-count', 'Sampled heading density', 'The H1 and first two H2 headings contain at most 80 words',
    `${aboveFoldTextLength} words in the sampled headings. Physical above-fold density was not measured.`,
    totalHeadings > 0 ? aboveFoldTextLength <= 80 : undefined, true)
  if (aboveFoldTextLength > 80) {
    findings.push({
      checkId: 'hierarchy-information-density',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Above-the-fold content has high information density',
      evidence: `Headings above the fold total ~${aboveFoldTextLength} words. Users scanning the page may miss the key message.`,
      fix: '1. Lead with ONE clear headline and ONE supporting subhead\n2. Move secondary messages below the fold or into visual cards\n3. Use whitespace to separate key value propositions\n4. Apply the 3-second test: can a visitor understand the value in 3 seconds?',
      confidence: 0.7,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
