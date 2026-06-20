import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { deduplicateFlags } from '@/lib/audit/deduplicate'
import type { DeterministicFlag } from '@/lib/audit/checks'

function det(partial: Partial<DeterministicFlag> & Pick<DeterministicFlag, 'checkId' | 'problem'>): DeterministicFlag {
  return {
    rubric: 'REACH',
    impactTag: null,
    severity: 'IMPORTANT',
    evidence: partial.evidence ?? partial.problem,
    fix: 'Fix it',
    confidence: 1,
    source: 'DETERMINISTIC',
    ...partial,
  }
}

describe('deduplicateFlags', () => {
  it('drops AI flags that paraphrase deterministic REACH metadata issues', () => {
    const deterministic = [
      det({
        checkId: 'og-image-missing',
        rubric: 'REACH',
        problem: 'og:image is missing, link previews show blank',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'SHARING' as const,
        severity: 'CRITICAL' as const,
        problem: 'The page lacks an og:image, making social shares appear bland',
        evidence: 'No og:image meta tag in page head',
        whyItMatters: 'Shared links show blank preview cards',
        fix: 'Add og:image',
        confidence: 0.9,
        verificationRule: 'Twitter Card Validator shows image',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('drops cross-rubric AI flags that match mobile CTA deterministic theme', () => {
    const deterministic = [
      det({
        checkId: 'cta-below-fold-mobile',
        rubric: 'EXPERIENCE',
        problem: 'Primary CTA is hidden below the fold on mobile',
        evidence: 'Mobile 812px viewport: Get started starts at 720px',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'CONVERSION' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Hero CTA is not visible without scrolling on mobile',
        evidence: 'Mobile screenshot shows CTA below first screen',
        whyItMatters: 'Mobile visitors may miss the signup action',
        fix: 'Move CTA above fold',
        confidence: 0.85,
        verificationRule: '375x812: CTA visible without scroll',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('keeps genuinely new AI flags', () => {
    const deterministic = [
      det({
        checkId: 'title-too-short',
        rubric: 'REACH',
        problem: 'Page title is too short',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Testimonials section uses placeholder company names',
        evidence: 'Screenshot shows "Acme Corp" repeated three times',
        whyItMatters: 'Fake social proof erodes trust',
        fix: 'Replace with real customer names or remove section',
        confidence: 0.8,
        verificationRule: 'No placeholder company names remain on page',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 1)
  })
})
