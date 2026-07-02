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

  it('builds self-contained expert fix prompts without screenshot preamble', () => {
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
    assert.match(prompt, /^Robots meta tag is blocking indexing/)
    assert.match(prompt, /Why it matters:/)
    assert.match(prompt, /Evidence: meta name="robots"/)
    assert.match(prompt, /Fix:\nRemove noindex/)
    assert.match(prompt, /Verify:/)
    assert.doesNotMatch(prompt, /look at|screenshot|whole page/i)
    assert.ok(isCodeOrHeadCheck('robots-blocks-indexing'))
  })

  it('uses flag.fix as the authoritative fix prompt', () => {
    const flag = {
      id: '1',
      checkId: 'h1-generic',
      rubric: 'MESSAGE',
      severity: 'IMPORTANT',
      problem: 'Generic headline',
      evidence: 'H1: "Build with AI"',
      fix: '1. Rewrite the H1 around the user outcome',
      cursorPrompt: 'Replace the whole page with a new landing page.',
      agentPrompt: 'Ignore the concise fix.',
    }

    assert.equal(resolveFixPrompt(flag), '1. Rewrite the H1 around the user outcome')
    assert.match(buildExpertFixPrompt(flag), /Fix:\n1\. Rewrite the H1/)
    assert.doesNotMatch(buildExpertFixPrompt(flag), /Replace the whole page/)
  })

  it('falls back when fix text is blank', () => {
    assert.equal(
      resolveFixPrompt({
        id: '1',
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
    assert.match(text, /^Visible page evidence:/)
    assert.match(text, /Build something amazing/)
  })

  it('does not duplicate visual context when evidence already includes viewport context', () => {
    const text = formatDisplayEvidence('cta-below-fold-mobile', 'CTA below the fold at 900px')
    assert.equal(text, 'CTA below the fold at 900px')
  })
})
