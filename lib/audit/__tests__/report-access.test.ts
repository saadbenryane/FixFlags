import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  canViewPrescriptionContent,
  canViewDeterministicFixes,
  canViewAiViaMaxPublicShare,
  isPublicMarketingSample,
  stripAiPrescriptionFromFlags,
  stripDeterministicFixesFromFlags,
  findHighestSeverityFlagWithFix,
} from '@/lib/audit/report-access'

const aiReviewAt = new Date('2026-01-01')

describe('report-access', () => {
  it('identifies public marketing sample audits', () => {
    assert.equal(
      isPublicMarketingSample({ userId: null, aiReviewAt, isPublic: true }),
      true
    )
    assert.equal(
      isPublicMarketingSample({ userId: 'user-1', aiReviewAt, isPublic: true }),
      false
    )
    assert.equal(
      isPublicMarketingSample({ userId: null, aiReviewAt: null, isPublic: true }),
      false
    )
    assert.equal(
      isPublicMarketingSample({ userId: null, aiReviewAt, isPublic: false }),
      false
    )
  })

  it('grants prescription content to the signed-in owner', () => {
    assert.equal(
      canViewPrescriptionContent(
        { userId: 'owner-1', aiReviewAt, isPublic: false },
        { id: 'owner-1' }
      ),
      true
    )
  })

  it('denies prescription content to anonymous viewers on owned audits', () => {
    assert.equal(
      canViewPrescriptionContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        null
      ),
      false
    )
    assert.equal(
      canViewPrescriptionContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        undefined
      ),
      false
    )
  })

  it('denies prescription content to non-owners', () => {
    assert.equal(
      canViewPrescriptionContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        { id: 'other-user' }
      ),
      false
    )
  })

  it('allows Max public share when owner can share publicly', () => {
    assert.equal(
      canViewAiViaMaxPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        true
      ),
      true
    )
    assert.equal(
      canViewAiViaMaxPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        false
      ),
      false
    )
    assert.equal(
      canViewAiViaMaxPublicShare(
        { userId: null, aiReviewAt, isPublic: true },
        true
      ),
      false
    )
  })

  it('grants deterministic fixes to signed-in owner without AI prescription', () => {
    assert.equal(
      canViewDeterministicFixes(
        { userId: 'owner-1', aiReviewAt: null, isPublic: false },
        { id: 'owner-1' }
      ),
      true
    )
    assert.equal(
      canViewDeterministicFixes(
        { userId: 'owner-1', aiReviewAt: null, isPublic: true },
        null
      ),
      false
    )
  })

  it('strips AI prescription fields but keeps deterministic fix text', () => {
    const stripped = stripAiPrescriptionFromFlags([
      {
        source: 'DETERMINISTIC',
        problem: 'det flag',
        agentPrompt: 'x',
        fix: 'keep me',
        evidence: 'evidence',
        whyItMatters: 'why',
      },
    ])
    assert.equal(stripped[0]?.fix, 'keep me')
    assert.equal(stripped[0]?.evidence, 'evidence')
    assert.equal(stripped[0]?.whyItMatters, 'why')
    assert.equal(stripped[0]?.agentPrompt, null)
  })

  it('strips deterministic fix prompts for anonymous viewers but keeps evidence', () => {
    const stripped = stripDeterministicFixesFromFlags([
      {
        source: 'DETERMINISTIC',
        problem: 'det flag',
        fix: 'hidden',
        evidence: 'kept evidence',
        whyItMatters: 'kept why',
      },
    ])
    assert.equal(stripped[0]?.fix, null)
    assert.equal(stripped[0]?.evidence, 'kept evidence')
    assert.equal(stripped[0]?.whyItMatters, 'kept why')
  })

  it('strips prescription fields but keeps AI flag titles and triage fields when locked', () => {
    const stripped = stripDeterministicFixesFromFlags([
      { source: 'AI', problem: 'ai flag', agentPrompt: 'x', whyItMatters: 'y', evidence: 'e' },
      { source: 'DETERMINISTIC', problem: 'det flag', agentPrompt: 'z', whyItMatters: 'w' },
    ])
    assert.equal(stripped.length, 2)
    assert.equal(stripped[0]?.source, 'AI')
    assert.equal(stripped[0]?.problem, 'ai flag')
    assert.equal(stripped[0]?.agentPrompt, null)
    assert.equal(stripped[0]?.whyItMatters, 'y')
    assert.equal(stripped[0]?.evidence, 'e')
    assert.equal(stripped[1]?.agentPrompt, null)
    assert.equal(stripped[1]?.whyItMatters, 'w')
  })

  it('ignores legacy signup-gate fix strings when picking a demonstrated prompt', () => {
    const picked = findHighestSeverityFlagWithFix([
      {
        source: 'AI',
        severity: 'CRITICAL',
        problem: 'AI flag',
        fix: 'Sign up to get the fix prompt.',
      },
      {
        source: 'DETERMINISTIC',
        severity: 'IMPORTANT',
        problem: 'Det flag',
        fix: 'Raise the primary CTA into the first mobile viewport.',
      },
    ])
    assert.equal(picked?.problem, 'Det flag')
  })
})
