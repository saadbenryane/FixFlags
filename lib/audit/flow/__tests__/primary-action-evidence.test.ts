import { describe, expect, it } from 'vitest'
import { primaryActionAssertions, primaryPageContext, primaryControlContext, scopePrimaryActionFlags, PRIMARY_ACTION_VERIFICATION_RULE, type PrimaryActionEvidence } from '../primary-action-evidence'
import { runFlowChecks } from '../../checks/flow'
import { scopedAssertionForTarget } from '../../checks/verification'
import { checkReceiptSchema } from '../../checks/receipt'
import { extractCtaElementsFromHtml, scoreCtaCandidates } from '../score-cta-candidates'

const pageUrl = 'https://example.com/', pageContext = primaryPageContext(pageUrl, pageUrl, { width: 1280, height: 720 })
const controlContext = primaryControlContext({ pageContext, identity: '#primary', label: 'Get started', href: pageUrl + 'start?token=PRIVATE_VALUE', controls: null })
function evidence(overrides: Partial<PrimaryActionEvidence> = {}): PrimaryActionEvidence {
  return { version: 1, pageContext, controlContext, candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed',
    response: 'healthy', responseExpected: true, httpStatus: 200, ...overrides }
}
function receipt(observation: PrimaryActionEvidence) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl, applicable: true,
    complete: false, passed: false, assertions: primaryActionAssertions(observation),
    execution: { auditId: 'after', taskId: 'flow', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-12T12:00:00.000Z' } })
}
describe('primary action repair evidence', () => {
  it('recognizes declared button roles as primary actions without treating arbitrary text as a control', () => {
    const elements = extractCtaElementsFromHtml('<div role="button">Get started</div><div>Get started</div>')
    expect(scoreCtaCandidates(pageUrl, elements)).toHaveLength(1)
  })
  it('binds a recorded error and its independent repair to the original control', () => {
    const before = runFlowChecks({ status: 'error_response', steps: [], finalUrl: pageUrl + 'start', httpStatus: 404,
      actionEvidence: evidence({ response: 'error', httpStatus: 404 }) })
    expect(before[0]).toMatchObject({ checkId: 'flow-cta-404', verificationRule: PRIMARY_ACTION_VERIFICATION_RULE,
      evidenceTargets: [{ context: controlContext }] })
    const input = { receipt: receipt(evidence()), checkId: 'flow-cta-404', flag: before[0] }
    expect(scopedAssertionForTarget(input)?.assertion.passed).toBe(true)
    const changed = evidence({ controlContext: primaryControlContext({ pageContext, identity: '#other', label: 'Get started', href: pageUrl + 'start', controls: null }) })
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(changed) })).toBeUndefined()
    expect(JSON.stringify(input.receipt)).not.toContain('PRIVATE_VALUE')
  })
  it('never turns a restriction, challenge, or missing response into repair proof or a website error', () => {
    for (const response of ['restricted', 'challenge', 'unknown'] as const) {
      const observation = evidence({ response, httpStatus: response === 'restricted' ? 429 : null })
      expect(primaryActionAssertions(observation).find(item => item.key === 'primary-action-response')).toMatchObject({ passed: false, complete: false })
      expect(scopePrimaryActionFlags(runFlowChecks({ status: 'error_response', steps: [], finalUrl: pageUrl }), observation)).toEqual([])
    }
  })
  it('does not use successful click dispatch to claim that a button completed its action', () => {
    const observation = evidence({ navigation: 'unknown', response: 'unknown', responseExpected: false, httpStatus: null })
    expect(primaryActionAssertions(observation).find(item => item.key === 'primary-action-click')).toMatchObject({ passed: true, complete: true })
    expect(primaryActionAssertions(observation).find(item => item.key === 'primary-action-navigation')).toMatchObject({ passed: false, complete: false })
    expect(primaryActionAssertions(observation).find(item => item.key === 'primary-action-response')).toMatchObject({ disposition: 'observed' })
  })
  it('records observed same-page progress without manufacturing a successful HTTP response', () => {
    const observed = evidence({ samePageProgress: 'semantic-panel', response: 'unknown', httpStatus: null })
    const assertions = primaryActionAssertions(observed)
    expect(assertions.find(item => item.key === 'primary-action-navigation')).toMatchObject({ passed: true, complete: true,
      observed: expect.stringContaining('visible dialog or form') })
    expect(assertions.find(item => item.key === 'primary-action-response')).toMatchObject({ passed: false, complete: false })
  })
  it('does not diagnose a missing action on a page that has no primary-action responsibility', () => {
    const none = evidence({ candidateCount: 0, controlContext: null, clicked: false })
    expect(primaryActionAssertions(none, false)[0]).toMatchObject({ passed: false, complete: true, disposition: 'observed' })
  })
  it('keeps missing primary-action proof distinct from a missing previously recorded control', () => {
    const none = evidence({ candidateCount: 0, controlContext: null, clicked: false, navigation: 'unknown', response: 'unknown', httpStatus: null })
    const flags = runFlowChecks({ status: 'no_cta', steps: [], finalUrl: pageUrl, actionEvidence: none })
    expect(flags[0].evidenceTargets?.[0].context).toBe(pageContext)
    expect(scopedAssertionForTarget({ receipt: receipt(evidence()), checkId: 'flow-no-cta-found', flag: flags[0] })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: receipt(none), checkId: 'flow-cta-404', flag: { verificationRule: PRIMARY_ACTION_VERIFICATION_RULE,
      evidenceTargets: [{ context: controlContext }] } })).toBeUndefined()
  })
  it('requires positive blocker evidence before diagnosing an unclickable control', () => {
    const result = { status: 'unclickable' as const, steps: [], finalUrl: pageUrl, ctaText: 'Get started', clickFailure: 'interaction_error' as const }
    expect(runFlowChecks({ ...result, actionEvidence: evidence({ clicked: false, clickBlocked: false }) })).toEqual([])
    expect(runFlowChecks({ ...result, actionEvidence: evidence({ clicked: false, clickBlocked: true }) })[0].checkId).toBe('flow-cta-unclickable')
  })
})
