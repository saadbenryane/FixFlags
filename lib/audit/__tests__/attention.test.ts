import { describe, expect, it } from 'vitest'
import {
  isAttentionCandidate,
  isCustomerFlag,
  isWorthwhileAttentionFlag,
  MIN_ATTENTION_CONFIDENCE,
  hasUnresolvedFlagEvidence,
} from '@/lib/audit/attention'
import { observationsForFlag, publicSupportingObservations } from '@/lib/audit/flag-observations'

describe('attention judgment', () => {
  it('distinguishes private native evidence, legacy absence and validated public display state', () => {
    const finding = { checkId: 'no-https', severity: 'IMPORTANT', confidence: 1 }
    const recorded = observationsForFlag({ ...finding, source: 'DETERMINISTIC', evidence: 'Original response', pageUrl: 'https://example.com/' },
      { auditId: 'audit', taskId: 'task', checkVersion: 1, collectedAt: '2026-10-20T12:00:00.000Z' })
    const publicView = publicSupportingObservations(recorded)
    expect(isCustomerFlag({ ...finding, supportingObservations: recorded })).toBe(true)
    expect(isCustomerFlag({ ...finding, supportingObservations: null })).toBe(true)
    expect(isCustomerFlag({ ...finding, supportingObservations: publicView })).toBe(false)
    expect(isCustomerFlag({ ...finding, supportingObservations: publicView, supportingEvidenceUnreadable: false })).toBe(true)
    for (const supportingObservations of [{ version: 99, items: [] }, [], publicView]) {
      expect(isCustomerFlag({ ...finding, supportingObservations })).toBe(false)
      expect(hasUnresolvedFlagEvidence({ ...finding, supportingObservations })).toBe(true)
    }
    expect(hasUnresolvedFlagEvidence({ ...finding, supportingEvidenceUnreadable: true, status: 'IGNORED' })).toBe(false)
    expect(hasUnresolvedFlagEvidence({ ...finding, checkId: 'title-too-long', supportingEvidenceUnreadable: true })).toBe(false)
    expect(hasUnresolvedFlagEvidence({ ...finding, checkId: 'form-contact-failed', severity: 'POLISH', impactTag: 'CONVERSION',
      supportingEvidenceUnreadable: true })).toBe(true)
  })
  it('keeps confirmed Important and Critical Flags as Attention candidates', () => {
    expect(isAttentionCandidate({ severity: 'CRITICAL' })).toBe(true)
    expect(isAttentionCandidate({ severity: 'IMPORTANT', confidence: 0.9 })).toBe(true)
  })

  it('excludes Polish, resolved, and low-confidence Flags from Attention', () => {
    expect(isAttentionCandidate({ severity: 'POLISH', confidence: 1 })).toBe(false)
    expect(isAttentionCandidate({ severity: 'IMPORTANT', status: 'FIXED' })).toBe(false)
    expect(
      isAttentionCandidate({
        severity: 'IMPORTANT',
        confidence: MIN_ATTENTION_CONFIDENCE - 0.01,
      })
    ).toBe(false)
  })

  it('requires a recommended change before a candidate becomes worthwhile Attention', () => {
    expect(
      isWorthwhileAttentionFlag({
        severity: 'CRITICAL',
        recommendedChange: '',
      })
    ).toBe(false)
    expect(
      isWorthwhileAttentionFlag({
        severity: 'CRITICAL',
        fix: '1. Change the headline\n2. Keep the offer',
      })
    ).toBe(true)
  })
})

describe('customer Flag projector', () => {
  it.each(['journey-funnel-broken-promise', 'journey-funnel-confusion', 'journey-funnel-accessibility-barrier'])('keeps qualitative journey judgment %s advisory', checkId => {
    expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(false)
  })
  it.each(['MESSAGE', 'EXPERIENCE', 'REACH'])('keeps unregistered %s judgments as Recommendations', rubric => {
    expect(isCustomerFlag({ rubric, severity: 'CRITICAL', confidence: 1 })).toBe(false)
  })
  it.each(['h1-generic', 'no-cta-detected', 'cta-below-fold-mobile', 'placeholder-copy-detected'])('keeps heuristic %s signals advisory, including historical severity', checkId => {
    expect(isCustomerFlag({ checkId, severity: 'IMPORTANT', confidence: 1, impactTag: 'CONVERSION' })).toBe(false)
  })
  it.each(['journey-first-visit-destination-no-next-action', 'journey-pricing-evaluation-destination-no-next-action'])(
    'keeps primary-action recognizer judgment %s advisory even at historical critical severity', checkId => {
      for (const severity of ['IMPORTANT', 'CRITICAL']) {
        const observation = { checkId, severity, confidence: 1, impactTag: 'CONVERSION', fix: 'Review the existing controls and page purpose.' }
        expect(isCustomerFlag(observation)).toBe(false)
        expect(isAttentionCandidate(observation)).toBe(false)
        expect(isWorthwhileAttentionFlag(observation)).toBe(false)
      }
    },
  )

  it.each(['journey-signup-no-form', 'journey-hidden-cta', 'journey-first-visit-hidden-cta',
    'journey-pricing-evaluation-hidden-cta', 'journey-signup-hidden-cta', 'journey-checkout-hidden-cta',
    'journey-contact-support-hidden-cta', 'journey-multi-step-funnel-hidden-cta', 'journey-contact-not-found', 'journey-funnel-loop-detected'])(
    'keeps recognizer-only observation %s advisory without rewriting its original severity', checkId => {
      const observation = Object.freeze({ checkId, severity: 'CRITICAL', confidence: 1, impactTag: 'CONVERSION', fix: 'Review the original scope.' })
      for (const scoped of [observation, { ...observation, checkId: checkId + '::page:original' }]) {
        expect(isCustomerFlag(scoped)).toBe(false)
        expect(isAttentionCandidate(scoped)).toBe(false)
        expect(isWorthwhileAttentionFlag(scoped)).toBe(false)
      }
      expect(observation.severity).toBe('CRITICAL')
    },
  )
  it.each(['journey-signup-nav-broken', 'journey-funnel-step-failed', 'form-contact-submit-failed'])(
    'retains measured navigation or submission failures as customer Flags: %s', checkId => {
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1, impactTag: 'CONVERSION' })).toBe(true)
    },
  )
  it('retains historical missing-attribute findings as Recommendations without certifying behavioral failure', () => {
    expect(isCustomerFlag({ checkId: 'form-missing-validation', severity: 'IMPORTANT', confidence: 1, impactTag: 'CONVERSION' })).toBe(false)
  })

  it('treats journey-critical findings as Flags even when severity is POLISH', () => {
    expect(
      isCustomerFlag({
        severity: 'POLISH',
        impactTag: 'CONVERSION',
        checkId: 'form-contact-failed',
        confidence: 0.9,
      })
    ).toBe(true)
  })

  it('treats optional SEO metadata as a Recommendation, not a Flag', () => {
    expect(
      isCustomerFlag({
        severity: 'IMPORTANT',
        impactTag: 'SEO',
        checkId: 'title-too-long',
        confidence: 0.9,
      })
    ).toBe(false)
  })

  it('keeps broken contact and security failures as Flags', () => {
    expect(
      isCustomerFlag({
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        checkId: 'form-contact-submit-failed',
      })
    ).toBe(true)
    expect(
      isCustomerFlag({
        severity: 'CRITICAL',
        impactTag: 'TRUST',
        checkId: 'no-https',
      })
    ).toBe(true)
  })
})
