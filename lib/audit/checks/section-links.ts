import { createHash } from 'node:crypto'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'

export const SECTION_LINK_VERIFICATION_RULE = 'Section link: independently inspect every originally missing fragment under the same rendered page, viewport and access conditions.'
export const SECTION_LINK_LIMITATION = 'Section links cover up to 300 distinct declared targets in the captured document. Additional targets, custom routing, text fragments, later content and click or scroll behavior remain outside this observation.'
const MAX_SECTION_TARGETS = 300

function decodedFragment(fragment: string) {
  try { return decodeURIComponent(fragment) } catch { return fragment }
}

/** Native document targets retain their exact spelling and support named anchors. */
export function sectionTargetSet(metadata: PageMetadata) {
  return new Set([...metadata.elementIds, ...metadata.anchorNames ?? []])
}
export function sectionTargetExists(metadata: PageMetadata, fragment: string, targets = sectionTargetSet(metadata)) {
  const target = decodedFragment(fragment)
  return targets.has(target) || target.toLowerCase() === 'top'
}

function sameDocument(left: URL, right: URL) {
  const a = new URL(left), b = new URL(right)
  a.hash = ''; b.hash = ''
  return a.href === b.href
}

/** Detection and repair share exact document and fragment scope. Removed links
 * cannot produce an assertion for the originally failed target. */
export function sectionLinkObservations(pageUrl: string, metadata: PageMetadata, scope?: CaptureObservationScope) {
  const links = new Map<string, { fragment: string; text: string; count: number }>()
  for (const link of metadata.links) {
    try {
      const destination = new URL(link.href, metadata.linkBaseUrl ?? pageUrl)
      if (!destination.hash || !sameDocument(destination, new URL(pageUrl))) continue
      const fragment = destination.hash.slice(1)
      const prior = links.get(fragment)
      links.set(fragment, { fragment, text: prior?.text || link.text, count: (prior?.count ?? 0) + 1 })
    } catch { /* Invalid navigation does not establish a missing section. */ }
  }
  const pageScope = scope ? captureObservationKey(scope) : 'unknown'
  const comparable = pageScope !== 'unknown' && metadata.anchorNames !== undefined
  const targets = sectionTargetSet(metadata)
  const assertions: CheckAssertion[] = []
  const missing: Array<{ text: string; fragment: string; context: string; count: number }> = []
  for (const { fragment, text, count } of [...links.values()].slice(0, MAX_SECTION_TARGETS)) {
    const inspectable = !fragment.startsWith('/') && !fragment.startsWith('!') && !fragment.includes(':~:')
    const passed = inspectable && sectionTargetExists(metadata, fragment, targets)
    const context = 'section:' + pageScope + ':' + createHash('sha256').update(fragment).digest('hex')
    assertions.push({ key: 'section-target', name: 'Section link target', expected: 'The linked section exists in the same captured document',
      observed: inspectable ? `${text ? 'Linked section' : 'Section'} target ${passed ? 'exists' : 'is absent'} in the captured document. Click and scroll behavior was not tested.`
        : 'This fragment uses routing or text navigation whose behavior was not inspected.',
      passed, complete: comparable && inspectable, context })
    if (inspectable && !passed) missing.push({ text, fragment, context, count })
  }
  const missingCount = missing.reduce((count, link) => count + link.count, 0)
  const flags: DeterministicFlag[] = missing.length ? [{
    checkId: 'broken-page-anchors', rubric: 'EXPERIENCE', impactTag: 'CONVERSION', severity: 'IMPORTANT',
    problem: `${missingCount} on-page link${missingCount > 1 ? 's' : ''} point to missing sections`,
    evidence: missing.slice(0, 3).map(link => `${link.text.slice(0, 160) || '(no text)'} → #${link.fragment.slice(0, 240)}: declared target is absent`).join('; '),
    fix: '1. Add matching id attributes for each hash link target (#section-name)\n2. Update nav or footer links to point to existing section ids\n3. Test each anchor link by clicking and verifying it scrolls correctly',
    confidence: 1, source: 'DETERMINISTIC',
    ...(comparable ? { verificationRule: SECTION_LINK_VERIFICATION_RULE,
      evidenceTargets: missing.map(link => ({ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: 'Section link', context: link.context })) } : {}),
  }] : []
  return { flags, assertions, complete: comparable && links.size <= MAX_SECTION_TARGETS && assertions.every(assertion => assertion.complete === true), limitation: SECTION_LINK_LIMITATION }
}
