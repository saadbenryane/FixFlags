import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  canViewAiReportContent,
  canViewAiViaAgencyPublicShare,
  isPublicMarketingSample,
  stripAiFromFlags,
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

  it('grants AI content to the signed-in owner', () => {
    assert.equal(
      canViewAiReportContent(
        { userId: 'owner-1', aiReviewAt, isPublic: false },
        { id: 'owner-1' }
      ),
      true
    )
  })

  it('denies AI content to anonymous viewers on owned audits', () => {
    assert.equal(
      canViewAiReportContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        null
      ),
      false
    )
    assert.equal(
      canViewAiReportContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        undefined
      ),
      false
    )
  })

  it('denies AI content to non-owners', () => {
    assert.equal(
      canViewAiReportContent(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        { id: 'other-user' }
      ),
      false
    )
  })

  it('allows Agency public share when owner can share publicly', () => {
    assert.equal(
      canViewAiViaAgencyPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        true
      ),
      true
    )
    assert.equal(
      canViewAiViaAgencyPublicShare(
        { userId: 'owner-1', aiReviewAt, isPublic: true },
        false
      ),
      false
    )
    assert.equal(
      canViewAiViaAgencyPublicShare(
        { userId: null, aiReviewAt, isPublic: true },
        true
      ),
      false
    )
  })

  it('strips AI flags and prompts when locked', () => {
    const stripped = stripAiFromFlags([
      { source: 'AI', problem: 'ai flag', agentPrompt: 'x', whyItMatters: 'y' },
      { source: 'DETERMINISTIC', problem: 'det flag', agentPrompt: 'z', whyItMatters: 'w' },
    ])
    assert.equal(stripped.length, 1)
    assert.equal(stripped[0]?.source, 'DETERMINISTIC')
    assert.equal(stripped[0]?.agentPrompt, null)
    assert.equal(stripped[0]?.whyItMatters, null)
  })
})
