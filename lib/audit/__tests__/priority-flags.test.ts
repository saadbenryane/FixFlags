import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  compareFlagsByPriority,
  rankFlagsByPriority,
  collectAllFixPrompts,
  buildPlanModePrompt,
  collectFixPromptsByRubric,
  countFixPrompts,
  resolveFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import { buildAllFixPrompts, buildFixList } from '@/lib/audit/finish-plan'

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

  it('uses explicit stable precedence for equally ranked security headers', () => {
    const sorted = [
      flag({ checkId: 'security-content-type-options-missing', impactTag: 'TRUST' }),
      flag({ checkId: 'security-csp-missing', impactTag: 'TRUST' }),
      flag({ checkId: 'security-hsts-missing', impactTag: 'TRUST' }),
    ].sort(compareFlagsByPriority)

    assert.deepEqual(
      sorted.map((item) => item.checkId),
      ['security-hsts-missing', 'security-csp-missing', 'security-content-type-options-missing']
    )
  })

  it('uses explicit stable precedence for equally ranked search findings', () => {
    const sorted = [
      flag({ checkId: 'broken-internal-links', impactTag: 'SEO' }),
      flag({ checkId: 'description-missing', impactTag: 'SEO' }),
    ].sort(compareFlagsByPriority)

    assert.deepEqual(
      sorted.map((item) => item.checkId),
      ['description-missing', 'broken-internal-links']
    )
  })

  it('uses priority order for the top copyable fix prompt', () => {
    const list = buildFixList({
      flags: [
        flag({ problem: 'Generic polish', severity: 'POLISH', impactTag: 'SEO', confidence: 0.9, fix: 'Fix SEO polish' }),
        flag({ problem: 'Conversion polish', severity: 'POLISH', impactTag: 'CONVERSION', confidence: 0.8, fix: 'Fix conversion polish' }),
      ],
      promptAccess: 'all',
    })

    assert.equal(list.items[0]?.problem, 'Conversion polish')
    assert.equal(list.items[0]?.prompt, 'Fix conversion polish')
  })

  it('prefers the AI-crafted agentPrompt over the plain-English fix once both exist', () => {
    const prompt = resolveFixPrompt(
      flag({
        problem: 'Fully prescribed flag',
        fix: '1. Do a thing\n2. Do another thing',
        agentPrompt: 'Fix the hero headline in app/page.tsx to name the audience.',
      })
    )

    assert.equal(prompt, 'Fix the hero headline in app/page.tsx to name the audience.')
  })

  it('falls back through tool-specific prompts before the plain fix text', () => {
    const prompt = resolveFixPrompt(
      flag({
        problem: 'Cursor-only flag',
        fix: 'Generic instructions',
        cursorPrompt: 'Cursor-specific instructions',
      })
    )

    assert.equal(prompt, 'Cursor-specific instructions')
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

  it('buildPlanModePrompt returns empty string when no flags have prompts', () => {
    assert.equal(buildPlanModePrompt([flag({ id: 'a', fix: undefined })], { url: 'https://x.com' }), '')
  })

  it('buildPlanModePrompt wraps ranked fixes in plan-mode instructions with confidence keys', () => {
    const result = buildPlanModePrompt(
      [
        flag({ id: 'a', severity: 'POLISH', rubric: 'REACH', problem: 'Low', agentPrompt: 'Fix low', confidence: 0.4 }),
        flag({ id: 'b', severity: 'CRITICAL', rubric: 'MESSAGE', problem: 'Blocker', evidence: 'CTA is dead', agentPrompt: 'Fix blocker', confidence: 0.9 }),
      ],
      { url: 'https://acme.com' }
    )
    // goal-loop structure + target url + issue count
    assert.match(result, /## Mission/)
    assert.match(result, /https:\/\/acme\.com/)
    assert.match(result, /2 issues/)
    // confidence keys section
    assert.match(result, /Confidence keys/)
    assert.match(result, /HIGH/)
    // CRITICAL is ranked before POLISH, and evidence + fix are included
    assert.ok(result.indexOf('Blocker') < result.indexOf('Low'))
    assert.match(result, /\[CRITICAL · Message · HIGH\] Blocker/)
    assert.match(result, /Evidence: CTA is dead/)
    assert.match(result, /Fix: Fix blocker/)
    // no em dashes (product voice)
    assert.equal(result.includes('\u2014'), false)
  })

  it('buildPlanModePrompt omits the target phrase when no url is given', () => {
    const result = buildPlanModePrompt([flag({ id: 'a', problem: 'Thing', agentPrompt: 'Fix thing' })])
    assert.match(result, /Fix all 1 issue/)
    assert.equal(result.includes(' of '), false)
  })

  it('buildPlanModePrompt defaults to Finish Plan limit of 3', () => {
    const flags = [
      flag({ id: '1', severity: 'CRITICAL', problem: 'A', agentPrompt: 'Fix A' }),
      flag({ id: '2', severity: 'IMPORTANT', problem: 'B', agentPrompt: 'Fix B' }),
      flag({ id: '3', severity: 'POLISH', problem: 'C', agentPrompt: 'Fix C' }),
      flag({ id: '4', severity: 'POLISH', problem: 'D', agentPrompt: 'Fix D' }),
    ]
    const result = buildPlanModePrompt(flags, { url: 'https://x.com' })
    assert.match(result, /3 issues/)
    assert.match(result, /Fix A/)
    assert.match(result, /Fix B/)
    assert.match(result, /Fix C/)
    assert.equal(result.includes('Fix D'), false)
  })

  it('buildAllFixPrompts includes all prompts', () => {
    const flags = [
      flag({ id: '1', severity: 'CRITICAL', problem: 'A', agentPrompt: 'Fix A' }),
      flag({ id: '2', severity: 'IMPORTANT', problem: 'B', agentPrompt: 'Fix B' }),
      flag({ id: '3', severity: 'POLISH', problem: 'C', agentPrompt: 'Fix C' }),
      flag({ id: '4', severity: 'POLISH', problem: 'D', agentPrompt: 'Fix D' }),
    ]
    const result = buildAllFixPrompts({ flags })
    assert.match(result, /4 issues/)
    assert.match(result, /Fix D/)
  })

  it('collectFixPromptsByRubric scopes prompts to one rubric', () => {
    const result = collectFixPromptsByRubric(
      [
        flag({ id: 'a', rubric: 'MESSAGE', problem: 'Msg', agentPrompt: 'Fix msg' }),
        flag({ id: 'b', rubric: 'EXPERIENCE', problem: 'Exp', agentPrompt: 'Fix exp' }),
      ],
      'MESSAGE'
    )
    assert.match(result, /Message: Fix 1: Msg/)
    assert.equal(result.includes('Exp'), false)
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

  it('demotes Reach hardening headers behind conversion Flags in Finish Plan ranking', () => {
    const sorted = [
      flag({
        id: 'hsts',
        checkId: 'security-hsts-missing',
        severity: 'CRITICAL',
        impactTag: 'TRUST',
        problem: 'HSTS missing',
      }),
      flag({
        id: 'cta',
        checkId: 'flow-cta-dead-end',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Primary CTA dead end',
      }),
    ].sort(compareFlagsByPriority)

    assert.deepEqual(
      sorted.map((f) => f.id),
      ['cta', 'hsts']
    )
  })

  it('rejects legacy signup-gate strings as usable fix prompts', () => {
    assert.equal(
      resolveFixPrompt(
        flag({
          fix: 'Sign up to get the fix prompt.',
          agentPrompt: null,
        })
      ),
      null
    )
    assert.equal(
      resolveFixPrompt(
        flag({
          fix: 'Rewrite the hero CTA so it names the outcome.',
        })
      ),
      'Rewrite the hero CTA so it names the outcome.'
    )
  })
})
