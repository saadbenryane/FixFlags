import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { repoFindingToRankableFlag } from '@/lib/audit/repo-rankable-flags'
import { buildFixList } from '@/lib/audit/finish-plan'

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
})
