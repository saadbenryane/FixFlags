import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildMcpFlagPayload } from '@/lib/mcp/flag-payload'
import { whyItMattersForCheckId } from '@/lib/audit/flag-copy'
import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'

describe('buildMcpFlagPayload', () => {
  it('returns useful MCP fix context for new UX deterministic flags', () => {
    const payload = buildMcpFlagPayload({
      id: 'flag-1',
      checkId: 'friction-no-social-proof',
      rubric: 'MESSAGE',
      severity: 'POLISH',
      impactTag: 'TRUST',
      problem: 'No social proof signals found alongside conversion CTAs',
      evidence:
        'Page has CTAs but no verifiable customer counts, testimonials, reviews, case studies, or trust badges visible.',
      whyItMatters: whyItMattersForCheckId('friction-no-social-proof'),
      fix: 'Add the strongest proof you can substantiate near the CTA. If you do not have proof yet, add product evidence instead of inventing numbers.',
      verificationRule: verificationRuleForCheckId('friction-no-social-proof'),
      confidence: 0.7,
    })

    assert.equal(payload.id, 'flag-1')
    assert.equal(payload.rubric, 'MESSAGE')
    assert.equal(payload.severity, 'POLISH')
    assert.match(payload.whyItMatters ?? '', /Proof near the CTA/)
    assert.match(payload.fix, /substantiate/)
    assert.match(payload.verificationRule ?? '', /customer count|testimonial|review badge/i)
    assert.ok(payload.prompt)
    assert.match(payload.prompt ?? '', /This is a FixFlags finding from the live page/)
    assert.match(payload.prompt ?? '', /Task: Add the strongest proof/)
    assert.match(payload.prompt ?? '', /Make a short plan/)
    assert.doesNotMatch(payload.prompt ?? '', /^## Goal/)
    assert.doesNotMatch(payload.prompt, /Join 10,000/i)
  })

  it('uses the same editor handoff for every MCP tool and reports empty prompts explicitly', () => {
    const baseFlag = {
      id: 'flag-2',
      checkId: 'mobile-cta-weak-label',
      rubric: 'MESSAGE',
      severity: 'POLISH',
      impactTag: 'CONVERSION',
      problem: 'Mobile CTA label is vague',
      evidence: 'Primary mobile CTA reads "Click here".',
      whyItMatters: whyItMattersForCheckId('mobile-cta-weak-label'),
      fix: 'Replace vague CTA copy with outcome-specific action text.',
      verificationRule: verificationRuleForCheckId('mobile-cta-weak-label'),
      cursorPrompt: 'Find the mobile CTA and rename it to an outcome-specific action.',
    }

    assert.equal(
      buildMcpFlagPayload(baseFlag, 'cursor').prompt,
      buildMcpFlagPayload(baseFlag, 'universal').prompt
    )
    assert.match(buildMcpFlagPayload(baseFlag, 'cursor').prompt ?? '', /This is a FixFlags finding from the live page/)
    const unavailable = buildMcpFlagPayload(
      { ...baseFlag, fix: '', agentPrompt: null, cursorPrompt: undefined },
      'bolt'
    )
    assert.equal(unavailable.prompt, null)
    assert.match(unavailable.promptError ?? '', /No validated bolt prompt/)
  })
})
