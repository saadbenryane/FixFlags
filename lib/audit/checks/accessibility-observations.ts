import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import { filterToolingPathFlags } from '../tooling-path-filter'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import type { AccessibilityEvidence } from '../browser/accessibility-evidence'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import { AXE_POLICY_CHECK_IDS, ACCESSIBILITY_DOM_CHECK_IDS, ACCESSIBILITY_VERIFICATION_RULE, axeRuleToCheckId } from './accessibility-rules'
import { filterOutIframeAxeViolations, runAccessibilityChecks, type AxeViolation } from './accessibility'

function context(kind: 'axe' | 'dom', scope: CaptureObservationScope, checkId: string, engine = '', rules: string[] = []) {
  return 'accessibility:' + kind + ':desktop:' + captureObservationKey(scope) + ':' + checkId + ':' + engine + ':' + rules.sort().join(',')
}

export function accessibilityObservations(input: { metadata: PageMetadata | null; evidence?: AccessibilityEvidence; scope?: CaptureObservationScope }): CheckAssertion[] {
  const { evidence, scope, metadata } = input
  const result: CheckAssertion[] = []
  const known = evidence && captureObservationKey(evidence.scope) !== 'unknown'
  for (const checkId of AXE_POLICY_CHECK_IDS) {
    const rules = evidence?.rules.filter(rule => axeRuleToCheckId(rule.id) === checkId) ?? []
    if (!rules.length) continue
    const failed = rules.some(rule => rule.state === 'failed')
    const complete = Boolean(known && (failed || rules.every(rule => rule.state !== 'incomplete')))
    result.push({ key: 'axe:' + checkId, name: 'Automated accessibility: ' + checkId,
      expected: 'No failed or unresolved results for the recorded automated rule responsibility',
      observed: rules.map(rule => `${rule.id}: ${rule.state}, ${rule.nodes} inspected nodes`).join('; ').slice(0, 2000),
      passed: complete && !failed, complete, context: context('axe', evidence!.scope, checkId, evidence!.engine, rules.map(rule => rule.id)) })
  }
  const counts: Record<typeof ACCESSIBILITY_DOM_CHECK_IDS[number], number | undefined> = {
    'images-missing-alt': metadata?.imagesWithoutAlt, 'form-inputs-no-label': metadata?.inputsWithoutLabel,
    'buttons-no-text': metadata?.buttonsWithoutText, 'links-no-text': metadata?.linksWithoutText,
    'iframe-no-title': metadata?.iframesWithoutTitle, 'tabindex-positive': metadata?.positiveTabindex,
    'skip-link-missing': metadata ? metadata.hasSkipLink ? 0 : 1 : undefined,
  }
  for (const checkId of ACCESSIBILITY_DOM_CHECK_IDS) {
    const applicable = checkId !== 'skip-link-missing' || Boolean(metadata && (metadata.navLandmarkCount > 0 || metadata.hasSkipLink))
    const complete = Boolean(metadata && applicable && scope && captureObservationKey(scope) !== 'unknown')
    const sameRenderedScope = scope && evidence && captureObservationKey(scope) === captureObservationKey(evidence.scope)
    const axeFailure = sameRenderedScope && evidence.rules.some(rule => axeRuleToCheckId(rule.id) === checkId && rule.state === 'failed')
    result.push({ key: 'dom:' + checkId, name: 'Captured HTML: ' + checkId,
      expected: checkId === 'skip-link-missing' ? 'A skip-link signal is present without a measured failure of the same responsibility'
        : 'No captured HTML elements or automated rules on the same rendered page fail the reported condition',
      observed: !metadata ? 'Captured HTML signals are unavailable. Native rule evidence is evaluated separately.' : applicable ? `${counts[checkId]} failed captured HTML conditions. ${axeFailure ? 'The rendered automated rule also reports a failure.' : 'Manual accessibility was not evaluated.'}`
        : 'No navigation landmark or skip-link signal was captured; skip-link applicability changed.',
      passed: complete && counts[checkId] === 0 && !axeFailure, complete,
      ...(metadata && !applicable ? { disposition: 'observed' as const } : {}),
      ...(scope ? { context: context('dom', scope, checkId) } : {}) })
  }
  const unresolved = evidence?.rules.filter(rule => rule.state === 'incomplete').length ?? 0
  const failed = evidence?.rules.filter(rule => rule.state === 'failed').length ?? 0
  const complete = Boolean(known && evidence.rules.length > 0 && !unresolved)
  result.push({ key: 'automated-accessibility', name: 'Automated accessibility inspection',
    expected: 'No failed or unresolved automated rules in the inspected rendered page scope',
    observed: evidence ? `${failed} failed and ${unresolved} unresolved automated rules recorded; manual accessibility was not evaluated.` : 'Full automated rule outcomes are unavailable; manual accessibility was not evaluated.',
    passed: complete && !failed, complete })
  return result
}

export function scopeAccessibilityFlags(flags: DeterministicFlag[], observations: CheckAssertion[], axe?: AxeViolation[]): DeterministicFlag[] {
  const violations = filterOutIframeAxeViolations(axe ?? [])
  return flags.map(flag => {
    // Axe findings retain their existing human copy. Fallback findings use the
    // exact captured-HTML predicate instead of borrowing a different rule's pass.
    const fromAxe = violations.some(violation => axeRuleToCheckId(violation.id) === flag.checkId)
    const assertion = observations.find(item => item.key === (fromAxe ? 'axe:' : 'dom:') + flag.checkId && item.context)
    return assertion ? { ...flag, verificationRule: ACCESSIBILITY_VERIFICATION_RULE,
      evidenceTargets: fromAxe ? violations.filter(violation => axeRuleToCheckId(violation.id) === flag.checkId).flatMap(violation => violation.nodes).slice(0, 20).map(node => ({ kind: 'element' as const, source: 'measured' as const, device: 'desktop' as const, selector: node.target.join(' > '), label: node.html.replace(/\s+/g, ' ').slice(0, 160), context: assertion.context }))
        : [{ kind: 'page', source: 'measured', device: 'desktop', label: flag.checkId, context: assertion.context }] } : flag
  })
}

/** Both execution adapters use the same native and HTML evidence policies. */
export function evaluateAccessibility(input: { metadata: PageMetadata | null; evidence?: AccessibilityEvidence;
  scope?: CaptureObservationScope; axe?: AxeViolation[]; pagespeed?: PageSpeedResult | null }) {
  const assertions = accessibilityObservations(input)
  return {
    flags: filterToolingPathFlags(scopeAccessibilityFlags(runAccessibilityChecks(input.metadata, input.pagespeed ?? null, input.axe), assertions, input.axe)),
    assertions,
    applicable: input.axe !== undefined || Boolean(input.evidence || input.pagespeed),
    complete: assertions.find(assertion => assertion.key === 'automated-accessibility')?.complete === true &&
      assertions.every(assertion => assertion.complete !== false || assertion.disposition === 'observed'),
    limitation: 'Automated desktop rule outcomes and captured HTML signals are recorded separately. Unavailable HTML does not discard native rule evidence. Unresolved rules require further review; manual accessibility was not evaluated.',
  }
}
