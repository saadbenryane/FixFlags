import { describe, expect, it } from 'vitest'
import type { KeyboardEvidence } from '../browser/keyboard-probe'
import { runKeyboardChecks } from './keyboard'

const evidence: KeyboardEvidence = { version: 1, pageUrl: 'https://example.com/', collectedAt: '2026-10-11T10:00:00.000Z',
  complete: true, reason: 'document_boundary_observed', candidateCount: 1, trap: 'not_observed', limitations: [],
  steps: [{ id: 1, selector: '#action', label: 'Action', domOrder: 0, tabIndex: 0, indicator: 'styled',
    rect: { x: 10, y: 10, width: 100, height: 30 } }] }

describe('keyboard evidence evaluation', () => {
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
