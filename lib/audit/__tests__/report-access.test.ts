import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  canViewPrescriptionContent,
  canViewDeterministicFixes,
  canViewAiViaStudioPublicShare,
  canViewPrescriptionContentForAudit,
  canViewDeterministicFixesForAudit,
  isPublicMarketingSample,
  stripAiPrescriptionFromFlags,
  stripDeterministicFixesFromFlags,
  stripAiPrescriptionFromRubrics,
  stripDeterministicFixesFromRubrics,
  stripLegacyDeterministicAudit,
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
      canViewAiViaStudioPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        true
      ),
      true
    )
    assert.equal(
      canViewAiViaStudioPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        false
      ),
      false
    )
    assert.equal(
      canViewAiViaStudioPublicShare(
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

  it('returns null when no flag carries a usable fix prompt', () => {
    const picked = findHighestSeverityFlagWithFix([
      { source: 'AI', severity: 'CRITICAL', problem: 'No fix at all' },
      { source: 'DETERMINISTIC', severity: 'IMPORTANT', problem: 'placeholder', fix: 'Sign up' },
    ])
    assert.equal(picked, null)
  })

  it('prefers the highest severity among flags with fixes', () => {
    const picked = findHighestSeverityFlagWithFix([
      { source: 'AI', severity: 'POLISH', problem: 'polish', fix: 'Nudge spacing' },
      { source: 'AI', severity: 'CRITICAL', problem: 'critical', fix: 'Fix the flow' },
      { source: 'AI', severity: 'IMPORTANT', problem: 'important', fix: 'Rework CTA' },
    ])
    assert.equal(picked?.problem, 'critical')
  })

  it('strips prescription fields from rubrics and their flags', () => {
    const stripped = stripAiPrescriptionFromRubrics([
      {
        summary: 'keep',
        rubricPrompt: 'hidden',
        cursorPrompt: 'hidden',
        flags: [
          { problem: 'flag a', agentPrompt: 'x', fix: 'keep fix' },
        ],
      },
    ])
    assert.equal(stripped[0]?.summary, 'keep')
    assert.equal(stripped[0]?.rubricPrompt, null)
    assert.equal(stripped[0]?.cursorPrompt, null)
    assert.equal(stripped[0]?.flags?.[0]?.agentPrompt, null)
    assert.equal(stripped[0]?.flags?.[0]?.fix, 'keep fix')
  })

  it('strips deterministic fixes from rubrics and keeps evidence', () => {
    const stripped = stripDeterministicFixesFromRubrics([
      {
        rubricPrompt: 'x',
        flags: [{ problem: 'flag a', fix: 'hidden', evidence: 'kept' }],
      },
    ])
    assert.equal(stripped[0]?.rubricPrompt, null)
    assert.equal(stripped[0]?.flags?.[0]?.fix, null)
    assert.equal(stripped[0]?.flags?.[0]?.evidence, 'kept')
  })

  it('hides all AI fields on legacy deterministic-only audits', () => {
    const stripped = stripLegacyDeterministicAudit({
      verdict: 'should_have_ai',
      pageJob: 'triage',
      pageType: 'marketing',
      launchReadiness: { score: 0.4 },
      flags: [
        { source: 'AI', problem: 'ai flag', agentPrompt: 'x', whyItMatters: 'why' },
        { source: 'DETERMINISTIC', problem: 'det flag', fix: 'keep', whyItMatters: 'why' },
      ],
      rubrics: [
        {
          summary: 's',
          rubricPrompt: 'p',
          flags: [{ problem: 'rubric flag', agentPrompt: 'x' }],
        },
      ],
    })
    assert.equal(stripped.verdict, null)
    assert.equal(stripped.pageJob, null)
    assert.equal(stripped.pageType, null)
    assert.equal(stripped.launchReadiness, null)
    assert.equal(stripped.flags.length, 1)
    assert.equal(stripped.flags[0]?.source, 'DETERMINISTIC')
    assert.equal(stripped.flags[0]?.whyItMatters, null)
    assert.equal(stripped.flags[0]?.fix, 'keep')
    assert.equal(stripped.rubrics?.[0]?.rubricPrompt, '')
    assert.equal(stripped.rubrics?.[0]?.flags?.[0]?.agentPrompt, null)
  })
})

describe('report-access async resolution', () => {
  const aiReviewAt = new Date('2026-01-01')

  it('allows marketing samples without any viewer or owner lookup', async () => {
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: null, aiReviewAt, isPublic: true },
        null
      ),
      true
    )
    assert.equal(prismaMock.user.findUnique.mock.calls.length, 0)
  })

  it('allows the signed-in owner without a database lookup', async () => {
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt, isPublic: false },
        { id: 'owner-1' }
      ),
      true
    )
  })

  it('allows AI content on a public share when the owner can share publicly', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'owner-1',
      role: 'user',
      plan: 'TEAM',
      subscriptionStatus: 'ACTIVE',
    })
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        { id: 'stranger' }
      ),
      true
    )
  })

  it('denies AI content on a public share when the owner is on a lower plan', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'owner-1',
      role: 'user',
      plan: 'FREE',
      subscriptionStatus: 'NONE',
    })
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        { id: 'stranger' }
      ),
      false
    )
  })

  it('denies AI content when the audit is not public or has no AI review', async () => {
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt, isPublic: false },
        { id: 'stranger' }
      ),
      false
    )
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt: null, isPublic: true },
        { id: 'stranger' }
      ),
      false
    )
  })

  it('denies AI content when the owner row is gone', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    assert.equal(
      await canViewPrescriptionContentForAudit(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        { id: 'stranger' }
      ),
      false
    )
  })

  it('resolves deterministic fix access for owners and marketing samples', async () => {
    assert.equal(
      await canViewDeterministicFixesForAudit(
        { userId: null, aiReviewAt, isPublic: true },
        null
      ),
      true
    )
    assert.equal(
      await canViewDeterministicFixesForAudit(
        { userId: 'owner-1', aiReviewAt: null, isPublic: false },
        { id: 'owner-1' }
      ),
      true
    )
    assert.equal(
      await canViewDeterministicFixesForAudit(
        { userId: 'owner-1', aiReviewAt: null, isPublic: true },
        null
      ),
      false
    )
  })
})
