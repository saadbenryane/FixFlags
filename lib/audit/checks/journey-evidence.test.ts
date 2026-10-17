import { describe, expect, it } from 'vitest'
import { JOURNEY_VERIFICATION_RULE, journeyObservationSchema, journeyContext, journeyAssertions, journeyReceipts, nativeJourneyFlags, scopedJourneyFinding, type JourneyObservation } from './journey-evidence'
import { CHECK_REGISTRY } from '../check-registry'
import { collapseFlagsWithAffectedPaths } from '../flag-identity'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import type { JourneyFindingDraft } from '../journey/types'

const pageUrl = 'https://example.com/'
const checkId = 'journey-signup-no-form'
function observation(fields = 0): JourneyObservation {
  return { version: 1, journeyType: 'signup', phase: 'destination', route: [{ selector: '#signup', label: 'Get started' }],
    scope: { pageUrl, finalUrl: pageUrl + 'signup', profile: 'desktop', access: 'public' },
    available: true, pathComplete: true, headline: true, primaryAction: true, nextPath: true, fieldCount: fields }
}
const draft: JourneyFindingDraft = { checkId, url: pageUrl + 'signup', stepNumber: 2, rubric: 'EXPERIENCE', severity: 'CRITICAL',
  impactTag: 'CONVERSION', problem: 'Signup fields are missing', evidence: 'No visible fields on the signup route',
  whyItMatters: 'Visitors cannot continue', fix: 'Show the signup form', findingType: 'friction' }
const flag = scopedJourneyFinding(draft, [observation()])!
function receipt(observed: JourneyObservation) {
  return journeyReceipts([observed], { auditId: 'after', taskId: 'journey-task', collectedAt: new Date().toISOString() })[0]
}
const compare = (observed: JourneyObservation) => scopedAssertionForTarget({ receipt: receipt(observed), checkId, flag })

describe('independent public journey conditions', () => {
  it('versions rendered action and path discovery without treating detector changes as repair', () => {
    const original = { ...observation(), phase: 'landing' as const, route: [], primaryAction: false, nextPath: false }
    const corrected = { ...original, actionVersion: 3 as const, pathVersion: 2 as const, actionComplete: true }
    for (const checkId of ['journey-signup-hidden-cta', 'journey-signup-dead-end']) {
      const historical = scopedJourneyFinding({ ...draft, checkId }, [original])!
      const current = receipt({ ...corrected, primaryAction: true, nextPath: true })
      expect(scopedAssertionForTarget({ receipt: current, checkId, flag: historical })).toBeUndefined()
      const source = scopedJourneyFinding({ ...draft, checkId }, [corrected])!
      expect(scopedAssertionForTarget({ receipt: current, checkId, flag: source })?.assertion.passed).toBe(true)
    }
    expect(scopedJourneyFinding({ ...draft, checkId: 'journey-signup-hidden-cta' }, [{ ...corrected, actionComplete: false }])).toBeUndefined()
    expect(scopedJourneyFinding({ ...draft, checkId: 'journey-signup-dead-end' }, [{ ...corrected, pathComplete: false }])).toBeUndefined()
  })
  it('keeps v3 unactivated-route assessment separate from historical v2 recovery', () => {
    const original = { ...observation(), phase: 'landing' as const, route: [], nextPath: false, pathVersion: 2 as const }
    const current = { ...original, nextPath: true, pathVersion: 3 as const }
    expect(journeyObservationSchema.parse(original).pathVersion).toBe(2)
    expect(journeyObservationSchema.parse(current).pathVersion).toBe(3)
    expect(journeyContext(original, 'landing-path')).not.toBe(journeyContext(current, 'landing-path'))
    for (const condition of ['landing-action', 'landing-headline', 'destination-form'])
      expect(journeyContext(original, condition)).toBe(journeyContext(current, condition))
    const historical = scopedJourneyFinding({ ...draft, checkId: 'journey-signup-dead-end' }, [original])!
    expect(scopedAssertionForTarget({ receipt: receipt(current), checkId: historical.checkId, flag: historical })).toBeUndefined()
  })
  it('cannot use added native-input discovery to certify previous action findings as repaired', () => {
    const older = { ...observation(), actionVersion: 3 as const, actionComplete: true, primaryAction: false }
    const corrected = { ...older, actionVersion: 4 as const, primaryAction: true }
    expect(journeyContext(older, 'destination-action')).not.toBe(journeyContext(corrected, 'destination-action'))
    for (const condition of ['destination-form', 'destination-headline', 'landing-path']) {
      expect(journeyContext(older, condition)).toBe(journeyContext(corrected, condition))
    }
  })
  it('keeps corrected activation-control field counts separate without changing unrelated journey evidence', () => {
    const older = observation(), corrected = { ...older, fieldVersion: 2 as const }
    for (const condition of ['destination-form', 'destination-field-count']) {
      expect(journeyContext(older, condition)).not.toBe(journeyContext(corrected, condition))
    }
    for (const condition of ['destination-action', 'destination-headline', 'landing-path']) {
      expect(journeyContext(older, condition)).toBe(journeyContext(corrected, condition))
    }
  })
  it('retains the landing admission URL and independently checks the actual destination condition', () => {
    expect(flag).toMatchObject({ url: pageUrl + 'signup', affectedPaths: [pageUrl], verificationRule: JOURNEY_VERIFICATION_RULE })
    expect(compare(observation())?.assertion.passed).toBe(false)
    expect(compare(observation(2))?.assertion.passed).toBe(true)
    // Missing form and excessive field count are independent responsibilities.
    expect(compare(observation(9))?.assertion.passed).toBe(true)
    expect(journeyAssertions(observation(9)).find(assertion => assertion.key === 'destination-field-count')?.passed).toBe(false)
    expect(journeyAssertions(observation()).find(assertion => assertion.key === 'destination-field-count')?.passed).toBe(false)
  })
  it('requires the original path, phase, type, destination, access and capture profile', () => {
    for (const key of ['pageUrl', 'finalUrl', 'profile', 'access'] as const) {
      const data = observation(2)
      data.scope[key] += key.endsWith('Url') ? 'other' : ':changed'
      expect(compare(data), key).toBeUndefined()
    }
    for (const data of [{ ...observation(2), journeyType: 'first-visit' as const },
      { ...observation(2), phase: 'landing' as const }, { ...observation(2), route: [{ selector: '#other', label: 'Get started' }] },
      { ...observation(2), available: false }]) expect(compare(data)).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(observation(2)), checkId, flag: { ...flag, verificationRule: 'Legacy journey completion' } })).toBeUndefined()
    expect(scopedJourneyFinding(draft, [{ ...observation(), available: false }])).toBeUndefined()
  })
  it('requires every original cohort and shares that verdict with monitoring recovery', () => {
    const other = observation(); other.scope.pageUrl += 'other'; other.scope.finalUrl += '/other'
    const second = scopedJourneyFinding({ ...draft, url: other.scope.finalUrl }, [other])!
    const combined = { ...flag, evidenceTargets: [...flag.evidenceTargets!, ...second.evidenceTargets!] }
    const healthy = receipt(observation(2)), failed = receipt(other)
    expect(scopedAssertionForTarget({ receipt: healthy, receipts: [failed], checkId, flag: combined })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ receipt: healthy, checkId, flag: combined })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(observation()), checkId, flag: combined })?.assertion)
      .toMatchObject({ passed: false, complete: true })
    const recovered = (data: JourneyObservation) => hasRecordedRecoveryEvidence({ auditId: 'after', flag: { ...flag, pageUrl },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl, environment: 'production',
        checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null },
      executions: [{ targetKey: 'module:journeys', status: 'COMPLETED', detail: receipt(data) }] })
    expect(recovered(observation())).toBe(false)
    expect(recovered(observation(2))).toBe(true)
    expect(recovered({ ...observation(2), available: false })).toBe(false)
  })
  it('keeps a bounded link search incomplete without blocking independent headline evidence', () => {
    const data = { ...observation(), phase: 'landing' as const, route: [], headline: false, nextPath: false, pathComplete: false }
    expect(journeyAssertions(data).find(assertion => assertion.key === 'landing-path')).toMatchObject({ complete: false })
    expect(journeyAssertions(data).find(assertion => assertion.key === 'landing-headline')).toMatchObject({ complete: true, passed: false })
  })
  it('does not promote a fresh specialty-route miss into a generic landing-path failure', () => {
    const contact = { ...draft, checkId: 'journey-contact-support-dead-end', source: 'JOURNEY' as const }
    expect(nativeJourneyFlags([contact])).toEqual([])
    // Historical identity readers retain their original meaning and records.
    expect(nativeJourneyFlags([{ ...contact, source: undefined }])[0]?.checkId).toBe('journey-dead-end')
  })
  it('verifies the shared missing-action identity across the original journey types', () => {
    const original = { ...observation(), phase: 'landing' as const, route: [], primaryAction: false }
    const failed = scopedJourneyFinding({ ...draft, checkId: 'journey-signup-hidden-cta' }, [original])!
    const shared = nativeJourneyFlags([failed])[0]
    expect(shared.checkId).toBe('journey-hidden-cta')
    expect(CHECK_REGISTRY[shared.checkId].module).toBe('journeys')
    expect(scopedAssertionForTarget({ receipt: receipt({ ...original, primaryAction: true }), checkId: shared.checkId, flag: shared })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: receipt({ ...original, primaryAction: true, journeyType: 'first-visit' }), checkId: shared.checkId, flag: shared })).toBeUndefined()
    const unscoped = nativeJourneyFlags([{ ...draft, checkId: 'journey-funnel-hidden-cta' }])[0]
    const combined = collapseFlagsWithAffectedPaths([shared, unscoped])[0]
    expect(scopedAssertionForTarget({ receipt: receipt({ ...original, primaryAction: true }), checkId: shared.checkId, flag: combined })).toBeUndefined()
  })
  it('withholds historical action recovery after detector changes while retaining unchanged page conditions', () => {
    const original = { ...observation(), phase: 'landing' as const, route: [], primaryAction: false, headline: false }
    const current = receipt({ ...original, primaryAction: true, headline: true })
    const action = nativeJourneyFlags([scopedJourneyFinding({ ...draft, checkId: 'journey-signup-hidden-cta' }, [original])!])[0]
    const historical = { ...action, evidenceTargets: action.evidenceTargets!.map(target => ({ ...target, context: journeyContext(original) })) }
    expect(scopedAssertionForTarget({ receipt: current, checkId: action.checkId, flag: action })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: current, checkId: action.checkId, flag: historical })).toBeUndefined()
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', flag: { ...historical, pageUrl },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl, environment: 'production',
        checks: { [action.checkId]: 1 }, outcomes: [], verificationTarget: null },
      executions: [{ targetKey: 'module:journeys', status: 'COMPLETED', detail: current }] })).toBe(false)
    const headline = scopedJourneyFinding({ ...draft, checkId: 'journey-signup-unclear-value-prop' }, [original])!
    expect(headline.evidenceTargets![0].context).toBe(journeyContext(original))
    expect(scopedAssertionForTarget({ receipt: current, checkId: headline.checkId, flag: headline })?.assertion.passed).toBe(true)
  })

  it('versions native headline conditions without invalidating unrelated journey observations', () => {
    const checkId = 'journey-first-visit-destination-no-headline'
    const original = { ...observation(), journeyType: 'first-visit' as const, headline: false }
    const historical = scopedJourneyFinding({ ...draft, checkId }, [original])!
    const observed = { ...original, headlineVersion: 2 as const, headlineComplete: true }
    const healthy = receipt({ ...observed, headline: true })
    expect(scopedAssertionForTarget({ receipt: healthy, checkId, flag: historical })).toBeUndefined()
    const current = scopedJourneyFinding({ ...draft, checkId }, [observed])!
    expect(scopedAssertionForTarget({ receipt: healthy, checkId, flag: current })?.assertion.passed).toBe(true)
    expect(scopedJourneyFinding({ ...draft, checkId }, [{ ...observed, headlineComplete: false }])).toBeUndefined()
    const action = scopedJourneyFinding({ ...draft, checkId: 'journey-first-visit-destination-no-next-action' }, [{ ...original, primaryAction: false }])!
    expect(scopedAssertionForTarget({ receipt: healthy, checkId: action.checkId, flag: action })?.assertion.passed).toBe(true)
  })
})
