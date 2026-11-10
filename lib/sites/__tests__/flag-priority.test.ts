import { describe, expect, it } from 'vitest'
import { compareFlagPriority, flagActionKind, flagPriority } from '../presentation'

describe('Site Flag priority', () => {
  it('classifies failed visitor actions and speed metrics', () => {
    expect(flagActionKind('journey-checkout-failed')).toBe('visitor_action')
    expect(flagActionKind('flow-cta-404::page:2')).toBe('visitor_action')
    expect(flagActionKind('page-http-error')).toBe('visitor_action')
    expect(flagActionKind('lcp-poor')).toBe('metric')
    expect(flagActionKind('mobile-perf-critical')).toBe('metric')
    expect(flagActionKind('description-missing')).toBe('other')
    expect(flagActionKind(null)).toBe('other')
  })

  it('puts a broken action above a slow page, even when the metric is more severe', () => {
    const brokenCart = { problem: 'Add to cart did nothing', ...flagPriority({ severity: 'IMPORTANT', confidence: 0.9, checkId: 'journey-checkout-failed' }) }
    const slowPaint = { problem: 'Main content is slow on mobile', ...flagPriority({ severity: 'CRITICAL', confidence: 0.9, checkId: 'lcp-critical' }) }
    const ranked = [slowPaint, brokenCart].map(flag => ({ ...flag, priorityScore: flag.score })).sort(compareFlagPriority)
    expect(ranked.map(flag => flag.problem)).toEqual(['Add to cart did nothing', 'Main content is slow on mobile'])
    expect(brokenCart.band).toBe('fix_first')
  })

  it('keeps an important metric out of fix-first and leaves other checks unchanged', () => {
    expect(flagPriority({ severity: 'IMPORTANT', confidence: 1, checkId: 'cls-poor' }).band).toBe('other')
    expect(flagPriority({ severity: 'IMPORTANT', confidence: 1, checkId: 'description-missing' })).toEqual(flagPriority({ severity: 'IMPORTANT', confidence: 1 }))
  })
})
