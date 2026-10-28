import { describe, expect, it } from 'vitest'
import type { KeyboardEvidence } from '../browser/keyboard-probe'
import { runKeyboardChecks } from './keyboard'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'

const evidence: KeyboardEvidence = { version: 1, pageUrl: 'https://example.com/', collectedAt: '2026-10-11T10:00:00.000Z',
  complete: true, reason: 'document_boundary_observed', candidateCount: 1, trap: 'not_observed', limitations: [],
  steps: [{ id: 1, selector: '#action', label: 'Action', domOrder: 0, tabIndex: 0, indicator: 'styled',
    rect: { x: 10, y: 10, width: 100, height: 30 } }] }

describe('keyboard evidence evaluation', () => {
  it('keeps corrected focus paint observations separate from historical detector evidence', () => {
    const scope = { pageUrl: evidence.pageUrl, finalUrl: evidence.pageUrl, profile: 'desktop', access: 'public' }
    const original = runKeyboardChecks({ ...evidence, scope, steps: [{ ...evidence.steps[0], indicator: 'missing' }] }).flags[0]
    const current = runKeyboardChecks({ ...evidence, scope, focusPolicy: 'painted-properties-v2' })
    expect(scopedAssertionForTarget({ checkId: original.checkId!, flag: original, receipt: checkReceiptSchema.parse({
      kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: evidence.pageUrl, applicable: true,
      complete: true, passed: true, assertions: current.assertions,
      execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: evidence.collectedAt },
    }) })).toBeUndefined()
    const navigation = (focusPolicy?: 'painted-properties-v2') => runKeyboardChecks({ ...evidence, scope, focusPolicy, trap: 'blocked' })
      .flags.find(flag => flag.checkId === 'keyboard-nav-trap')!.evidenceTargets
    expect(navigation('painted-properties-v2')).toEqual(navigation())
  })
  it('requires the same requested page, final page, browser profile and access for original-control repair', () => {
    const scope = { pageUrl: evidence.pageUrl, finalUrl: evidence.pageUrl, profile: 'desktop', access: 'public' }
    const original = runKeyboardChecks({ ...evidence, scope, steps: [{ ...evidence.steps[0], indicator: 'missing' }] }).flags[0]
    const observe = (current: typeof scope | undefined) => {
      const checked = runKeyboardChecks({ ...evidence, scope: current, pageUrl: current?.finalUrl ?? evidence.pageUrl })
      return scopedAssertionForTarget({ checkId: 'focus-visible-missing', flag: original, receipt: checkReceiptSchema.parse({
        kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: current?.finalUrl ?? evidence.pageUrl,
        applicable: true, complete: true, passed: true, assertions: checked.assertions,
        execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: evidence.collectedAt },
      }) })
    }
    expect(observe(scope)?.assertion.passed).toBe(true)
    for (const current of [undefined, { ...scope, profile: 'mobile' }, { ...scope, access: 'credentialed:changed' },
      { ...scope, access: 'credentialed:unknown' }, { ...scope, pageUrl: scope.pageUrl + '#different' },
      { ...scope, finalUrl: scope.finalUrl + 'different' }]) expect(observe(current)).toBeUndefined()
  })
  it('records inspected controls and positive scope without inferring whole-site accessibility', () => {
    const result = runKeyboardChecks(evidence)
    expect(result.flags).toEqual([])
    expect(result.assertions.every(assertion => assertion.passed && assertion.targets?.[0]?.selector === '#action')).toBe(true)
    expect(result.assertions[0].observed).toContain('not evaluated')
  })
  it('retains measured findings on incomplete evidence without positive clearance', () => {
    const result = runKeyboardChecks({ ...evidence, complete: false, reason: 'step_limit',
      steps: [{ ...evidence.steps[0], indicator: 'missing' }] })
    expect(result.flags[0]).toMatchObject({ checkId: 'focus-visible-missing', pageUrl: evidence.pageUrl,
      evidenceTargets: [{ selector: '#action', source: 'measured' }] })
    expect(result.assertions.find(assertion => assertion.key === 'focus-styles')).toMatchObject({ passed: false, complete: true })
    expect(result.assertions.filter(assertion => assertion.key !== 'focus-styles').every(assertion => assertion.complete === false && assertion.passed === false)).toBe(true)
  })
  it('does not turn unresolved focus styles or a modal boundary into a failure or success', () => {
    const result = runKeyboardChecks({ ...evidence, complete: false, trap: 'unknown', reason: 'dialog_requires_activation',
      steps: [{ ...evidence.steps[0], indicator: 'unknown' }] })
    expect(result.flags).toEqual([])
    expect(result.assertions.find(assertion => assertion.key === 'focus-styles')).toMatchObject({ complete: false, passed: false })
    expect(result.assertions.filter(assertion => assertion.key !== 'focus-styles').every(assertion => assertion.complete === false && assertion.passed === false)).toBe(true)
  })
  it('keeps a refused probe incomplete and still reports a measured trap', () => {
    const refused = runKeyboardChecks({ ...evidence, limitations: ['protected_action_refused'] })
    expect(refused.flags).toEqual([])
    expect(refused.assertions.filter(assertion => assertion.key === 'tab-sequence' || assertion.key === 'keyboard-exit')).toEqual([
      expect.objectContaining({ key: 'tab-sequence', complete: false, passed: false }),
      expect.objectContaining({ key: 'keyboard-exit', complete: false, passed: false }),
    ])
    const trapped = runKeyboardChecks({ ...evidence, limitations: ['protected_action_refused'], trap: 'blocked' })
    expect(trapped.flags.map(flag => flag.checkId)).toContain('keyboard-nav-trap')
    expect(trapped.assertions.find(assertion => assertion.key === 'keyboard-exit')).toMatchObject({ passed: false, complete: true })
  })
})
