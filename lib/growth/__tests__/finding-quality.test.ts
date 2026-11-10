import { describe, expect, it } from 'vitest'
import { isReviewableHost, parseQualityCsv, sampleAcrossChecks, scoreQualityReview, toQualityCsv, type QualityRow } from '../finding-quality'

const row = (overrides: Partial<QualityRow>): QualityRow => ({
  flag_id: 'f', checked_at: '2026-11-10', host: 'shop.com', page: '/', check_id: 'lcp-poor', severity: 'IMPORTANT',
  priority_band: 'other', problem: 'Slow page', label: '', note: '', ...overrides,
})

describe('finding-quality review', () => {
  it('excludes our own fixtures and example hosts', () => {
    expect(isReviewableHost('shop.com')).toBe(true)
    for (const host of ['localhost', 'demo.localhost', 'store.test', 'everydaygoods.example', 'example.com', '127.0.0.1']) expect(isReviewableHost(host)).toBe(false)
  })

  it('spreads the sample across checks', () => {
    const flags = [...Array.from({ length: 10 }, (_, index) => ({ auditId: 'big', id: `b${index}` })), { auditId: 'a', id: 'a0' }, { auditId: 'c', id: 'c0' }]
    expect(sampleAcrossChecks(flags, 4).map(flag => flag.id)).toEqual(['b0', 'a0', 'c0', 'b1'])
    expect(sampleAcrossChecks(flags, 50)).toHaveLength(12)
  })

  it('round-trips quoted CSV cells', () => {
    const rows = [row({ flag_id: '1', problem: 'Button says "Buy", then fails,\nsilently' })]
    expect(parseQualityCsv(toQualityCsv(rows))).toEqual(rows)
    expect(parseQualityCsv('')).toEqual([])
  })

  it('scores precision overall and for fix-first Flags, and names noisy checks', () => {
    const score = scoreQualityReview([
      row({ check_id: 'journey-checkout-failed', priority_band: 'fix_first', label: 'useful' }),
      row({ check_id: 'journey-checkout-failed', priority_band: 'fix_first', label: 'Useful' }),
      row({ check_id: 'cta-unclear', priority_band: 'fix_first', label: 'noisy' }),
      row({ check_id: 'lcp-poor', label: 'wrong' }),
      row({ check_id: 'lcp-poor', label: 'noisy' }),
      row({ check_id: 'lcp-poor', label: '' }),
    ])
    expect(score.labeled).toBe(5)
    expect(score.unlabeled).toBe(1)
    expect(score.precision).toBeCloseTo(0.4)
    expect(score.fixFirst).toEqual({ labeled: 3, precision: 2 / 3 })
    expect(score.meetsTarget).toBe(false)
    expect(score.noisiestChecks.map(check => check.checkId)).toEqual(['lcp-poor', 'cta-unclear'])
  })

  it('reports no precision before anything is labeled', () => {
    const score = scoreQualityReview([row({})])
    expect(score.precision).toBeNull()
    expect(score.meetsTarget).toBeNull()
  })
})
