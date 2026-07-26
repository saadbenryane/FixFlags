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

  it('drops an AI audience-specificity paraphrase of the deterministic headline flag', () => {
    const deterministic = [
      det({
        checkId: 'messaging-no-audience',
        rubric: 'MESSAGE',
        problem: 'Headline does not specify who this is for',
        evidence: 'H1: "From vision to reality." has no audience signal.',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'CLARITY' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Headline lacks audience specificity',
        evidence: 'The headline does not specify who this service is for.',
        whyItMatters: 'Visitors may not recognize themselves.',
        fix: 'Name the audience.',
        confidence: 0.75,
        verificationRule: 'The headline names the intended audience.',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('rejects AI mobile CTA geometry claims when the deterministic check correctly passes', () => {
    const aiFlags = [
      {
        rubric: 'EXPERIENCE' as const,
        impactTag: 'CONVERSION' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Primary CTA is not prominent on mobile',
        evidence: 'The Book a Call CTA is somewhat hidden within the mobile layout.',
        whyItMatters: 'Mobile visitors may miss it.',
        fix: 'Move the CTA.',
        confidence: 0.75,
        verificationRule: 'Check the mobile viewport.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('rejects AI absence claims for privacy and contact facts owned by deterministic metadata', () => {
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'CRITICAL' as const,
        problem: 'Missing privacy policy and contact information',
        evidence: 'There is no link to a privacy policy or easy access to contact information.',
        whyItMatters: 'Visitors may hesitate.',
        fix: 'Add both.',
        confidence: 0.75,
        verificationRule: 'Check the footer.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('rejects AI cookie-consent findings owned by deterministic metadata', () => {
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'No cookie consent mechanism in place',
        evidence: 'Analytics is present but no cookie banner is found.',
        whyItMatters: 'Consent requirements may apply.',
        fix: 'Add consent controls.',
        confidence: 0.8,
        verificationRule: 'Confirm analytics waits for consent.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('rejects AI console and share-control claims owned by deterministic checks', () => {
    const aiFlags = [
      {
        rubric: 'EXPERIENCE' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Presence of console errors',
        evidence: 'Console errors appear during inspection.',
        whyItMatters: 'Errors may indicate broken behavior.',
        fix: 'Fix errors.',
        confidence: 0.7,
        verificationRule: 'Open the console.',
      },
      {
        rubric: 'REACH' as const,
        impactTag: 'SHARING' as const,
        severity: 'POLISH' as const,
        problem: 'No social sharing options',
        evidence: 'There are no visible ways to share or promote the site further.',
        whyItMatters: 'Visitors cannot promote the site.',
        fix: 'Add share buttons.',
        confidence: 0.7,
        verificationRule: 'Find a share button.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
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
