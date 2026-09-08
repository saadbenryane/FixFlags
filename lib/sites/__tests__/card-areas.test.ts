import { describe, expect, it } from 'vitest'
import { cardAreaForCheck, STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import { encodeSiteId, parseSiteId } from '@/lib/sites/types'

describe('site card packaging', () => {
  it('maps security and performance checks to board areas', () => {
    expect(cardAreaForCheck({ checkId: 'no-https' })).toBe('security')
    expect(cardAreaForCheck({ checkId: 'lcp-critical' })).toBe('performance')
    expect(cardAreaForCheck({ checkId: 'title-missing' })).toBe('search')
    expect(cardAreaForCheck({ checkId: 'no-cta-detected' })).toBe('conversion')
    expect(cardAreaForCheck({ checkId: 'measurement-pixel-missing', rubric: 'REACH' })).toBe(
      'tracking'
    )
  })

  it('keeps starter board order', () => {
    expect(STARTER_BOARD_CARDS[0]).toBe('site')
    expect(STARTER_BOARD_CARDS).toContain('conversion')
    expect(STARTER_BOARD_CARDS).toContain('tracking')
  })

  it('encodes provisional site ids without touching graph Site', () => {
    const id = encodeSiteId({ kind: 'provisional', provisionalSiteId: 'abc' })
    expect(id).toBe('p_abc')
    expect(parseSiteId(id)).toEqual({
      kind: 'provisional',
      siteId: 'p_abc',
      provisionalSiteId: 'abc',
    })
    expect(parseSiteId('proj_1')).toEqual({
      kind: 'project',
      siteId: 'proj_1',
      projectId: 'proj_1',
    })
  })

  it('does not call zero flags healthy while checking', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'CAPTURING',
      completedAt: null,
      evidenceCoverage: null,
      flags: [],
      rubrics: [],
    })
    expect(facts.every((f) => f.state === 'checking')).toBe(true)
  })

  it('marks problem when open critical flags exist after completion', () => {
    const facts = buildCoverageFacts({
      auditStatus: 'COMPLETED',
      completedAt: new Date('2026-09-08T12:00:00Z'),
      evidenceCoverage: null,
      flags: [
        {
          checkId: 'no-cta-detected',
          rubric: 'MESSAGE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          status: 'OPEN',
        },
      ],
      rubrics: [{ name: 'MESSAGE', score: 62 }],
    })
    const conversion = facts.find((f) => f.area === 'conversion')
    expect(conversion?.state).toBe('problem')
    expect(conversion?.openFlagCount).toBe(1)
  })
})
