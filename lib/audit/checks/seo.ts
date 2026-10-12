import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { sectionLinkObservations } from './section-links'
import type { CaptureObservationScope } from '../browser/observation-scope'
import type { CheckAssertion } from './assertion'

export async function runSeoChecks(
  url: string,
  meta: PageMetadata,
  options?: { renderedScope?: CaptureObservationScope; record?: (assertion: CheckAssertion) => void;
    scope?: { complete?: boolean; limitation?: string } }
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

  const sections = sectionLinkObservations(url, meta, options?.renderedScope)
  sections.assertions.forEach(assertion => options?.record?.(assertion))
  if (options?.scope) Object.assign(options.scope, { complete: sections.complete, limitation: sections.limitation })
  findings.push(...sections.flags)

  return findings
}
