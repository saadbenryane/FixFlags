import { describe, expect, it } from 'vitest'
import { postClickAssertions, runPostClickFlowChecks } from './flow-post-click'
import { postClickMetricsSchema, type PostClickMetrics } from '../flow/post-click-probes'
import { runFlowChecks } from './flow'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import type { PrimaryActionEvidence } from '../flow/primary-action-evidence'

const pageUrl = 'https://example.com/signup'
const observed: PostClickMetrics = { version: 2, pageUrl, timeToFirstContentMs: 3200, blankScreenMs: 2900,
  contentAbsentThroughMs: 2900, contentComplete: false, stuckLoading: null, stuckLoadingLabel: null, loadingComplete: false }
const action: PrimaryActionEvidence = { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
  candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 }
function receipt(metrics: PostClickMetrics, evidence = action) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl: 'https://example.com/', applicable: true,
    complete: false, passed: false, assertions: postClickAssertions(metrics, pageUrl, evidence),
    execution: { auditId: 'after', taskId: 'flow-task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}
describe('bounded post-click conclusions', () => {
  it('binds fresh loading findings and independent recovery to the original action and destination', () => {
    const metrics = { ...observed, contentComplete: true, contentAbsentThroughMs: 3100, stuckLoading: true, loadingComplete: true }
    const flags = runFlowChecks({ status: 'success', steps: [], finalUrl: pageUrl, actionEvidence: action, postClickMetrics: metrics })
    const flag = flags.find(flag => flag.checkId === 'flow-cta-blank-destination')!
    expect(flag.verificationRule).toBeDefined()
    const healthy = { ...metrics, timeToFirstContentMs: 100, contentAbsentThroughMs: 0, blankScreenMs: 0, stuckLoading: false }
    const input = { receipt: receipt(healthy), flag, checkId: flag.checkId }
    expect(scopedAssertionForTarget(input)?.assertion.passed).toBe(true)
    for (const response of ['challenge', 'restricted', 'unknown', 'error'] as const)
      expect(scopedAssertionForTarget({ ...input, receipt: receipt(healthy, { ...action, response }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt({ ...healthy, pageUrl: pageUrl + '/changed' }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(healthy, { ...action, controlContext: 'flow:control:' + 'c'.repeat(64) }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...flag, verificationRule: undefined } })).toBeUndefined()
    const stuck = flags.find(flag => flag.checkId === 'flow-cta-stuck-loading')!
    expect(scopedAssertionForTarget({ receipt: receipt({ ...healthy, timeToFirstContentMs: null, contentComplete: false }), flag: stuck, checkId: stuck.checkId })).toBeUndefined()
  })
  it('requires every original loading scope and refuses malformed or advisory substitutes', () => {
    const slow = { ...observed, contentAbsentThroughMs: 3100, contentComplete: true }
    const other = { ...action, controlContext: 'flow:control:' + 'd'.repeat(64) }
    const source = (evidence: PrimaryActionEvidence) => runFlowChecks({ status: 'success', steps: [], finalUrl: pageUrl,
      actionEvidence: evidence, postClickMetrics: slow }).find(flag => flag.checkId === 'flow-cta-blank-destination')!
    const first = source(action), second = source(other)
    const flag = { ...first, evidenceTargets: [...first.evidenceTargets!, ...second.evidenceTargets!] }
    const fast = { ...slow, timeToFirstContentMs: 100, contentAbsentThroughMs: 0, blankScreenMs: 0 }
    const input = { receipt: receipt(fast), checkId: flag.checkId, flag }
    expect(scopedAssertionForTarget(input)).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipts: [receipt(fast, other)] })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ ...input, flag: { ...first, evidenceTargets: first.evidenceTargets!.map(target => ({ ...target, device: 'mobile' })) } })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: first, receipt: receipt(fast, { ...action, responseExpected: false }) })).toBeUndefined()
  })
  it('does not infer a late arrival from a sampling gap across the threshold', () => {
    expect(runPostClickFlowChecks(observed)).toEqual([])
    expect(postClickAssertions(observed).every(assertion => !assertion.complete)).toBe(true)
    const absent = { ...observed, contentAbsentThroughMs: 3100, contentComplete: true }
    expect(runPostClickFlowChecks(absent).map(flag => flag.checkId)).toEqual(['flow-cta-blank-destination'])
  })
  it('reports observed absence without inventing an arrival when content never appears', () => {
    const absent = { ...observed, timeToFirstContentMs: null, blankScreenMs: 6000, contentAbsentThroughMs: 6000, contentComplete: true }
    expect(runPostClickFlowChecks(absent)[0].evidence).toContain('unavailable through 6000ms')
    expect(postClickMetricsSchema.parse(absent)).toEqual(absent)
    expect(runPostClickFlowChecks({ ...absent, blankScreenMs: null })[0].evidence).not.toContain('nullms')
  })
  it('leaves changed destinations unknown and does not grant new repair certificates', () => {
    const healthy = { ...observed, timeToFirstContentMs: 100, contentComplete: true, stuckLoading: false, loadingComplete: true }
    expect(postClickAssertions(healthy, pageUrl).every(assertion => assertion.passed && assertion.complete && assertion.disposition === 'observed')).toBe(true)
    expect(postClickAssertions(healthy, pageUrl + '/changed').every(assertion => !assertion.complete)).toBe(true)
    expect(runPostClickFlowChecks({ ...observed, contentAbsentThroughMs: 6000 }, pageUrl + '/changed')).toEqual([])
  })
})
