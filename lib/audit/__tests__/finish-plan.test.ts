import { describe, expect, it } from 'vitest'
import { buildFixList } from '@/lib/audit/finish-plan'
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

  it('keeps ranking stable while exposing exactly one demonstrated prompt', () => {
    const demonstrated = flags[2]
    const list = buildFixList({
      // Only the demonstrated flag keeps a usable fix body; others are gated.
      flags: flags.map((item) =>
        item.id === demonstrated.id ? item : { ...item, fix: undefined }
      ),
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
    expect(demonstratedPrompt).toMatch(/## Why/)
    expect(demonstratedPrompt).toMatch(/## Fix/)
    expect(demonstratedPrompt).toContain('Fix important-a')
    expect(list.copyPrompt).toBeNull()
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
    expect(list.items[0]?.evidence).toContain('Seen on 2 scanned pages')
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
