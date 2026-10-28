import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import type { AxeResults } from 'axe-core'
import { recordedAxeViolations, summarizeAccessibility, type AccessibilityEvidence } from '../browser/accessibility-evidence'
import { accessibilityObservations, evaluateAccessibility, scopeAccessibilityFlags } from './accessibility-observations'
import { isIframeAxeTarget, runAccessibilityChecks, type AxeViolation } from './accessibility'
import { verificationRuleForCheckId } from '../verification-rules'
import { parseMetadataFromHtml } from '../metadata'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import { CHECK_REGISTRY } from '../check-registry'
import { ACCESSIBILITY_TAGS, ACCESSIBILITY_ADDITIONAL_RULE_IDS, AXE_POLICY_RULE_IDS, axeRuleToCheckId } from './accessibility-rules'
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
  return { scope, engine: 'fixture-engine', rules: [{ id: 'button-name', state, nodes: state === 'inapplicable' ? 0 : 1 }], ...overrides }
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
      { id: 'button-name', state: 'incomplete', nodes: 2 }, { id: 'color-contrast', state: 'inapplicable', nodes: 0 },
      { id: 'image-alt', state: 'inapplicable', nodes: 0 },
    ])
  })
  it('verifies the actual recorded rule and keeps unresolved or omitted results inconclusive', () => {
    expect(proof(evidence('failed'))).toMatchObject({ passed: false, complete: true })
    expect(proof(evidence('passed'))).toMatchObject({ passed: true, complete: true })
    expect(proof(evidence('inapplicable'))?.passed).toBe(true)
    expect(proof(evidence('incomplete'))).toBeUndefined()
    expect(proof(evidence('passed', { rules: [{ id: 'image-alt', state: 'passed', nodes: 1 }] }))).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(evidence('passed')), checkId: original.checkId, flag: { ...original, evidenceTargets: undefined } })).toBeUndefined()
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
    evidence('passed', { engine: 'different-engine' }),
    evidence('passed', { scope: { ...scope, finalUrl: pageUrl + '#different-route' } }),
    evidence('passed', { scope: { ...scope, pageUrl: pageUrl + 'other' } }),
    evidence('passed', { scope: { ...scope, profile: 'different-profile' } }),
    evidence('passed', { scope: { ...scope, access: 'credentialed:different' } }),
    evidence('passed', { scope: { ...scope, access: 'credentialed:unknown' } }),
  ])('keeps changed capture and engine conditions inconclusive', value => { expect(proof(value)).toBeUndefined() })
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
  it('does not turn removed navigation into a positive skip-link repair', () => {
    const broken = parseMetadataFromHtml('<nav>Navigation</nav><main>Content</main>', pageUrl)
    const assertions = accessibilityObservations({ metadata: broken, scope })
    const flag = scopeAccessibilityFlags(runAccessibilityChecks(broken, null), assertions).find(flag => flag.checkId === 'skip-link-missing')!
    const after = { ...receipt(evidence('passed')), assertions: accessibilityObservations({ metadata, scope }) }
    expect(after.assertions.find(item => item.key === 'dom:skip-link-missing')).toMatchObject({ passed: false, complete: false, disposition: 'observed' })
    expect(scopedAssertionForTarget({ receipt: after, checkId: flag.checkId, flag })).toBeUndefined()
  })
  it('does not let a later page contaminate the original captured HTML responsibility', () => {
    const other = evidence('failed', { scope: { ...scope, finalUrl: pageUrl + 'other' } })
    const assertions = accessibilityObservations({ metadata, scope, evidence: other })
    expect(assertions.find(item => item.key === 'dom:buttons-no-text')).toMatchObject({ passed: true, complete: true })
    expect(assertions.find(item => item.key === 'axe:buttons-no-text')).toMatchObject({ passed: false, complete: true })
  })
})
