import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  buildExpertFixPrompt,
  formatDisplayEvidence,
  isCodeOrHeadCheck,
  isGenericWhyItMatters,
  resolveWhyItMatters,
  whyItMattersForCheckId,
} from '@/lib/audit/flag-copy'
import { resolveFixPrompt } from '@/lib/audit/priority-flags'

const NEW_UX_IDS = [
  'messaging-weak-value-prop',
  'messaging-jargon-overload',
  'messaging-no-audience',
  'messaging-long-sentences',
  'messaging-headline-too-short',
  'friction-no-commitment-path',
  'friction-trial-commitment-unclear',
  'friction-form-too-many-fields',
  'friction-no-risk-reversal',
  'friction-no-social-proof',
  'trust-no-authority-signals',
  'trust-testimonial-quality',
  'trust-unsupported-claims',
  'trust-no-direct-contact',
  'trust-no-internal-links',
  'hierarchy-competing-actions',
  'hierarchy-no-sections',
  'hierarchy-no-headline',
  'hierarchy-information-density',
  'mobile-input-zoom',
  'mobile-cta-thumb-zone',
  'mobile-cta-weak-label',
  'mobile-no-viewport',
  'mobile-load-delay-content',
] as const

describe('flag-copy', () => {
  it('uses outcome-focused whyItMatters per checkId', () => {
    const why = whyItMattersForCheckId('description-missing')
    assert.match(why, /Google|snippet|description/i)
    assert.doesNotMatch(why, /reach quality/i)
  })

  it('rejects generic persisted whyItMatters', () => {
    const flag = {
      id: '1',
      checkId: 'og-image-missing',
      rubric: 'REACH',
      severity: 'CRITICAL',
      problem: 'Missing og:image',
      whyItMatters: 'This flag affects the reach quality of your page.',
      evidence: 'No og:image meta tag in head.',
      fix: 'Add og:image to metadata export.',
    }
    assert.ok(isGenericWhyItMatters(flag.whyItMatters))
    assert.match(resolveWhyItMatters(flag), /Shared links|blank/i)
  })

  it('has specific whyItMatters copy for every new UX check ID', () => {
    for (const id of NEW_UX_IDS) {
      const why = whyItMattersForCheckId(id)
      assert.doesNotMatch(why, /Leaving this unfixed/i, id)
      assert.doesNotMatch(why, /quality of your page/i, id)
      assert.ok(why.length > 40, id)
    }
  })

  it('builds plan-style expert fix prompts with Goal/Constraint/Context/Plan/Verify', () => {
    const flag = {
      id: '1',
      checkId: 'robots-blocks-indexing',
      rubric: 'REACH',
      severity: 'CRITICAL',
      problem: 'Robots meta tag is blocking indexing',
      evidence: 'meta name="robots" content="noindex"',
      fix: 'Remove noindex from robots meta for production pages.',
      verificationRule: 'View page source; robots meta should not include noindex.',
    }
    const prompt = buildExpertFixPrompt(flag)
    assert.match(prompt, /^## Goal$/m)
    assert.match(prompt, /## Constraint/)
    assert.match(prompt, /## Context/)
    assert.match(prompt, /## Plan\nRemove noindex/)
    assert.match(prompt, /## Verify/)
    assert.doesNotMatch(prompt, /look at|screenshot|whole page/i)
    assert.ok(isCodeOrHeadCheck('robots-blocks-indexing'))
  })

  it('normalizes legacy Goal/Observed/Expected essays into Plan body', () => {
    const flag = {
      id: '1',
      checkId: 'h1-generic',
      rubric: 'MESSAGE',
      severity: 'IMPORTANT',
      problem: 'Generic headline',
      evidence: 'H1: "Build with AI"',
      fix: [
        '## Goal',
        'Make the headline outcome-led.',
        '',
        '## Observed behavior',
        'H1 says "Build with AI".',
        '',
        '## Expected behavior',
        'Rewrite the H1 to name the audience and outcome.',
        '',
        '## How to verify',
        'Reload and read the hero H1.',
      ].join('\n'),
      verificationRule: 'Reload and read the hero H1.',
    }
    const prompt = buildExpertFixPrompt(flag)
    assert.match(prompt, /## Why it matters/)
    assert.match(prompt, /## Plan\nRewrite the H1 to name the audience and outcome\./)
  })

  it('prefers the AI-crafted agentPrompt over the plain-English fix once prescribed', () => {
    const flag = {
      id: '1',
      checkId: 'h1-generic',
      rubric: 'MESSAGE',
      severity: 'IMPORTANT',
      problem: 'Generic headline',
      evidence: 'H1: "Build with AI"',
      fix: '1. Rewrite the H1 around the user outcome',
      agentPrompt: 'Rewrite the H1 in app/page.tsx to name the audience and the outcome.',
    }

    assert.equal(resolveFixPrompt(flag), 'Rewrite the H1 in app/page.tsx to name the audience and the outcome.')
    assert.match(buildExpertFixPrompt(flag), /## Plan\nRewrite the H1 in app\/page\.tsx/)
  })

  it('falls back to the plain fix text when no AI prompt has been prescribed yet', () => {
    const flag = {
      id: '1',
      checkId: 'h1-generic',
      rubric: 'MESSAGE',
      severity: 'IMPORTANT',
      problem: 'Generic headline',
      evidence: 'H1: "Build with AI"',
      fix: '1. Rewrite the H1 around the user outcome',
    }

    assert.equal(resolveFixPrompt(flag), '1. Rewrite the H1 around the user outcome')
    assert.match(buildExpertFixPrompt(flag), /## Plan\n1\. Rewrite the H1/)
  })

  it('falls back when fix text is blank', () => {
    assert.equal(
      resolveFixPrompt({
        id: '1',
        checkId: 'test-check',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        problem: 'Generic headline',
        fix: '   ',
        cursorPrompt: '1. Rewrite the headline',
      }),
      '1. Rewrite the headline'
    )
  })

  it('keeps factual evidence for head checks in display', () => {
    const text = formatDisplayEvidence(
      'description-missing',
      'No meta name="description" tag found'
    )
    assert.equal(text, 'No meta name="description" tag found')
    assert.doesNotMatch(text, /screenshot/i)
  })

  it('includes visual context only for UI element checks when needed', () => {
    const text = formatDisplayEvidence('h1-generic', 'H1: "Build something amazing with AI"')
    assert.match(text, /^On the screenshot, look at/)
    assert.match(text, /Build something amazing/)
  })

  it('does not duplicate visual context when evidence already includes viewport context', () => {
    const text = formatDisplayEvidence('cta-below-fold-mobile', 'CTA below the fold at 900px')
    assert.equal(text, 'CTA below the fold at 900px')
  })
})
