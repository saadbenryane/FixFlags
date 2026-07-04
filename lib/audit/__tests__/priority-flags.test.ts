import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  compareFlagsByPriority,
  getTopFixPromptFromFlags,
  rankFlagsByPriority,
  type RankableFlag,
} from '@/lib/audit/priority-flags'

function flag(overrides: Partial<RankableFlag>): RankableFlag {
  return {
    id: overrides.id ?? overrides.problem ?? 'flag',
    checkId: null,
    rubric: 'MESSAGE',
    severity: 'POLISH',
    impactTag: null,
    problem: 'Flag',
    fix: 'Fix it',
    confidence: 0.5,
    ...overrides,
  }
}

describe('priority-flags', () => {
  it('keeps severity first, then sorts by impact and confidence', () => {
    const sorted = [
      flag({ id: 'low-confidence-polish', severity: 'POLISH', impactTag: 'CONVERSION', confidence: 0.1, problem: 'Low confidence polish' }),
      flag({ id: 'important', severity: 'IMPORTANT', impactTag: 'SEO', confidence: 0.4, problem: 'Important' }),
      flag({ id: 'trust-polish', severity: 'POLISH', impactTag: 'TRUST', confidence: 0.95, problem: 'Trust polish' }),
      flag({ id: 'high-confidence-polish', severity: 'POLISH', impactTag: 'CONVERSION', confidence: 0.9, problem: 'High confidence polish' }),
    ].sort(compareFlagsByPriority)

    assert.deepEqual(
      sorted.map((f) => f.id),
      ['important', 'high-confidence-polish', 'low-confidence-polish', 'trust-polish']
    )
  })

  it('uses priority order for the top copyable fix prompt', () => {
    const top = getTopFixPromptFromFlags([
      flag({ problem: 'Generic polish', severity: 'POLISH', impactTag: 'SEO', confidence: 0.9, fix: 'Fix SEO polish' }),
      flag({ problem: 'Conversion polish', severity: 'POLISH', impactTag: 'CONVERSION', confidence: 0.8, fix: 'Fix conversion polish' }),
    ])

    assert.equal(top?.flag, 'Conversion polish')
    assert.equal(top?.prompt, 'Fix conversion polish')
  })

  it('prefers the AI-crafted agentPrompt over the plain-English fix once both exist', () => {
    const top = getTopFixPromptFromFlags([
      flag({
        problem: 'Fully prescribed flag',
        fix: '1. Do a thing\n2. Do another thing',
        agentPrompt: 'Fix the hero headline in app/page.tsx to name the audience.',
      }),
    ])

    assert.equal(top?.prompt, 'Fix the hero headline in app/page.tsx to name the audience.')
  })

  it('falls back through tool-specific prompts before the plain fix text', () => {
    const top = getTopFixPromptFromFlags([
      flag({
        problem: 'Cursor-only flag',
        fix: 'Generic instructions',
        cursorPrompt: 'Cursor-specific instructions',
      }),
    ])

    assert.equal(top?.prompt, 'Cursor-specific instructions')
  })

  it('uses priority before rubric grade in ranked fix lists', () => {
    const ranked = rankFlagsByPriority(
      [
        flag({ problem: 'Low impact bad grade', rubric: 'REACH', severity: 'POLISH', impactTag: 'SEO', confidence: 0.9 }),
        flag({ problem: 'High impact better grade', rubric: 'MESSAGE', severity: 'POLISH', impactTag: 'CONVERSION', confidence: 0.8 }),
      ],
      [
        { name: 'REACH', grade: 'F' },
        { name: 'MESSAGE', grade: 'C' },
      ],
      2
    )

    assert.equal(ranked[0].flag.problem, 'High impact better grade')
  })
})
