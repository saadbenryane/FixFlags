import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  compareFlagsByPriority,
  getTopFixPromptFromFlags,
  rankFlagsByPriority,
  collectAllFixPrompts,
  countFixPrompts,
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

  it('countFixPrompts returns 0 when no flags have fix prompts', () => {
    assert.equal(countFixPrompts([flag({ id: 'a', fix: undefined }), flag({ id: 'b', fix: undefined })]), 0)
  })

  it('countFixPrompts counts flags with agentPrompt or cursorPrompt etc', () => {
    assert.equal(
      countFixPrompts([
        flag({ id: 'a', fix: undefined }),
        flag({ id: 'b', agentPrompt: 'Do this', fix: undefined }),
        flag({ id: 'c', cursorPrompt: 'Cursor fix', fix: undefined }),
        flag({ id: 'd', fix: 'Fix it' }),
      ]),
      3
    )
  })

  it('collectAllFixPrompts returns empty string when no flags have prompts', () => {
    assert.equal(collectAllFixPrompts([flag({ id: 'a', fix: undefined }), flag({ id: 'b', fix: undefined })]), '')
  })

  it('collectAllFixPrompts formats multiple prompts with separators and indexes', () => {
    const result = collectAllFixPrompts([
      flag({ id: 'a', problem: 'First flag', agentPrompt: 'Fix first' }),
      flag({ id: 'b', problem: 'Second flag', cursorPrompt: 'Fix second' }),
    ])
    assert.match(result, /Fix 1: First flag/)
    assert.match(result, /Fix first/)
    assert.match(result, /Fix 2: Second flag/)
    assert.match(result, /Fix second/)
  })

  it('collectAllFixPrompts skips flags without prompts and indexes remaining', () => {
    const result = collectAllFixPrompts([
      flag({ id: 'a', problem: 'Skipped', fix: undefined }),
      flag({ id: 'b', problem: 'Has prompt', agentPrompt: 'Fix this', fix: undefined }),
    ])
    assert.match(result, /Fix 1: Has prompt/)
    assert.equal(result.includes('Fix 2'), false)
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
