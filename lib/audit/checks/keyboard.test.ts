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
    expect(result.assertions).toHaveLength(1)
    expect(result.assertions[0].passed).toBe(false)
  })
  it('does not turn unresolved focus styles or a modal boundary into a failure or success', () => {
    const result = runKeyboardChecks({ ...evidence, complete: false, trap: 'unknown', reason: 'dialog_requires_activation',
      steps: [{ ...evidence.steps[0], indicator: 'unknown' }] })
    expect(result.flags).toEqual([])
    expect(result.assertions).toMatchObject([{ key: 'focus-styles', complete: false, passed: false }])
  })
})
