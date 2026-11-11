import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import type { AxeResults } from 'axe-core'
import { recordedAxeViolations, summarizeAccessibility, type AccessibilityEvidence } from '../browser/accessibility-evidence'
import { accessibilityObservations, evaluateAccessibility, scopeAccessibilityFlags } from './accessibility-observations'
import { isIframeAxeTarget, runAccessibilityChecks, type AxeViolation } from './accessibility'
import { verificationRuleForCheckId } from '../verification-rules'
import { parseMetadataFromHtml } from '../metadata'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema, readCheckReceipt } from './receipt'
import { CHECK_REGISTRY } from '../check-registry'
import { ACCESSIBILITY_TAGS, ACCESSIBILITY_ADDITIONAL_RULE_IDS, AXE_POLICY_RULE_IDS, axeRuleToCheckId, ACCESSIBILITY_VERIFICATION_RULE, HTML_CONTROL_NAMES_CONTEXT, HTML_CONTROL_NAME_CHECK_IDS } from './accessibility-rules'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { collapseRecordedFixtureFlags as collapseFlagsWithAffectedPaths } from '@/lib/audit/__tests__/recorded-flag-fixtures'
import { runAllChecks } from './index'
import { screenshotSnapshotSchema } from '../progressive/snapshots'

const pageUrl = 'https://example.com/'
const scope = { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' }
const metadata = parseMetadataFromHtml('<html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1><button aria-label="Submit"></button></main></body></html>', pageUrl)
const violation: AxeViolation = { id: 'button-name', impact: 'serious', description: 'Name required', help: 'Name required', helpUrl: 'https://example.com/rule',
  nodes: [{ target: ['#submit'], html: '<button id="submit"></button>', failureSummary: 'Add an accessible name' }] }
function evidence(state: 'passed' | 'failed' | 'incomplete' | 'inapplicable', overrides: Partial<AccessibilityEvidence> = {}): AccessibilityEvidence {
  return { scope, documentScope: 'same-origin-v2', engine: 'fixture-engine', rules: [{ id: 'button-name', state, nodes: state === 'inapplicable' ? 0 : 1 }], ...overrides }
}
function receipt(value: AccessibilityEvidence, taskId = 'task') {
  const assertions = accessibilityObservations({ metadata, evidence: value, scope: value.scope })
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'accessibility', pageUrl: value.scope.pageUrl,
    applicable: true, passed: false, complete: false, assertions,
    execution: { auditId: 'after', taskId, checkVersion: 1, source: 'browser-accessibility', collectedAt: '2026-10-12T12:00:00.000Z' } })
}
const original = scopeAccessibilityFlags(runAccessibilityChecks(metadata, null, [violation]),
  accessibilityObservations({ metadata, evidence: evidence('failed'), scope }), [violation])[0]
const proof = (value: AccessibilityEvidence) => scopedAssertionForTarget({ receipt: receipt(value), checkId: original.checkId, flag: original })?.assertion

describe('automated accessibility responsibilities', () => {
  it('separates recorded rule and element facts from axe remediation without losing diagnostics', () => {
    const flag = runAccessibilityChecks(metadata, null, [violation])[0]
    expect(flag.evidence).toContain('button-name')
    expect(flag.evidence).toContain('#submit')
    expect(flag.evidence).toContain('<button id="submit"></button>')
    expect(flag.evidence).not.toContain(violation.nodes[0].failureSummary)
    expect(flag.evidence).not.toContain(violation.description)
    expect(flag.fix).toContain(violation.nodes[0].failureSummary)
    expect(verificationRuleForCheckId('buttons-no-text')).toContain('aria-labelledby')
    expect(flag.fix).toContain('aria-labelledby')
  })
  it('keeps all failed rules and the highest severity when one Flag covers several rules', () => {
    const shared = { ...violation.nodes[0], target: ['#frame', '#shared'] }
    const first = { ...violation, id: 'frame-title', impact: 'moderate' as const, help: 'Name each frame',
      nodes: [{ ...shared, failureSummary: 'Give the shared frame a title' }] }
    const second = { ...violation, id: 'frame-title-unique', impact: 'critical' as const, help: 'Use distinct frame names',
      nodes: [{ ...shared, failureSummary: 'Distinguish the shared frame' },
        { ...shared, target: ['#other'], failureSummary: 'Distinguish the other frame' }] }
    const flags = runAccessibilityChecks(null, null, [first, second], true)
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ checkId: 'iframe-no-title', severity: 'CRITICAL',
      problem: 'Use distinct frame names and related failures (2 elements)' })
    expect(flags[0].evidence).toContain('Affected elements: 2')
    expect(flags[0].evidence).toContain('Rule: frame-title\n#frame ::frame #shared')
    expect(flags[0].evidence).toContain('Rule: frame-title-unique')
    expect(flags[0].evidence).toContain('#other')
    expect(flags[0].fix).toContain('Give the shared frame a title')
    expect(flags[0].fix).toContain('Distinguish the other frame')
    expect(runAccessibilityChecks(null, null, [second, first], true)).toEqual(flags)
  })
  it('keeps a mobile-only native observation applicable without inventing desktop coverage', async () => {
    for (const state of ['failed', 'passed', 'incomplete'] as const) {
      const checked = await runAllChecks(pageUrl, null, null, null, [], undefined, null, undefined, undefined, true, ['accessibility'], {
        mobileAccessibility: { evidence: evidence(state, { scope: { ...scope, profile: 'mobile' },
          rules: [{ id: 'target-size', state, nodes: 2 }] }), violations: state === 'failed' ? [{ ...violation, id: 'target-size' }] : [] },
      })
      expect(checked.executions[0]).toMatchObject({ applicable: true, complete: false })
      expect(checked.flags.some(flag => flag.checkId === 'axe-target-size')).toBe(state === 'failed')
      expect(checked.executions[0].assertions?.find(assertion => assertion.key === 'axe:axe-target-size'))
        .toMatchObject({ passed: state === 'passed', complete: state !== 'incomplete' })
      expect(checked.executions[0].assertions?.find(assertion => assertion.key === 'automated-accessibility'))
        .toMatchObject({ passed: false, complete: false })
    }
  })
  it('keeps mobile target failures and repairs scoped to the measured mobile viewport', () => {
    const mobileScope = { ...scope, profile: 'mobile' }
    const mobileEvidence = (state: 'passed' | 'failed' | 'incomplete', profile = 'mobile') => evidence(state, {
      scope: { ...mobileScope, profile }, rules: [{ id: 'target-size', state, nodes: 2 }],
    })
    const mobileViolation = { ...violation, id: 'target-size' }
    const before = evaluateAccessibility({ metadata, scope, evidence: evidence('passed'),
      mobileAccessibility: { evidence: mobileEvidence('failed'), violations: [mobileViolation] } })
    const flag = before.flags.find(item => item.checkId === 'axe-target-size')!
    expect(flag.evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ device: 'mobile',
      context: expect.stringContaining('accessibility:axe:mobile:') })]))
    const inspect = (mobileAccessibility?: Parameters<typeof evaluateAccessibility>[0]['mobileAccessibility']) => {
      const after = evaluateAccessibility({ metadata, scope, evidence: evidence('passed', {
        rules: [{ id: 'target-size', state: 'passed', nodes: 2 }],
      }), mobileAccessibility })
      return scopedAssertionForTarget({ receipt: { ...receipt(evidence('passed')), assertions: after.assertions }, checkId: flag.checkId, flag })?.assertion
    }
    expect(inspect()).toBeUndefined()
    expect(inspect({})).toBeUndefined()
    expect(inspect({ evidence: mobileEvidence('incomplete') })).toBeUndefined()
    expect(inspect({ evidence: mobileEvidence('passed', 'changed-mobile') })).toBeUndefined()
    expect(inspect({ evidence: mobileEvidence('failed') })).toMatchObject({ passed: false, complete: true })
    expect(inspect({ evidence: mobileEvidence('passed') })).toMatchObject({ passed: true, complete: true })
    expect(screenshotSnapshotSchema.shape.mobileAccessibility.parse({ evidence: mobileEvidence('failed'), violations: [mobileViolation] }))
      .toEqual({ evidence: mobileEvidence('failed'), violations: [mobileViolation] })
  })
  it('keeps the portable execution inventory aligned with the installed WCAG policy and registers every emitted rule identity', () => {
    expect(axe.getRules(ACCESSIBILITY_TAGS).map(rule => rule.ruleId).sort()).toEqual([...AXE_POLICY_RULE_IDS])
    const installed = new Set(axe.getRules().map(rule => rule.ruleId))
    for (const ruleId of [...AXE_POLICY_RULE_IDS, ...ACCESSIBILITY_ADDITIONAL_RULE_IDS]) {
      expect(installed.has(ruleId), ruleId).toBe(true)
      expect(CHECK_REGISTRY[axeRuleToCheckId(ruleId)]).toMatchObject({ module: 'accessibility', area: 'accessibility' })
    }
  })
  it('retains unresolved outcomes when a rule also has passing nodes, and separates frame limits', () => {
    expect(isIframeAxeTarget(['iframe'])).toBe(false)
    expect(isIframeAxeTarget(['#frame-button'])).toBe(false)
    expect(isIframeAxeTarget(['iframe', '#inside'])).toBe(true)
    const raw = { testEngine: { version: 'fixture-engine' }, violations: [],
      passes: [{ id: 'button-name', nodes: [{ target: ['#submit'] }] }],
      incomplete: [{ id: 'button-name', nodes: [{ target: ['#other'] }] }, { id: 'color-contrast', nodes: [{ target: ['iframe', '#inside'] }] }],
      inapplicable: [{ id: 'image-alt', nodes: [] }] } as unknown as AxeResults
    expect(summarizeAccessibility(raw, scope).rules).toEqual([
      { id: 'button-name', state: 'incomplete', nodes: 2 }, { id: 'color-contrast', state: 'incomplete', nodes: 1 },
      { id: 'image-alt', state: 'inapplicable', nodes: 0 },
    ])
  })
  it('keeps legacy positive axe scope unverified while preserving observed failures', () => {
    expect(proof(evidence('passed', { documentScope: undefined }))).toBeUndefined()
    expect(receipt(evidence('failed', { documentScope: undefined })).assertions.some(item => !item.passed && item.complete)).toBe(true)
  })
  it('verifies the actual recorded rule and keeps unresolved or omitted results inconclusive', () => {
    expect(proof(evidence('failed'))).toMatchObject({ passed: false, complete: true })
    expect(proof(evidence('passed'))).toMatchObject({ passed: true, complete: true })
    expect(proof(evidence('inapplicable'))?.passed).toBe(true)
    expect(proof(evidence('incomplete'))).toBeUndefined()
    expect(proof(evidence('passed', { rules: [{ id: 'image-alt', state: 'passed', nodes: 1 }] }))).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(evidence('passed')), checkId: original.checkId, flag: { ...original, evidenceTargets: undefined } })).toBeUndefined()
  })
  it('requires matching embedded rule coverage even when the affected node is beyond the displayed sample', () => {
    const child = { ...violation.nodes[0], target: ['#frame', '#embedded-submit'] }
    const source = { ...violation, nodes: [
      ...Array.from({ length: 20 }, (_, index) => ({ ...violation.nodes[0], target: [`#submit-${index}`] })), child,
    ] }
    const embeddedScopes = { 'buttons-no-text': 'a'.repeat(64) }
    const before = evaluateAccessibility({ metadata, scope, evidence: evidence('failed', { embeddedScopes }), axe: [source] })
    const flag = before.flags.find(item => item.checkId === 'buttons-no-text')!
    expect(flag.evidenceTargets).toHaveLength(20)
    expect(flag.evidenceTargets?.every(target => target.context?.endsWith(embeddedScopes['buttons-no-text']))).toBe(true)
    const inspect = (value: AccessibilityEvidence, previous = flag) =>
      scopedAssertionForTarget({ receipt: receipt(value), checkId: previous.checkId, flag: previous })?.assertion
    expect(inspect(evidence('passed'))).toBeUndefined()
    expect(inspect(evidence('passed', { embeddedScopes: { 'buttons-no-text': 'b'.repeat(64) } }))).toBeUndefined()
    expect(inspect(evidence('incomplete', { embeddedScopes }))).toBeUndefined()
    expect(inspect(evidence('failed', { embeddedScopes }))).toMatchObject({ passed: false, complete: true })
    expect(inspect(evidence('passed', { embeddedScopes }))).toMatchObject({ passed: true, complete: true })
    const historical = { ...original, evidenceTargets: [{ ...original.evidenceTargets![0], selector: '#frame ::frame #embedded-submit' }] }
    expect(inspect(evidence('passed', { embeddedScopes }), historical)).toBeUndefined()
    expect(proof(evidence('passed', { embeddedScopes }))).toMatchObject({ passed: true, complete: true })
  })
  it('persists real failure details while excluding transient engine internals that cannot enter a JSON snapshot', () => {
    const raw = { violations: [{ ...violation, nodes: [{ ...violation.nodes[0], any: [{ data: { colorParse: undefined } }] }] }] } as unknown as AxeResults
    const recorded = recordedAxeViolations(raw)
    expect(recorded).toEqual([violation])
    expect(screenshotSnapshotSchema.shape.axeViolations.parse(recorded)).toEqual([violation])
  })
  it('does not borrow success from another member of a grouped responsibility', () => {
    const image = { ...violation, id: 'image-alt' }
    const before = evidence('failed', { rules: [{ id: 'image-alt', state: 'failed', nodes: 1 }, { id: 'input-image-alt', state: 'inapplicable', nodes: 0 }] })
    const flag = scopeAccessibilityFlags(runAccessibilityChecks(metadata, null, [image]), accessibilityObservations({ metadata, evidence: before, scope }), [image])[0]
    const inspect = (rules: AccessibilityEvidence['rules']) => scopedAssertionForTarget({ receipt: receipt(evidence('passed', { rules })), checkId: flag.checkId, flag })?.assertion
    expect(inspect([{ id: 'image-alt', state: 'passed', nodes: 1 }])).toBeUndefined()
    expect(inspect([{ id: 'image-alt', state: 'passed', nodes: 1 }, { id: 'input-image-alt', state: 'incomplete', nodes: 1 }])).toBeUndefined()
    expect(inspect([{ id: 'image-alt', state: 'passed', nodes: 1 }, { id: 'input-image-alt', state: 'failed', nodes: 1 }])?.passed).toBe(false)
  })
  it.each([
    ['a different engine', evidence('passed', { engine: 'different-engine' })],
    ['a different final route', evidence('passed', { scope: { ...scope, finalUrl: pageUrl + '#different-route' } })],
    ['a different page URL', evidence('passed', { scope: { ...scope, pageUrl: pageUrl + 'other' } })],
    ['a different capture profile', evidence('passed', { scope: { ...scope, profile: 'different-profile' } })],
    ['different credentialed access', evidence('passed', { scope: { ...scope, access: 'credentialed:different' } })],
    ['unknown credentialed access', evidence('passed', { scope: { ...scope, access: 'credentialed:unknown' } })],
  ])('keeps a capture with %s inconclusive', (_condition, value) => { expect(proof(value)).toBeUndefined() })
  it('credits an independent rule repair despite unrelated failed or unresolved rules', () => {
    const mixed = evidence('passed', { rules: [{ id: 'button-name', state: 'passed', nodes: 1 }, { id: 'color-contrast', state: 'incomplete', nodes: 1 },
      { id: 'aria-required-parent', state: 'failed', nodes: 1 }] })
    expect(proof(mixed)?.passed).toBe(true)
    expect(receipt(mixed).assertions.find(item => item.key === 'automated-accessibility')).toMatchObject({ passed: false, complete: false })
  })
  it('requires every affected page and shares positive proof with automatic recovery', () => {
    const otherScope = { ...scope, pageUrl: pageUrl + 'other', finalUrl: pageUrl + 'other' }
    const other = evidence('failed', { scope: otherScope })
    const otherFlag = scopeAccessibilityFlags(runAccessibilityChecks(metadata, null, [violation]), accessibilityObservations({ metadata, evidence: other, scope: otherScope }), [violation])[0]
    const flag = collapseFlagsWithAffectedPaths([{ ...original, pageUrl }, { ...otherFlag, pageUrl: otherScope.pageUrl }])[0]
    const executions = [{ targetKey: 'module:accessibility', status: 'COMPLETED', detail: receipt(evidence('passed')) }]
    const input = { auditId: 'after', flag, executions, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', outcomes: [], verificationTarget: null, checks: { [flag.checkId]: 1 } } }
    expect(hasRecordedRecoveryEvidence(input)).toBe(false)
    executions.push({ ...executions[0], detail: receipt({ ...other, rules: evidence('passed').rules }, 'other-task') })
    expect(hasRecordedRecoveryEvidence(input)).toBe(true)
  })
  it('retains HTML fallback failures and proves their exact predicate without manufacturing an axe pass', async () => {
    const broken = parseMetadataFromHtml('<button id="submit"></button>', pageUrl)
    const checked = await runAllChecks(pageUrl, broken, null, null, [], undefined, undefined, undefined, undefined, true, ['accessibility'], { renderedScope: scope })
    const flag = checked.flags.find(flag => flag.checkId === 'buttons-no-text')!
    expect(flag).toMatchObject({ severity: 'POLISH', evidenceTargets: expect.any(Array) })
    expect(checked.executions[0]).toMatchObject({ complete: false, passed: false })
    const assertions = accessibilityObservations({ metadata, scope })
    const after = { ...receipt(evidence('passed')), assertions }
    expect(scopedAssertionForTarget({ receipt: after, checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    expect(assertions.find(item => item.key === 'automated-accessibility')).toMatchObject({ passed: false, complete: false })
  })
  it('withholds HTML recovery when native evidence for the same responsibility is unresolved on the same capture', () => {
    const broken = parseMetadataFromHtml('<button id="submit"></button>', pageUrl)
    const key = 'dom:buttons-no-text'
    const flag = scopeAccessibilityFlags(runAccessibilityChecks(broken, null), accessibilityObservations({ metadata: broken, scope }))
      .find(item => item.checkId === 'buttons-no-text')!
    const current = receipt(evidence('incomplete'))
    expect(current.assertions.find(item => item.key === key)).toMatchObject({ passed: false, complete: false })
    expect(scopedAssertionForTarget({ receipt: current, checkId: flag.checkId, flag })).toBeUndefined()

    const earlierPositive = accessibilityObservations({ metadata, scope }).find(item => item.key === key)!
    const retained = { ...current, assertions: current.assertions.map(item => item.key === key ? earlierPositive : item) }
    expect(readCheckReceipt(retained).assertions.find(item => item.key === key)).toMatchObject({ complete: false })
    expect(scopedAssertionForTarget({ receipt: retained, checkId: flag.checkId, flag })).toBeUndefined()

    const independent = receipt(evidence('incomplete', { rules: [{ id: 'color-contrast', state: 'incomplete', nodes: 1 }] }))
    expect(scopedAssertionForTarget({ receipt: independent, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true })
    const failure = accessibilityObservations({ metadata: broken, scope, evidence: evidence('incomplete') }).find(item => item.key === key)
    expect(failure).toMatchObject({ passed: false, complete: true })
  })
  it('does not turn removed navigation into a positive skip-link repair', () => {
    const broken = parseMetadataFromHtml('<nav>Navigation</nav><main>Content</main>', pageUrl)
    const assertions = accessibilityObservations({ metadata: broken, scope })
    const flag = scopeAccessibilityFlags(runAccessibilityChecks(broken, null), assertions).find(flag => flag.checkId === 'skip-link-missing')!
    const after = { ...receipt(evidence('passed')), assertions: accessibilityObservations({ metadata, scope }) }
    expect(after.assertions.find(item => item.key === 'dom:skip-link-missing')).toMatchObject({ passed: false, complete: false, disposition: 'observed' })
    expect(scopedAssertionForTarget({ receipt: after, checkId: flag.checkId, flag })).toBeUndefined()
  })
  it.each(HTML_CONTROL_NAME_CHECK_IDS)('retains legacy %s observations without upgrading older positive counters to repair proof', checkId => {
    const oldMetadata = { ...metadata, controlNamesVersion: undefined }
    const oldObservation = accessibilityObservations({ metadata: oldMetadata, scope }).find(item => item.key === 'dom:' + checkId)!
    expect(oldObservation).toMatchObject({ passed: false, complete: false })
    const current = accessibilityObservations({ metadata, scope }).find(item => item.key === oldObservation.key)!
    expect(current).toMatchObject({ passed: true, complete: true })
    expect(current.context).toContain(HTML_CONTROL_NAMES_CONTEXT)
    const oldPositive = { ...current, context: current.context!.replace(HTML_CONTROL_NAMES_CONTEXT, '') }
    const saved = { ...receipt(evidence('passed')), passed: true, complete: true, assertions: [oldPositive] }
    const original = structuredClone(saved)
    expect(readCheckReceipt(saved)).toMatchObject({ passed: false, complete: false,
      assertions: [{ passed: true, complete: false, observed: oldPositive.observed }] })
    const flag = { verificationRule: ACCESSIBILITY_VERIFICATION_RULE, evidenceTargets: [{ context: oldPositive.context }] }
    expect(scopedAssertionForTarget({ receipt: saved, checkId, flag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: { ...saved, assertions: [current] }, checkId, flag })).toBeUndefined()
    const failed = { ...saved, passed: false, assertions: [{ ...oldPositive, passed: false }] }
    expect(readCheckReceipt(failed)).toMatchObject({ passed: false, complete: true, assertions: [{ passed: false, complete: true }] })
    expect(saved).toEqual(original)
  })

  it('does not let a later page contaminate the original captured HTML responsibility', () => {
    const other = evidence('failed', { scope: { ...scope, finalUrl: pageUrl + 'other' } })
    const assertions = accessibilityObservations({ metadata, scope, evidence: other })
    expect(assertions.find(item => item.key === 'dom:buttons-no-text')).toMatchObject({ passed: true, complete: true })
    expect(assertions.find(item => item.key === 'axe:buttons-no-text')).toMatchObject({ passed: false, complete: true })
  })
})
