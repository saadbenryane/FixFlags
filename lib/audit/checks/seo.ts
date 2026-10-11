import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'

export async function runSeoChecks(
  url: string,
  meta: PageMetadata
): Promise<DeterministicFlag[]> {
  const findings: DeterministicFlag[] = []

  if (meta.h1s.length === 0) {
    findings.push({
      checkId: 'h1-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: 'No H1 heading found',
      evidence: 'No <h1> element found in the page',
      fix: 'Use a descriptive main heading and a logical heading hierarchy that matches the visible page.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    // Only flag genuinely competing headings. Responsive layouts render the same
    // H1 twice (one hidden per breakpoint), which is not an SEO problem, so
    // dedupe by text and flag only when more than one distinct H1 remains.
    const distinctH1s = [...new Set(meta.h1s.map((h) => h.trim().toLowerCase()).filter(Boolean))]
    if (distinctH1s.length > 1) {
      findings.push({
        checkId: 'h1-multiple',
        rubric: 'REACH',
        impactTag: 'SEO',
        severity: 'POLISH',
        problem: `Multiple different H1 headings found (${distinctH1s.length})`,
        evidence: `Distinct H1 tags: ${[...new Set(meta.h1s.map((h) => h.trim()).filter(Boolean))].slice(0, 3).map((h) => `"${h}"`).join(', ')}`,
        fix: 'Review whether the headings clearly organize this page. Multiple H1 elements are not automatically an indexing failure.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  const idSet = new Set(meta.elementIds)
  const brokenAnchors: string[] = []
  for (const link of meta.links) {
    if (!link.href.startsWith('#') || link.href === '#') continue
    const target = link.href.slice(1).toLowerCase()
    if (target && !idSet.has(target)) {
      brokenAnchors.push(`${link.text || '(no text)'} → ${link.href}`)
    }
  }
  if (brokenAnchors.length > 0) {
    findings.push({
      checkId: 'broken-page-anchors',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${brokenAnchors.length} on-page link${brokenAnchors.length > 1 ? 's' : ''} point to missing sections`,
      evidence: brokenAnchors.slice(0, 3).join('; '),
      fix: '1. Add matching id attributes for each hash link target (#section-name)\n2. Update nav or footer links to point to existing section ids\n3. Test each anchor link by clicking and verifying it scrolls correctly',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
