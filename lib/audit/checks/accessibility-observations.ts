import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import { filterToolingPathFlags } from '../tooling-path-filter'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import type { AccessibilityEvidence, MobileAccessibilityCapture } from '../browser/accessibility-evidence'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import { AXE_POLICY_CHECK_IDS, ACCESSIBILITY_DOM_CHECK_IDS, ACCESSIBILITY_VERIFICATION_RULE, MOBILE_ACCESSIBILITY_RULE_IDS, axeRuleToCheckId, HTML_CONTROL_NAMES_VERSION,
  HTML_CONTROL_NAMES_CONTEXT, HTML_CONTROL_NAME_CHECK_IDS, AXE_DOCUMENT_SCOPE_CONTEXT, AXE_EMBEDDED_SCOPE_CONTEXT, axeTargetSelector, isIframeAxeTarget,
  currentAccessibilityObservation } from './accessibility-rules'
import { filterOutIframeAxeViolations, runAccessibilityChecks, type AxeViolation } from './accessibility'

function context(kind: 'axe' | 'dom', scope: CaptureObservationScope, checkId: string, engine = '', rules: string[] = [], device = 'desktop', documentScope?: string) {
  return 'accessibility:' + kind + ':' + device + ':' + captureObservationKey(scope) + ':' + checkId + ':' + engine + ':' + rules.sort().join(',') +
    (kind === 'axe' && documentScope === AXE_DOCUMENT_SCOPE_CONTEXT ? ':' + documentScope : '')
}

export function accessibilityObservations(input: { metadata: PageMetadata | null; evidence?: AccessibilityEvidence; scope?: CaptureObservationScope; device?: 'desktop' | 'mobile' }): CheckAssertion[] {
  const { evidence, scope, metadata } = input
  const result: CheckAssertion[] = []
  const known = evidence && captureObservationKey(evidence.scope) !== 'unknown'
  for (const checkId of AXE_POLICY_CHECK_IDS) {
    const rules = evidence?.rules.filter(rule => axeRuleToCheckId(rule.id) === checkId) ?? []
    if (!rules.length) continue
    const failed = rules.some(rule => rule.state === 'failed')
    const complete = Boolean(known && (failed || evidence.documentScope === AXE_DOCUMENT_SCOPE_CONTEXT && rules.every(rule => rule.state !== 'incomplete')))
    const assertion = { key: 'axe:' + checkId, name: 'Automated accessibility: ' + checkId,
      expected: 'No failed or unresolved results for the recorded automated rule responsibility',
      observed: rules.map(rule => `${rule.id}: ${rule.state}, ${rule.nodes} inspected nodes`).join('; ').slice(0, 2000),
      passed: complete && !failed, complete, context: context('axe', evidence!.scope, checkId, evidence!.engine, rules.map(rule => rule.id), input.device, evidence!.documentScope) }
    result.push(assertion)
    const embedded = evidence?.embeddedScopes?.[checkId]
    if (embedded && evidence.documentScope === AXE_DOCUMENT_SCOPE_CONTEXT) {
      result.push({ ...assertion, context: assertion.context + AXE_EMBEDDED_SCOPE_CONTEXT + embedded })
    }
  }
  const counts: Record<typeof ACCESSIBILITY_DOM_CHECK_IDS[number], number | undefined> = {
    'images-missing-alt': metadata?.imagesWithoutAlt, 'form-inputs-no-label': metadata?.inputsWithoutLabel,
    'buttons-no-text': metadata?.buttonsWithoutText, 'links-no-text': metadata?.linksWithoutText,
    'iframe-no-title': metadata?.iframesWithoutTitle, 'tabindex-positive': metadata?.positiveTabindex,
    'skip-link-missing': metadata ? metadata.hasSkipLink ? 0 : 1 : undefined,
  }
  for (const checkId of ACCESSIBILITY_DOM_CHECK_IDS) {
    const applicable = checkId !== 'skip-link-missing' || Boolean(metadata && (metadata.navLandmarkCount > 0 || metadata.hasSkipLink))
    const observed = Boolean(metadata && applicable && scope && captureObservationKey(scope) !== 'unknown')
    const sameRenderedScope = scope && evidence && captureObservationKey(scope) === captureObservationKey(evidence.scope)
    const axeFailure = sameRenderedScope && evidence.rules.some(rule => axeRuleToCheckId(rule.id) === checkId && rule.state === 'failed')
    const nameCheck = HTML_CONTROL_NAME_CHECK_IDS.some(id => id === checkId)
    const currentNames = metadata?.controlNamesVersion === HTML_CONTROL_NAMES_VERSION
    const complete = observed && (!nameCheck || currentNames || (counts[checkId] ?? 0) > 0 || Boolean(axeFailure))
    result.push({ key: 'dom:' + checkId, name: 'Captured HTML: ' + checkId,
      expected: checkId === 'skip-link-missing' ? 'A skip-link signal is present without a measured failure of the same responsibility'
        : 'No captured HTML elements or automated rules on the same rendered page fail the reported condition',
      observed: !metadata ? 'Captured HTML signals are unavailable. Native rule evidence is evaluated separately.' : applicable ? `${counts[checkId]} failed captured HTML conditions. ${axeFailure ? 'The rendered automated rule also reports a failure.' : 'Manual accessibility was not evaluated.'}`
        : 'No navigation landmark or skip-link signal was captured; skip-link applicability changed.',
      passed: complete && counts[checkId] === 0 && !axeFailure, complete,
      ...(metadata && !applicable ? { disposition: 'observed' as const } : {}),
      ...(scope ? { context: context('dom', scope, checkId) + (nameCheck && currentNames ? HTML_CONTROL_NAMES_CONTEXT : '') } : {}) })
  }
  const unresolved = evidence?.rules.filter(rule => rule.state === 'incomplete').length ?? 0
  const failed = evidence?.rules.filter(rule => rule.state === 'failed').length ?? 0
  const complete = Boolean(known && evidence.documentScope === AXE_DOCUMENT_SCOPE_CONTEXT && evidence.rules.length > 0 && !unresolved)
  result.push({ key: 'automated-accessibility', name: 'Automated accessibility inspection',
    expected: 'No failed or unresolved automated rules in the inspected rendered page scope',
    observed: evidence ? `${failed} failed and ${unresolved} unresolved automated rules recorded; manual accessibility was not evaluated.` : 'Full automated rule outcomes are unavailable; manual accessibility was not evaluated.',
    passed: complete && !failed, complete })
  return result.map(assertion => currentAccessibilityObservation(assertion, result) ? assertion : {
    ...assertion, passed: false, complete: false,
    observed: 'The HTML count is available, but native evidence for the same captured responsibility remains unresolved.',
  })
}

export function scopeAccessibilityFlags(flags: DeterministicFlag[], observations: CheckAssertion[], axe?: AxeViolation[], device: 'desktop' | 'mobile' = 'desktop', ownedDocuments = false): DeterministicFlag[] {
  const violations = ownedDocuments ? axe ?? [] : filterOutIframeAxeViolations(axe ?? [])
  return flags.map(flag => {
    // Axe findings retain their existing human copy. Fallback findings use the
    // exact captured-HTML predicate instead of borrowing a different rule's pass.
    const matched = violations.filter(violation => axeRuleToCheckId(violation.id) === flag.checkId)
    const fromAxe = matched.length > 0
    const key = (fromAxe ? 'axe:' : 'dom:') + flag.checkId
    const targetContext = observations.find(item => item.key === key && item.context)?.context
    if (!targetContext) return flag
    // Scope the whole responsibility before limiting the displayed node sample.
    const nodes = matched.flatMap(violation => violation.nodes)
    const embeddedPrefix = targetContext + AXE_EMBEDDED_SCOPE_CONTEXT
    const scopedContext = nodes.some(node => isIframeAxeTarget(node.target))
      ? observations.find(item => item.key === key && item.context?.startsWith(embeddedPrefix))?.context ?? embeddedPrefix + 'unavailable'
      : targetContext
    return { ...flag, verificationRule: ACCESSIBILITY_VERIFICATION_RULE,
      evidenceTargets: fromAxe ? nodes.slice(0, 20).map(node => ({ kind: 'element' as const, source: 'measured' as const, device, selector: axeTargetSelector(node.target), label: node.html.replace(/\s+/g, ' ').slice(0, 160), context: scopedContext }))
        : [{ kind: 'page', source: 'measured', device, label: flag.checkId, context: targetContext }] }
  })
}

/** Both execution adapters use the same native and HTML evidence policies. */
export function evaluateAccessibility(input: { metadata: PageMetadata | null; evidence?: AccessibilityEvidence;
  scope?: CaptureObservationScope; axe?: AxeViolation[]; pagespeed?: PageSpeedResult | null; mobileAccessibility?: MobileAccessibilityCapture }) {
  const assertions = accessibilityObservations(input)
  const ownedDocuments = input.evidence?.documentScope === AXE_DOCUMENT_SCOPE_CONTEXT
  const flags = scopeAccessibilityFlags(runAccessibilityChecks(input.metadata, input.pagespeed ?? null, input.axe, ownedDocuments), assertions, input.axe, 'desktop', ownedDocuments)
  if (input.mobileAccessibility) {
    const mobile = input.mobileAccessibility
    const checkIds = new Set<string>(MOBILE_ACCESSIBILITY_RULE_IDS.map(axeRuleToCheckId))
    const observed = accessibilityObservations({ metadata: null, evidence: mobile.evidence, device: 'mobile' })
      .filter(assertion => checkIds.has(assertion.key.replace(/^axe:/, '')))
    for (const checkId of checkIds) if (!observed.some(assertion => assertion.key === 'axe:' + checkId)) observed.push({
      key: 'axe:' + checkId, name: 'Mobile automated accessibility: ' + checkId,
      expected: 'The admitted mobile rule completes without failures or unresolved results',
      observed: 'No valid mobile rule observation is available.', passed: false, complete: false,
    })
    const violations = mobile.violations?.filter(violation => (MOBILE_ACCESSIBILITY_RULE_IDS as readonly string[]).includes(violation.id))
    const mobileOwned = mobile.evidence?.documentScope === AXE_DOCUMENT_SCOPE_CONTEXT
    flags.push(...scopeAccessibilityFlags(runAccessibilityChecks(null, null, violations, mobileOwned), observed, violations, 'mobile', mobileOwned))
    assertions.push(...observed)
  }
  return {
    flags: filterToolingPathFlags(flags),
    assertions,
    applicable: input.axe !== undefined || Boolean(input.evidence || input.pagespeed || input.mobileAccessibility),
    complete: assertions.find(assertion => assertion.key === 'automated-accessibility')?.complete === true &&
      assertions.every(assertion => assertion.complete !== false || assertion.disposition === 'observed'),
    limitation: 'Automated desktop rules, mobile target-size rules and captured HTML signals retain their own scopes. Unavailable HTML does not discard native rule evidence. Unresolved rules require further review; manual accessibility was not evaluated.',
  }
}
