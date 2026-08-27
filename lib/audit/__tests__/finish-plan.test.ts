import { describe, expect, it } from 'vitest'
import { buildFinishPlan, buildFixArtifacts, buildFixList } from '@/lib/audit/finish-plan'
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

  it('derives a bounded Finish Plan from the same complete ranking', () => {
    const { fixList, finishPlan } = buildFixArtifacts({ flags, promptAccess: 'all' })

    expect(fixList.items).toHaveLength(4)
    expect(finishPlan.items).toHaveLength(3)
    expect(finishPlan.items.map((item) => item.id)).toEqual(
      fixList.items.slice(0, 3).map((item) => item.id)
    )
    expect(finishPlan.copyPrompt).toContain('Problem critical')
    expect(finishPlan.copyPrompt).not.toContain('Problem polish')
  })

  it('caps explicit Finish Plan limits at three and keeps at least one item', () => {
    expect(buildFinishPlan({ flags, promptAccess: 'all', limit: 99 }).items).toHaveLength(3)
    expect(buildFinishPlan({ flags, promptAccess: 'all', limit: 0 }).items).toHaveLength(1)
  })

  it('returns no Attention when current evidence is only imperfection or low confidence', () => {
    const result = buildFixArtifacts({
      flags: [
        { ...flag('minor', 'POLISH'), confidence: 1 },
        { ...flag('uncertain', 'IMPORTANT'), confidence: 0.4 },
      ],
      promptAccess: 'all',
    })

    expect(result.finishPlan.items).toEqual([])
    expect(result.finishPlan.copyPrompt).toBeNull()
    expect(result.fixList.items).toHaveLength(2)
  })

  it('keeps observations without a worthwhile change in the Fix List only', () => {
    const result = buildFixArtifacts({
      flags: [{ ...flag('judgment-only', 'CRITICAL'), fix: undefined }],
      promptAccess: 'all',
    })

    expect(result.fixList.items).toHaveLength(1)
    expect(result.finishPlan.items).toEqual([])
  })

  it('keeps ranking stable while exposing exactly one demonstrated prompt', () => {
    const demonstrated = flags[2]
    const list = buildFixList({
      flags,
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
    const demonstratedPrompt = list.items.find((item) => item.id === demonstrated.id)?.prompt
    expect(demonstratedPrompt).toMatch(/This is a FixFlags finding from the live page/)
    expect(demonstratedPrompt).toMatch(/Task:/)
    expect(demonstratedPrompt).toContain('Fix important-a')
    expect(list.copyPrompt).toMatch(/^This is a FixFlags finding from the live page, not a guess about your repo\./)
    expect(list.copyPrompt).toMatch(/Plan all of these changes before implementing any of them/)
    expect(list.copyPrompt).toContain('Problem important-a')
    expect(list.copyPrompt).toMatch(/1\. /);
    expect(list.copyPrompt).toMatch(/2\. /);
    expect(list.copyPrompt).toContain('Problem critical')
    expect(list.copyPrompt).toContain('Problem important-b')
    expect(list.copyPrompt).toContain('Problem polish')
    expect(list.copyPrompt).toMatch(/3\. /);
    expect(list.copyPrompt).toMatch(/4\. /)
  })

  it('redacts every prompt when access is none', () => {
    const list = buildFixList({ flags, promptAccess: 'none' })
    expect(list.items.every((item) => item.prompt === null)).toBe(true)
    expect(list.visiblePromptCount).toBe(0)
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

  it('counts unique paths on one collapsed Flag, not row count', () => {
    const list = buildFixList({
      flags: [
        {
          ...flag('privacy', 'POLISH'),
          checkId: 'no-privacy-policy',
          pageUrl: 'https://example.com/pricing',
          affectedPaths: [
            'https://example.com/',
            'https://example.com/pricing',
            'https://example.com/features',
            'https://example.com/about',
            'https://example.com/blog',
            'https://example.com/docs',
            'https://example.com/contact',
            'https://example.com/login',
          ],
        },
      ],
      promptAccess: 'all',
    })

    expect(list.totalCount).toBe(1)
    expect(list.items[0]?.occurrenceCount).toBe(8)
    expect(list.items[0]?.pageUrls).toHaveLength(8)
  })

  it('consolidates repeated per-page checks into one site fix with all occurrences', () => {
    const list = buildFixList({
      flags: [
        {
          ...flag('privacy-home', 'POLISH'),
          checkId: 'no-privacy-policy',
          pageUrl: 'https://example.com/',
          evidence: 'No privacy link found.',
        },
        {
          ...flag('privacy-contact', 'POLISH'),
          checkId: 'no-privacy-policy::page:1',
          pageUrl: 'https://example.com/contact',
          evidence: 'No privacy link found.',
        },
      ],
      promptAccess: 'all',
    })

    expect(list.totalCount).toBe(1)
    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.checkId).toBe('no-privacy-policy')
    expect(list.items[0]?.occurrenceCount).toBe(2)
    expect(list.items[0]?.pageUrls).toEqual([
      'https://example.com/',
      'https://example.com/contact',
    ])
    expect(list.items[0]?.evidence).toContain('Seen in 2 Review observations')
  })

  it('collapses profilium-shaped 5-page per-page variants into one fix per check', () => {
    // Regression: prod audit cms6ffu550001rr206gadzk72 showed the same finding
    // repeated as cta-dead-link, ::page:1, ::page:2, ::page:3, ::page:4.
    const pages = [
      'https://app.profilium.co/',
      'https://app.profilium.co/pricing',
      'https://app.profilium.co/features',
      'https://app.profilium.co/about',
      'https://app.profilium.co/contact',
    ]
    const flags = pages.flatMap((pageUrl, index) =>
      ['cta-dead-link', 'cta-below-fold-mobile', 'title-too-short', 'description-missing'].map(
        (checkId, checkIndex) => ({
          id: `${checkId}-${index}`,
          checkId: index === 0 ? checkId : `${checkId}::page:${index}`,
          rubric: 'MESSAGE' as const,
          severity: (checkIndex < 2 ? 'CRITICAL' : 'IMPORTANT') as 'CRITICAL' | 'IMPORTANT',
          impactTag: 'CONVERSION' as const,
          problem: `Problem for ${checkId}`,
          evidence: `Evidence for ${checkId} on page ${index}`,
          whyItMatters: 'Impact',
          fix: `Fix ${checkId}`,
          pageUrl,
          confidence: 0.9,
          source: 'DETERMINISTIC' as const,
        })
      )
    )

    const list = buildFixList({ flags, promptAccess: 'all' })

    expect(list.totalCount).toBe(4)
    const byCheck = new Map(list.items.map((item) => [item.checkId, item]))
    for (const checkId of ['cta-dead-link', 'cta-below-fold-mobile', 'title-too-short', 'description-missing']) {
      const item = byCheck.get(checkId)
      expect(item, `missing consolidated ${checkId}`).toBeDefined()
      expect(item?.occurrenceCount).toBe(5)
      expect(item?.pageUrls).toHaveLength(5)
    }
  })
})
