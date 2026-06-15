import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  containsSpeculation,
  sanitizeFindingFields,
  sanitizePromptText,
} from '@/lib/audit/sanitize-prompts'

describe('sanitize-prompts', () => {
  it('detects CTR and conversion speculation', () => {
    assert.equal(containsSpeculation('CTR loss of 40%'), true)
    assert.equal(containsSpeculation('click-through rate dropped 30%'), true)
    assert.equal(containsSpeculation('conversion rate increased 15%'), true)
    assert.equal(containsSpeculation('40-60% CTR drop'), true)
  })

  it('detects traffic and engagement speculation', () => {
    assert.equal(containsSpeculation('60% of traffic is mobile'), true)
    assert.equal(containsSpeculation('up to 40% compared to'), true)
    assert.equal(containsSpeculation('2x more engagement'), true)
    assert.equal(containsSpeculation('65% less engagement'), true)
    assert.equal(containsSpeculation('bounce rate dropped 20%'), true)
    assert.equal(containsSpeculation('increases bounce rate'), true)
  })

  it('allows measured audit evidence', () => {
    assert.equal(containsSpeculation('CTA starts at 950px from top'), false)
    assert.equal(containsSpeculation('Nav bar consumes 178px of 812px'), false)
    assert.equal(containsSpeculation('Scripts add ~80ms render delay'), false)
  })

  it('replaces speculative prompt text with fallback', () => {
    const result = sanitizePromptText('Likely in _app.tsx', 'Use evidence from DOM')
    assert.equal(result, 'Use evidence from DOM')
  })

  it('sanitizes verificationRule with speculation', () => {
    const finding = sanitizeFindingFields({
      evidence: 'og:image missing in HTML head',
      fix: 'Add og:image meta tag',
      verificationRule: 'CSS size reduced by 40%',
    })
    assert.ok(finding.verificationRule?.includes('Confirm the issue'))
    assert.equal(finding.verificationRule?.includes('40%'), false)
  })

  it('sanitizes component-guess prompts', () => {
    const finding = sanitizeFindingFields({
      evidence: 'CTA at y=1200px on 375px viewport',
      fix: 'Move CTA above fold',
      agentPrompt: '60% of traffic is mobile, move CTA',
      cursorPrompt: 'In the hero component, update H1',
    })
    assert.equal(finding.agentPrompt, 'Move CTA above fold')
    assert.equal(finding.cursorPrompt, 'Move CTA above fold')
  })
})
