import { describe, expect, it } from 'vitest'
import { buildFinishPlan, buildFixList } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'

function flag(id: string, severity: string, prompt = `Fix ${id}`): RankableFlag {
  return {
    id,
    checkId: id,
    rubric: 'MESSAGE',
    severity,
    impactTag: 'CLARITY',
    problem: `Problem ${id}`,
    evidence: `Evidence ${id}`,
    fix: prompt,
  }
}

describe('buildFinishPlan', () => {
  const flags = [
    flag('polish', 'POLISH'),
    flag('critical', 'CRITICAL'),
    flag('important-a', 'IMPORTANT'),
    flag('important-b', 'IMPORTANT'),
  ]

  it('ranks and caps the plan at three items', () => {
    const plan = buildFinishPlan({ flags, promptAccess: 'all' })
    expect(plan.items).toHaveLength(3)
    expect(plan.items[0]?.id).toBe('critical')
    expect(plan.items.map((item) => item.id)).not.toContain('polish')
  })

  it('shows exactly one demonstrated prompt to anonymous viewers', () => {
    const plan = buildFinishPlan({
      flags: flags.map((item) => ({ ...item, fix: undefined })),
      promptAccess: 'one',
      demonstratedFlag: flags[1],
    })
    expect(plan.items.filter((item) => item.prompt)).toHaveLength(1)
    expect(plan.items[0]?.id).toBe('critical')
    expect(plan.items.find((item) => item.id === 'critical')?.prompt).toBe('Fix critical')
    expect(plan.copyPrompt).toBeNull()
  })

  it('puts the demonstrated fix first when a higher-ranked summary has no prompt', () => {
    const criticalWithoutFix = { ...flag('critical-no-fix', 'CRITICAL'), fix: undefined }
    const demonstrated = flag('important-fix', 'IMPORTANT')
    const plan = buildFinishPlan({
      flags: [criticalWithoutFix, demonstrated, flag('polish-fix', 'POLISH')],
      promptAccess: 'one',
      demonstratedFlag: demonstrated,
    })

    expect(plan.items[0]?.id).toBe('important-fix')
    expect(plan.items[0]?.prompt).toBe('Fix important-fix')
    expect(plan.items[1]?.id).toBe('critical-no-fix')
  })

  it('redacts every prompt when access is none', () => {
    const plan = buildFinishPlan({ flags, promptAccess: 'none' })
    expect(plan.items.every((item) => item.prompt === null)).toBe(true)
    expect(plan.copyPrompt).toBeNull()
  })
})

describe('buildFixList', () => {
  const flags = [
    flag('polish', 'POLISH'),
    flag('critical', 'CRITICAL'),
    flag('important-a', 'IMPORTANT'),
    flag('important-b', 'IMPORTANT'),
  ]

  it.each([0, 1, 3, 6])('returns all %i unresolved Flags exactly once', (count) => {
    const input = Array.from({ length: count }, (_, index) =>
      flag(`flag-${index}`, index === 0 ? 'CRITICAL' : 'IMPORTANT')
    )
    const list = buildFixList({ flags: input, promptAccess: 'all' })

    expect(list.items).toHaveLength(count)
    expect(new Set(list.items.map((item) => item.id)).size).toBe(count)
    expect(list.totalCount).toBe(count)
  })

  it('ranks every persisted flag without truncating', () => {
    const list = buildFixList({ flags, promptAccess: 'all' })
    expect(list.items).toHaveLength(4)
    expect(list.totalCount).toBe(4)
    expect(list.items[0]?.id).toBe('critical')
    expect(list.items.map((item) => item.id)).toContain('polish')
    expect(list.visiblePromptCount).toBe(4)
  })

  it('keeps ranking stable while exposing exactly one demonstrated prompt', () => {
    const demonstrated = flags[2]
    const list = buildFixList({
      flags: flags.map((item) => ({ ...item, fix: undefined })),
      promptAccess: 'one',
      demonstratedFlag: demonstrated,
    })

    expect(list.items.map((item) => item.id)).toEqual([
      'critical',
      'important-a',
      'important-b',
      'polish',
    ])
    expect(list.items.filter((item) => item.prompt)).toHaveLength(1)
    expect(list.items.find((item) => item.id === demonstrated.id)?.prompt).toBe('Fix important-a')
    expect(list.copyPrompt).toBeNull()
  })

  it('excludes persisted resolved and ignored Flags', () => {
    const list = buildFixList({
      flags: [
        { ...flag('open', 'IMPORTANT'), status: 'OPEN' },
        { ...flag('regressed', 'CRITICAL'), status: 'REGRESSED' },
        { ...flag('fixed', 'CRITICAL'), status: 'FIXED' },
        { ...flag('ignored', 'IMPORTANT'), status: 'IGNORED' },
      ],
      promptAccess: 'all',
    })

    expect(list.items.map((item) => item.id)).toEqual(['regressed', 'open'])
    expect(list.totalCount).toBe(2)
  })
})
