import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildExpertFixPrompt,
  formatDisplayEvidence,
  isCodeOrHeadCheck,
  isGenericWhyItMatters,
  resolveWhyItMatters,
  whyItMattersForCheckId,
} from '@/lib/audit/flag-copy'

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
    assert.match(prompt, /Why:/)
    assert.match(prompt, /Found: meta name="robots"/)
    assert.match(prompt, /Do: Remove noindex/)
    assert.match(prompt, /Verify:/)
    assert.doesNotMatch(prompt, /look at|screenshot|whole page/i)
    assert.ok(isCodeOrHeadCheck('robots-blocks-indexing'))
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
    assert.match(text, /Build something amazing/)
  })
})
