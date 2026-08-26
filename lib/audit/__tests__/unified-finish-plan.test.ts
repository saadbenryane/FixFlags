import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { repoFindingToRankableFlag } from '@/lib/audit/repo-rankable-flags'
import { buildFixList } from '@/lib/audit/finish-plan'
import { toRankableFlag } from '@/lib/audit/load-finish-plan-flags'

describe('unified finish plan', () => {
  it('ranks repo findings alongside live flags', () => {
    const live = {
      id: 'live-1',
      checkId: 'cta-missing',
      rubric: 'MESSAGE',
      severity: 'MEDIUM',
      impactTag: 'CONVERSION',
      problem: 'Primary CTA is vague',
      evidence: 'Button says Click here',
      whyItMatters: undefined,
      fix: 'Rename CTA',
      agentPrompt: 'Fix CTA copy',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: null,
      pageUrl: null,
      confidence: 0.8,
      source: 'DETERMINISTIC',
    }
    const repo = repoFindingToRankableFlag({
      id: 'f1',
      severity: 'CRITICAL',
      category: 'secret',
      filePath: '.env',
      problem: 'Exposed API key in repository',
      evidence: 'sk_live_***',
      fix: 'Remove and rotate',
      agentPrompt: 'Remove secret from .env',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
    })

    const plan = buildFixList({
      flags: [live, repo],
      promptAccess: 'all',
    })

    assert.ok(plan.items.length >= 1)
    assert.equal(plan.items[0]?.problem, 'Exposed API key in repository')
  })

  it('keeps measured evidence targets on the report ranking path', () => {
    const ranked = toRankableFlag({
      id: 'live-1',
      checkId: 'h1-generic',
      rubric: 'MESSAGE',
      severity: 'IMPORTANT',
      impactTag: 'CLARITY',
      problem: 'Generic headline',
      evidence: 'Headline is generic.',
      whyItMatters: null,
      fix: 'Replace the H1.',
      agentPrompt: null,
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: null,
      pageUrl: 'https://acme.com/',
      confidence: 0.8,
      source: 'DETERMINISTIC',
      evidenceTargets: [
        {
          kind: 'element',
          source: 'measured',
          device: 'desktop',
          rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.08 },
          selector: 'h1',
          label: 'Hero headline',
          text: 'Build with AI',
        },
      ],
    })
    assert.equal((ranked.evidenceTargets as { text?: string }[])?.[0]?.text, 'Build with AI')
    const plan = buildFixList({
      flags: [ranked],
      promptAccess: 'all',
      url: 'https://acme.com/',
    })
    assert.match(plan.items[0]?.prompt ?? '', /Build with AI/)
    assert.match(plan.items[0]?.prompt ?? '', /selector h1/)
  })
})
