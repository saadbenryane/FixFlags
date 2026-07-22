import { describe, expect, it } from 'vitest'
import { buildFinishPlan } from '@/lib/audit/finish-plan'
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
    expect(plan.items.find((item) => item.id === 'critical')?.prompt).toBe('Fix critical')
    expect(plan.copyPrompt).toBeNull()
  })

  it('redacts every prompt when access is none', () => {
    const plan = buildFinishPlan({ flags, promptAccess: 'none' })
    expect(plan.items.every((item) => item.prompt === null)).toBe(true)
    expect(plan.copyPrompt).toBeNull()
  })
})
